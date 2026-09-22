# 6E Market Command

Next.js/OpenNext dashboard for CME 6E market intelligence.

Production path: `NinjaTrader 8 Volumetric → Cloudflare /api/ninjatrader → Supabase → dashboard`.

The NinjaTrader feed does not use Vercel or Upstash. Optional older MT5/Twelve Data modules are isolated and never imported by `/api/ninjatrader`.

Commands: `npm ci`, `npm test`, `npm run build`, `npm run cf:build`, `npm run preview`.

See `CONEXION-NINJATRADER.md` for Cloudflare values and installation. Run `supabase/market-command-contract.sql` in the correct project only if the existing tables do not match this contract.

EUR, USD and USD ex-EUR use validated MT5/FOREX.com prices. The optional USD index estimate requires six current FX pairs including USD/SEK, follows the public ICE basket weights, and is always labeled as an estimate—not official DXY. U.S. and German 2-year yields use official daily series; their dated spread is macro context, not a live trading signal. Missing or stale sources remain `unavailable`.

GC and CL have an optional, independent, price-only NinjaTrader connector at `/api/intermarket`. It reuses the existing private tables and secrets; it does not alter the 6E Volumetric connector or create trade signals. See `INSTALAR-INTERMARKET.md`. A recent chart update is not proof that the exchange feed has no delay. ES, VIX and other intermarket sources remain unavailable until separately verified.

The first General Engine slice describes FX breadth only when all six EUR ex-USD and all six USD ex-EUR crosses have aligned, recent observations from MT5 live. EUR/USD cannot vote twice. NinjaTrader, GC/CL and official daily rates are reported as separate data-quality context, not extra directional votes. Bookmap is marked blocked because the live BookmapData instrument disables the Python API. The General Engine does not emit entry signals, pip targets or numerical probabilities; those require verified execution rules and out-of-sample calibration.

The large 6E circle now shows the **direct percentage change of the current 6E chart bar**, calculated from a recent NinjaTrader 6E price and that bar's opening price. Green means price is above the bar open, red means below, and neutral means unchanged. It clears when the 6E feed is stale or missing. The dashboard polls this feed every five seconds; it is not tick-by-tick display. This percentage is **not** a probability, an all-engine confidence score, or a trading signal.

The independent 0–100 FX breadth balance is displayed separately inside the card when twelve live, aligned currency crosses are available. Its observations must be no older than the MT5 ten-second freshness window. The top EUR/USD ticker also hides an old quote instead of displaying it as though it were current. GC/CL are price feeds only; their presence alone is not a directional signal for 6E. Future options or intermarket factors must use authorized, time-stamped data and a tested relationship to the traded 6E horizon before contributing a vote.

The partial General Engine card now combines the available observations into an explicit comparison. EUR ex-USD rising with USD ex-EUR falling favors 6E's EUR/USD orientation; the card checks whether that FX bias agrees or diverges with the current 6E chart bar. It calculates GC and CL current-bar percentage moves from their verified futures quotes and, only when chart bar times match, counts observed same/opposite movement against 6E. The official 2Y yield spread is shown with its daily frequency. GC/CL and the daily spread do not acquire invented fixed predictive weights; the application currently stores only the latest GC/CL snapshot, so it cannot estimate a reliable rolling 6E relationship yet. No combined probability is produced.
