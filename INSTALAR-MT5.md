# INSTALAR MT5 + FOREX.com — 6E Market Command

Esta integración usa MT5/FOREX.com para el contexto spot FX. NinjaTrader continúa siendo la fuente CME del 6E. El conector solo lee cotizaciones e histórico; no abre, modifica ni cierra operaciones.

## 1. Variables de Cloudflare

En **Workers & Pages → 6e-market-command → Settings → Variables and Secrets → Production** conserva las cuatro variables actuales y añade:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `MT5_INGEST_TOKEN` | una clave nueva, aleatoria y distinta de las otras |
| Variable | `MARKET_CONTEXT_SOURCE` | `mt5` |

No uses la contraseña de FOREX.com. No pongas `MT5_INGEST_TOKEN` en `wrangler.jsonc`, GitHub ni capturas. Después ejecuta un nuevo deploy.

## 2. Instalar el conector

1. En MT5 abre **File → Open Data Folder → MQL5 → Experts**.
2. Copia `mt5/MarketCommandFX.ex5` allí (versión 1.30 ya compilada). Si prefieres revisar y compilar el código, copia también `mt5/MarketCommandFX.mq5`, ábrelo en MetaEditor y pulsa **F7**.
4. Regresa a MT5. En **Navigator → Expert Advisors**, pulsa **Refresh**.
5. En **Tools → Options → Expert Advisors**, activa **Allow WebRequest for listed URL** y agrega exactamente:

   `https://6e-market-command.vjzuniromero89.workers.dev`

6. Abre un gráfico dedicado de EURUSD y arrastra `MarketCommandFX` al gráfico.
7. En los parámetros confirma:

   - `DashboardEndpoint`: `https://6e-market-command.vjzuniromero89.workers.dev/api/mt5`
   - `IngestToken`: el valor de `MT5_INGEST_TOKEN`
   - `DxyBrokerSymbol`: el nombre exacto del Dollar Index en FOREX.com; déjalo vacío si no existe o aún no lo has verificado
   - `UsdSekBrokerSymbol`: `USDSEK` si ese símbolo está disponible en **Market Watch**. Si FOREX.com usa un sufijo, escribe el nombre exacto. Si no existe, déjalo vacío; la estimación seguirá **UNAVAILABLE**.

8. `BrokerSymbols` debe conservar este orden (13 pares):

   `EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCHF,USDCAD,EURGBP,EURJPY,EURCHF,EURCAD,EURAUD,EURNZD`

   Si FOREX.com añade sufijos a los símbolos, usa los nombres exactos mostrados en Market Watch, sin cambiar el orden.

Solo necesitas una instancia del conector. No requiere DLL ni permiso para operar. No compartas plantillas o capturas que enseñen el token.

## 3. Verificación

- En el gráfico, el conector debe mostrar envíos aceptados.
- En el dashboard, la franja FX debe indicar **MT5 / FOREX.com** y **LIVE** o **DEMO** según la cuenta real.
- El gráfico debe indicar `13/13 recent quotes`; EUR usa 7 cruces, USD 7 pares y USD ex-EUR 6 pares.
- La línea **ÍNDICE USD · ESTIMACIÓN MT5** necesita EURUSD, USDJPY, GBPUSD, USDCAD, USDCHF y USDSEK recientes. Emplea el punto medio bid/ask y las ponderaciones públicas del USDX; **no es la cotización oficial de DXY/ICE**. La variación porcentual compara BID actual con cierres M1 BID.
- Si USDSEK falta o tiene un tick antiguo, la estimación permanece **UNAVAILABLE**. El índice oficial continúa sin conexión, aunque aparezca la estimación.
- Compara EURUSD BID/ASK entre Market Watch y el dashboard.
- Si faltan referencias de 15 min, 1 hora o día UTC, abre temporalmente los gráficos M1 de los pares para que MT5 descargue el histórico.
- NinjaTrader/6E debe continuar mostrando **RECIBIENDO DATOS** de forma independiente.

## Diagnóstico

- **HTTP 401:** `MT5_INGEST_TOKEN` no coincide o no fue desplegado.
- **HTTP 400:** JSON, reloj o referencias históricas rechazadas.
- **HTTP 503:** Cloudflare no logra escribir en Supabase; revisa `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` y permisos de tablas.
- **HTTP -1:** falta permitir la URL en WebRequest, hay bloqueo TLS/red o timeout.
- **Esperando MT5:** confirma que el EA está adjunto, el endpoint termina en `/api/mt5` y el mercado está enviando ticks.
- **Precios sin Strength:** todavía falta histórico M1 completo para uno o más pares.

El dashboard marca como `STALE` los datos antiguos y nunca convierte fuentes desconectadas en LIVE. Las tasas oficiales de 2 años son cierres **diarios** del Tesoro de EE. UU. y Bundesbank: el diferencial solo aparece con una fecha reciente compartida. No son rendimientos en vivo ni una señal de scalping. El DXY oficial y Rithmic continúan `UNAVAILABLE` hasta integrar proveedores verificables.

Después de desplegar el ZIP, comprueba el dashboard con tu clave de lectura: **RATES ENGINE · CIERRE DIARIO** debe mostrar las fechas de ambos países; **ÍNDICE USD · ESTIMACIÓN MT5** debe mostrar el valor y el aviso **NO DXY oficial**. Si no ocurre, toma una captura de esos paneles y del texto `USD/SEK LIVE/UNAVAILABLE` en el gráfico MT5; nunca incluyas el token.

Documentación técnica: https://www.mql5.com/en/docs/network/webrequest

Fuentes: https://home.treasury.gov/treasury-daily-interest-rate-xml-feed · https://www.bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields/daily-term-structure-on-listed-federal-securities-651570 · https://www.ice.com/publicdocs/futures_us/ICE_Dollar_Index_FAQ.pdf
