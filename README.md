# 6E Market Command — conexión NinjaTrader 8

Proyecto web completo para GitHub/Vercel, con un panel privado que recibe instantáneas de un gráfico 6E Volumetric en NinjaTrader 8.

Empieza por **CONEXION-NINJATRADER.md**. Incluye la configuración de Vercel/Upstash, las claves privadas y la instalación del indicador de NinjaTrader. Subir el ZIP por sí solo no activa los datos.

## Verificación

- `npm run build`: completado correctamente.
- `node --test tests/feed.test.mjs`: 3 pruebas aprobadas (autenticación, validación y recepción/consulta con almacenamiento simulado).
- NinjaTrader y Upstash real: requieren configuración y prueba en tu entorno; no se han validado en vivo.

## Dependencias

Next.js 15.5.25, React/React DOM 19.1.9 y PostCSS 8.5.28 fijado mediante overrides. Conserva package-lock.json. Usa Node.js 24.x y `npm ci` antes de compilar.

## Contenido

- `app/`: dashboard y endpoint autenticado.
- `lib/`: validación y almacenamiento REST.
- `ninjatrader/MarketCommandBridge.cs`: indicador fuente para instalar en NinjaScript Editor.
- `.env.example`: nombres de variables, sin claves reales.
- `tests/`: pruebas del conector web.

El nuevo panel recibe precio, volumen, delta de barra y delta acumulado. Los paneles originales se mantienen como demostración explícita; sus señales, VWAP, POC, forex y otros mercados no están conectados. El código no coloca órdenes.

Las claves reales deben permanecer fuera de GitHub. El ZIP excluye node_modules, .next, .git y .env.local.
