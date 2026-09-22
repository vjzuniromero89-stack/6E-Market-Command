#property strict
#property version "1.20"
#property description "Read-only FX bridge. Sends quotes/history only; contains no trading operations."

input string DashboardEndpoint="https://6e-market-command.vjzuniromero89.workers.dev/api/mt5";
input string IngestToken="";
input string BrokerSymbols="EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCHF,USDCAD,EURGBP,EURJPY,EURCHF,EURCAD,EURAUD,EURNZD";
input string DxyBrokerSymbol=""; // Optional exact FOREX.com symbol; blank keeps DXY unavailable.
input int ServerUTCOffsetMinutes=9999; // 9999 = infer current broker offset from synchronized Windows clock
input int RequestTimeoutMs=1500;

const int PAIR_COUNT=13;
string canonical[13]={"EUR/USD","GBP/USD","AUD/USD","NZD/USD","USD/JPY","USD/CHF","USD/CAD","EUR/GBP","EUR/JPY","EUR/CHF","EUR/CAD","EUR/AUD","EUR/NZD"};
string symbols[];
string periods[3]={"15m","1h","day"};
double baseline[13][3];
double dxyBaseline[3];
datetime refUTC[3];
datetime lastMinute=0;
long lastOffset=999999;
ulong nextAttempt=0;
int failures=0;
datetime lastLog=0;

string N(long value) { return IntegerToString(value); }
string P(double value) { return DoubleToString(value,8); }
void Notice(string text) {
  if(TimeLocal()-lastLog>=30) { Print("MarketCommandFX: ",text); lastLog=TimeLocal(); }
}

int OnInit() {
  if(MQLInfoInteger(MQL_TESTER)) { Print("Use a terminal chart, not Strategy Tester."); return INIT_FAILED; }
  if(StringFind(DashboardEndpoint,"https://")!=0 || StringFind(DashboardEndpoint,"/api/mt5")!=StringLen(DashboardEndpoint)-8 || StringFind(DashboardEndpoint,"?")>=0) {
    Print("Endpoint must be your final HTTPS domain followed by /api/mt5."); return INIT_PARAMETERS_INCORRECT;
  }
  if(StringLen(IngestToken)<32 || StringLen(IngestToken)>256) { Print("Use a separate MT5 ingest token of 32-256 alphanumeric characters."); return INIT_PARAMETERS_INCORRECT; }
  for(int i=0;i<StringLen(IngestToken);i++) {
    ushort c=StringGetCharacter(IngestToken,i);
    if(!((c>=48 && c<=57)||(c>=65 && c<=90)||(c>=97 && c<=122))) { Print("Token must be alphanumeric."); return INIT_PARAMETERS_INCORRECT; }
  }
  if(RequestTimeoutMs<250 || RequestTimeoutMs>5000) return INIT_PARAMETERS_INCORRECT;
  if(ServerUTCOffsetMinutes!=9999 && (ServerUTCOffsetMinutes < -840 || ServerUTCOffsetMinutes > 840)) return INIT_PARAMETERS_INCORRECT;
  if(StringSplit(BrokerSymbols,',',symbols)!=PAIR_COUNT) { Print("Provide exactly thirteen symbols in the documented order."); return INIT_PARAMETERS_INCORRECT; }
  for(int i=0;i<PAIR_COUNT;i++) {
    StringTrimLeft(symbols[i]); StringTrimRight(symbols[i]);
    if(!SymbolSelect(symbols[i],true)) Print("Symbol unavailable: ",symbols[i],". Check Market Watch symbol spelling.");
    for(int j=0;j<3;j++) baseline[i][j]=0;
  }
  if(StringLen(DxyBrokerSymbol)>0 && !SymbolSelect(DxyBrokerSymbol,true)) Print("DXY symbol unavailable: ",DxyBrokerSymbol,". DXY remains unavailable.");
  for(int j=0;j<3;j++) dxyBaseline[j]=0;
  if(!EventSetTimer(1)) return INIT_FAILED;
  Print("MarketCommandFX started. Read-only: no orders. Keep terminal and computer running.");
  return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); Comment(""); }

// Read continuous M1 BID history. Never substitute a bar from another time.
double ReferencePrice(string symbol,datetime utcReference,datetime utcMinute,long offset) {
  datetime from=(datetime)((long)utcReference+offset-60);
  datetime to=(datetime)((long)utcMinute+offset-60);
  if(from>to) return 0;
  if(SymbolInfoInteger(symbol,SYMBOL_CHART_MODE)!=SYMBOL_CHART_MODE_BID) return 0;
  MqlRates bars[];
  int count=CopyRates(symbol,PERIOD_M1,from,to,bars);
  int expected=(int)((to-from)/60)+1;
  if(count!=expected || count<1) return 0;
  for(int i=0;i<count;i++) {
    if(bars[i].time!=from+i*60 || !MathIsValidNumber(bars[i].close) || bars[i].close<=0) return 0;
  }
  return bars[0].close;
}

void OnTimer() {
  if(GetTickCount64()<nextAttempt) return;
  datetime utc=TimeGMT();
  bool connected=(bool)TerminalInfoInteger(TERMINAL_CONNECTED);
  if(!connected) { Comment("MarketCommandFX: MT5 disconnected. Dashboard will mark prices stale."); return; }
  long server=(long)TimeTradeServer();
  long offset=ServerUTCOffsetMinutes==9999 ? (long)MathRound((server-(long)utc)/900.0)*900 : ServerUTCOffsetMinutes*60;
  if(MathAbs(server-(long)utc-offset)>5) { Notice("Clock/UTC offset mismatch. Synchronize Windows or check offset setting."); return; }
  datetime minute=(datetime)(((long)utc/60)*60);
  if(minute!=lastMinute || offset!=lastOffset) {
    refUTC[0]=minute-15*60; refUTC[1]=minute-60*60; refUTC[2]=(datetime)(((long)utc/86400)*86400);
    // History loading may block briefly; performed once a minute, outside order processing.
    for(int i=0;i<PAIR_COUNT;i++) for(int j=0;j<3;j++) baseline[i][j]=ReferencePrice(symbols[i],refUTC[j],minute,offset);
    if(StringLen(DxyBrokerSymbol)>0) for(int j=0;j<3;j++) dxyBaseline[j]=ReferencePrice(DxyBrokerSymbol,refUTC[j],minute,offset);
    lastMinute=minute; lastOffset=offset;
  }
  // History retrieval can take time. Discard this cycle if its references became outdated.
  utc=TimeGMT(); server=(long)TimeTradeServer();
  if((long)utc/60!=(long)minute/60) return;
  string mode=AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_REAL ? "live" : "demo";
  string body="{\"schemaVersion\":1,\"sentAt\":"+N((long)utc*1000)+",\"connected\":true,\"mode\":\""+mode+"\",\"quotes\":[";
  int valid=0;
  for(int i=0;i<PAIR_COUNT;i++) {
    if(i>0) body+=",";
    body+="{\"symbol\":\""+canonical[i]+"\"";
    MqlTick tick;
    bool ok=SymbolInfoTick(symbols[i],tick) && MathIsValidNumber(tick.bid) && MathIsValidNumber(tick.ask) && tick.bid>0 && tick.ask>=tick.bid && tick.time>0;
    long age=ok ? server-(long)tick.time : -1;
    if(!ok || age < -2) { body+=",\"bid\":null,\"ask\":null}"; continue; }
    // Convert broker quote time to UTC via its age; unchanged quotes keep their old time.
    long tickUTC=(long)utc-age;
    body+=",\"bid\":"+P(tick.bid)+",\"ask\":"+P(tick.ask)+",\"tickAt\":"+N(tickUTC*1000)+",\"baselines\":{";
    bool first=true;
    for(int j=0;j<3;j++) if(baseline[i][j]>0) {
      if(!first) body+=",";
      first=false;
      body+="\""+periods[j]+"\":{\"price\":"+P(baseline[i][j])+",\"at\":"+N((long)refUTC[j]*1000)+"}";
    }
    body+="}}"; if(age<=10) valid++;
  }
  body+="],\"dxy\":";
  bool dxyLive=false;
  MqlTick dxyTick;
  bool dxyOK=StringLen(DxyBrokerSymbol)>0 && SymbolInfoTick(DxyBrokerSymbol,dxyTick) && MathIsValidNumber(dxyTick.bid) && MathIsValidNumber(dxyTick.ask) && dxyTick.bid>0 && dxyTick.ask>=dxyTick.bid && dxyTick.time>0;
  long dxyAge=dxyOK ? server-(long)dxyTick.time : -1;
  if(!dxyOK || dxyAge < -2) body+="null";
  else {
    long dxyUTC=(long)utc-dxyAge;
    body+="{\"symbol\":\"DXY\",\"bid\":"+P(dxyTick.bid)+",\"ask\":"+P(dxyTick.ask)+",\"tickAt\":"+N(dxyUTC*1000)+",\"baselines\":{";
    bool firstDxy=true;
    for(int j=0;j<3;j++) if(dxyBaseline[j]>0) {
      if(!firstDxy) body+=",";
      firstDxy=false;
      body+="\""+periods[j]+"\":{\"price\":"+P(dxyBaseline[j])+",\"at\":"+N((long)refUTC[j]*1000)+"}";
    }
    body+="}}";
    dxyLive=dxyAge<=10;
  }
  body+="}";
  char payload[],response[];
  StringToCharArray(body,payload,0,WHOLE_ARRAY,CP_UTF8);
  ArrayResize(payload,ArraySize(payload)-1); // Do not send the terminating NUL.
  string headers="Content-Type: application/json\r\nAuthorization: Bearer "+IngestToken+"\r\n";
  string responseHeaders;
  ResetLastError();
  int status=WebRequest("POST",DashboardEndpoint,headers,RequestTimeoutMs,payload,response,responseHeaders);
  if(status==200) {
    failures=0; nextAttempt=0;
    Comment("MarketCommandFX: sent | ",valid,"/13 FX | DXY ",(dxyLive ? "LIVE" : "UNAVAILABLE")," | ",mode,"\nRead-only. No trading operations.");
  } else {
    failures++;
    int waitSeconds=(int)MathMin(30,MathPow(2,MathMin(failures,5)));
    nextAttempt=GetTickCount64()+(ulong)waitSeconds*1000;
    Comment("MarketCommandFX: send failed HTTP ",status," | retry in ",waitSeconds," s. See Experts.");
    Notice("HTTP "+IntegerToString(status)+"; error "+IntegerToString(GetLastError())+". Check HTTPS allowlist, endpoint, dedicated token and Cloudflare/Supabase. No credentials logged.");
  }
}
