# Verificación — MT5 Live

17 de septiembre de 2026. Node.js 24.20.0 / Next.js 15.5.25.

- npm test: 27 pruebas aprobadas, incluidas las pruebas anteriores de NinjaTrader y Twelve Data.
- npm run build: compilación de producción correcta, rutas /api/mt5, /api/market-context y /api/ninjatrader presentes.
- MetaEditor: MarketCommandFX.ex5 compilado desde el MQ5 incluido, 0 errores y 0 advertencias, X64 Regular.
- Validación de autenticación independiente, tamaño y esquema del mensaje, relojes, precios, duplicados, repetición de mensajes, frecuencia de escritura, caducidad, referencias históricas y aislamiento de Twelve Data en modo MT5. Redis/proveedores simulados.
- Edge/Playwright: consultas FX consecutivas separadas por 1002, 1005 y 998 ms; estados reciente/antiguo/sin datos, cambio de periodo, desconexión y panel NinjaTrader independiente. Escritorio 1440 px y móvil 390 px sin desbordamiento ni errores JavaScript. Respuestas simuladas; esta medición no representa latencia real del broker.
- API NinjaTrader, lib/feed.mjs e indicador comparados por SHA-256 con el ZIP original y conservados idénticos.
- Sin nuevas dependencias. La auditoría de la entrega base reportó 0 vulnerabilidades; no se realizó una nueva consulta de auditoría en esta revisión.
- ZIP completo sin .env, claves reales, node_modules, .next, .git ni archivos temporales.

No se instaló ni ejecutó el EA en la cuenta del usuario; no se enviaron órdenes, no se consultaron claves y no se desplegó. La compilación no sustituye la prueba con el terminal y Redis reales. Tras instalar, seguir INSTALAR-MT5.md para comparar Bid/Ask, edad de tick, referencias, desconexión y continuidad de NinjaTrader. La frecuencia objetivo es un segundo; la entrega depende del broker, terminal, red, almacenamiento y navegador. Vercel/Redis pueden generar cargos por el volumen de solicitudes explicado en la guía.
