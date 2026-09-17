# 6E Market Command — MT5 Live + NinjaTrader

Empieza por **INSTALAR-MT5.md**. Incluye los pasos de Vercel, el conector compilado para MT5 y la comprobación de precios.

- NinjaTrader/6E: indicador, API, almacenamiento y cadencia originales conservados.
- FOREX.com por MT5: lote de ocho pares con objetivo de envío y consulta de 1 segundo, sujeto a conexión y ticks reales.
- Bid/Ask, edad del tick, identificación live/demo y Strength 15 min / 1 hora / día UTC con referencias históricas M1.
- Fuente seleccionada con MARKET_CONTEXT_SOURCE=mt5. Sin esa variable sigue Twelve Data; en modo MT5 no se consume Twelve Data ni se mezclan fuentes ante fallos.
- Conector de lectura: no coloca órdenes ni exporta credenciales, saldos o número de cuenta.
- Paquete completo con fuente MQ5 y compilado EX5, sin .env ni secretos. No se incluye node_modules, .next ni .git.

Vercel: Node.js 24.x, npm ci, npm run build. Pruebas: npm test.

La conexión real requiere instalar el EA, permitir WebRequest, añadir MT5_INGEST_TOKEN y MARKET_CONTEXT_SOURCE en Vercel, y mantener MT5 abierto. Este ZIP no instala el EA en tu cuenta, modifica credenciales ni contrata servicios automáticamente.

La cadencia de 1 segundo aumenta el consumo Vercel/Upstash; consulta la estimación de INSTALAR-MT5.md. Las pruebas locales y la compilación no sustituyen la validación en tu despliegue real.

CONEXION-NINJATRADER.md documenta la conexión 6E existente; TWELVE-DATA.md documenta la alternativa anterior con caché. VERIFICACION.md detalla qué se probó.
