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
2. Copia `mt5/MarketCommandFX.mq5` allí.
3. Abre el archivo en MetaEditor y pulsa **F7**. Debe compilar sin errores.
4. Regresa a MT5. En **Navigator → Expert Advisors**, pulsa **Refresh**.
5. En **Tools → Options → Expert Advisors**, activa **Allow WebRequest for listed URL** y agrega exactamente:

   `https://6e-market-command.vjzuniromero89.workers.dev`

6. Abre un gráfico dedicado de EURUSD y arrastra `MarketCommandFX` al gráfico.
7. En los parámetros confirma:

   - `DashboardEndpoint`: `https://6e-market-command.vjzuniromero89.workers.dev/api/mt5`
   - `IngestToken`: el valor de `MT5_INGEST_TOKEN`
   - `SendIntervalSeconds`: `1`

8. `BrokerSymbols` debe conservar este orden (13 pares):

   `EURUSD,GBPUSD,AUDUSD,NZDUSD,USDJPY,USDCHF,USDCAD,EURGBP,EURJPY,EURCHF,EURCAD,EURAUD,EURNZD`

   Si FOREX.com añade sufijos a los símbolos, usa los nombres exactos mostrados en Market Watch, sin cambiar el orden.

Solo necesitas una instancia del conector. No requiere DLL ni permiso para operar. No compartas plantillas o capturas que enseñen el token.

## 3. Verificación

- En el gráfico, el conector debe mostrar envíos aceptados.
- En el dashboard, la franja FX debe indicar **MT5 / FOREX.com** y **LIVE** o **DEMO** según la cuenta real.
- El gráfico debe indicar `13/13 recent quotes`; EUR usa 7 cruces, USD 7 pares y USD ex-EUR 6 pares.
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

El dashboard marca como `STALE` los datos antiguos y nunca convierte fuentes desconectadas en LIVE. DXY, Rates y Rithmic continúan `UNAVAILABLE/DEMO` hasta integrar proveedores verificables.

Documentación técnica: https://www.mql5.com/en/docs/network/webrequest
