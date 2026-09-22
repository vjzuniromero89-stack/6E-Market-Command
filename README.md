# 6E Market Command

Next.js/OpenNext dashboard for CME 6E market intelligence.

Production path: `NinjaTrader 8 Volumetric → Cloudflare /api/ninjatrader → Supabase → dashboard`.

The NinjaTrader feed does not use Vercel or Upstash. Optional older MT5/Twelve Data modules are isolated and never imported by `/api/ninjatrader`.

Commands: `npm ci`, `npm test`, `npm run build`, `npm run cf:build`, `npm run preview`.

See `CONEXION-NINJATRADER.md` for Cloudflare values and installation. Run `supabase/market-command-contract.sql` in the correct project only if the existing tables do not match this contract.

EUR, USD, USD ex-EUR, DXY, Rates and Rithmic definitions live in `lib/engines.mjs`. Without verified provider snapshots they return `unavailable`, never `live`.
