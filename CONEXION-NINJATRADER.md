# NinjaTrader 8 → Cloudflare → Supabase

## Cloudflare variables and secrets

- `NEXT_PUBLIC_SUPABASE_URL`: `https://glasazanchaycnkklybw.supabase.co`
- `SUPABASE_SECRET_KEY`: Supabase server secret (Secret)
- `NINJATRADER_INGEST_TOKEN`: random secret of at least 32 characters (Secret)
- `DASHBOARD_READ_TOKEN`: a different random secret of at least 32 characters (Secret)

Never commit or expose secret values. Build with `npm run cf:build`; `wrangler.jsonc` and `open-next.config.ts` are included.

## NinjaTrader

1. Create an indicator named `MarketCommandBridge` in NinjaScript Editor.
2. Replace its source with `ninjatrader/MarketCommandBridge.cs` and compile.
3. Open one live 6E Volumetric chart and add the indicator.
4. Use `https://YOUR-CLOUDFLARE-DOMAIN/api/ninjatrader` as Endpoint.
5. Enter `NINJATRADER_INGEST_TOKEN` and keep the five-second interval.

The bridge sends no account/order data. It publishes contract, UTC/local timestamps, OHLC, price, total/bid/ask volume, bar/cumulative delta, delta percentage, trades and safe Volumetric statistics. Bid/ask data depends on the Volumetric configuration and provider capability.

LIVE means newer than 20 seconds; otherwise the feed is STALE. DXY, Rates and Rithmic remain UNAVAILABLE until a verified adapter supplies them.

HTTP 401 means token mismatch. HTTP 400 usually means clock/chart/payload validation. HTTP 503 means Supabase URL/key, Data API exposure or table contract needs checking. Compile the C# file in the user's NinjaTrader installation; local web tests cannot validate NinjaTrader assemblies.
