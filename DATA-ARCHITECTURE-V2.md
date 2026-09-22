# 6E Market Command — Data Architecture V2

## Objective
A research/execution-context engine for Euro FX futures (6E). Every live module must expose provider, timestamp, freshness and coverage. No demo value may be presented as live.

## Data hierarchy
1. **CME / Rithmic:** 6E trades, bid/ask, depth, volume, historical ticks. Rithmic is preferred when full depth/order-flow/history and future routing are needed. CME direct WebSocket is suitable for source-direct top-of-book/trades/statistics.
2. **NinjaTrader:** execution-side volumetric observations and locally calculated microstructure features.
3. **FX breadth:** EUR and USD cross matrices. Required: EURUSD, EURGBP, EURJPY, EURCHF, EURCAD, EURAUD, EURNZD, GBPUSD, AUDUSD, NZDUSD, USDJPY, USDCHF, USDCAD.
4. **Rates:** US2Y/DE2Y first, then 5Y/10Y. Track level, change, acceleration and US-DE differential.
5. **Macro/events:** Fed/ECB decisions and expectations, CPI/HICP, NFP, PCE, PMI, GDP, retail sales and speeches with event-risk windows.
6. **Intermarket:** DXY plus USD-ex-EUR, GC, ES, VIX, CL. Treat as regime/context, not fixed causal rules.
7. **Positioning/options:** CFTC positioning and EURUSD implied-volatility/skew as slow context.

## Intelligence layers
- Cause/context: EUR breadth, USD breadth, USD ex-EUR, DXY, rates differential, policy repricing, event surprises.
- Confirmation/regime: rolling correlations, volatility, intermarket and positioning.
- Execution: 6E delta, cumulative delta, VWAP, POC/VAH/VAL, imbalance, absorption, liquidity/session levels.

## Guardrails
The engine reports evidence and conflicts, not guaranteed direction. A high score requires independent evidence; DXY and EURUSD are not double-counted because EUR is 57.6% of DXY. Missing/stale feeds reduce confidence instead of being replaced with synthetic values.

## Chart strategy
Phase 1 uses the built-in live chart shell. For a TradingView-like professional UI, request TradingView Advanced Charts access and connect it to our own licensed datafeed. TradingView's library does not include market data and its proprietary package must not be committed publicly. Lightweight Charts is the open-source fallback.
