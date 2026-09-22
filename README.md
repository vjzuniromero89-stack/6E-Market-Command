# 6E Market Command

Next.js/OpenNext dashboard for CME 6E market intelligence.

Production path: `NinjaTrader 8 Volumetric → Cloudflare /api/ninjatrader → Supabase → dashboard`.

The NinjaTrader feed does not use Vercel or Upstash. Optional older MT5/Twelve Data modules are isolated and never imported by `/api/ninjatrader`.

Commands: `npm ci`, `npm test`, `npm run build`, `npm run cf:build`, `npm run preview`.

See `CONEXION-NINJATRADER.md` for Cloudflare values and installation. Run `supabase/market-command-contract.sql` in the correct project only if the existing tables do not match this contract.

EUR, USD and USD ex-EUR use validated MT5/FOREX.com prices. The optional USD index estimate requires six current FX pairs including USD/SEK, follows the public ICE basket weights, and is always labeled as an estimate—not official DXY. U.S. and German 2-year yields use official daily series; their dated spread is macro context, not a live trading signal. Missing or stale sources remain `unavailable`.

GC and CL have an optional, independent, price-only NinjaTrader connector at `/api/intermarket`. It reuses the existing private tables and secrets; it does not alter the 6E Volumetric connector or create trade signals. See `INSTALAR-INTERMARKET.md`. A recent chart update is not proof that the exchange feed has no delay. ES, VIX and other intermarket sources remain unavailable until separately verified.

The first General Engine slice describes FX breadth only when all six EUR ex-USD and all six USD ex-EUR crosses have aligned, recent observations from MT5 live. EUR/USD cannot vote twice. NinjaTrader, GC/CL and official daily rates are reported as separate data-quality context, not extra directional votes. Bookmap is marked blocked because the live BookmapData instrument disables the Python API. The General Engine does not emit entry signals, pip targets or numerical probabilities; those require verified execution rules and out-of-sample calibration.

The large 6E circle displays a 0–100 FX breadth balance: 0 favors a bearish FX context, 50 is balanced, and 100 favors a bullish FX context. It is computed from twelve verified currency crosses, with neutral crosses contributing half. It is **not** a probability, an all-engine confidence score, or a trading signal. The circle shows a dash when the live FX inputs are incomplete or stale; the other engines are shown as statuses without altering the percentage.

The circle is labeled as **partial 6E FX context**, not a complete General Engine. Its FX observations must be no older than the MT5 ten-second freshness window. The top EUR/USD ticker also hides an old quote instead of displaying it as though it were current. GC/CL are price feeds only; their presence alone is not a directional signal for 6E. Future options or intermarket factors must use authorized, time-stamped data and a tested relationship to the traded 6E horizon before contributing a vote.
