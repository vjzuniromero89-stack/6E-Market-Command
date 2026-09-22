# 6E Market Command

Next.js/OpenNext dashboard for CME 6E market intelligence.

Production path: `NinjaTrader 8 Volumetric → Cloudflare /api/ninjatrader → Supabase → dashboard`.

The NinjaTrader feed does not use Vercel or Upstash. Optional older MT5/Twelve Data modules are isolated and never imported by `/api/ninjatrader`.

Commands: `npm ci`, `npm test`, `npm run build`, `npm run cf:build`, `npm run preview`.

See `CONEXION-NINJATRADER.md` for Cloudflare values and installation. Run `supabase/market-command-contract.sql` in the correct project only if the existing tables do not match this contract.

EUR, USD and USD ex-EUR use validated MT5/FOREX.com prices. The optional USD index estimate requires six current FX pairs including USD/SEK, follows the public ICE basket weights, and is always labeled as an estimate—not official DXY. U.S. and German 2-year yields use official daily series; their dated spread is macro context, not a live trading signal. Missing or stale sources remain `unavailable`.
