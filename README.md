# 6E Market Command — NinjaTrader + Twelve Data

Proyecto completo para GitHub/Vercel. Conserva el diseño y la conexión NinjaTrader 6E. Añade contexto FX privado con caché persistente. No coloca órdenes.

## Actualizar

1. Descomprime el ZIP y reemplaza los archivos del repositorio. Conserva package-lock.json.
2. Mantén las variables y el dominio actuales de NinjaTrader/Upstash. No reinstales el indicador ni cambies su endpoint.
3. Confirma TWELVE_DATA_API_KEY en las variables del servidor de Vercel y vuelve a desplegar. Nunca uses NEXT_PUBLIC_ para claves.
4. Vercel: Next.js, Node.js 24.x, instalación `npm ci`, compilación `npm run build`. Los archivos del ZIP están en la raíz.
5. Introduce tu DASHBOARD_READ_TOKEN habitual en la web: conecta tanto NinjaTrader como FX. La API key de Twelve Data nunca se introduce en el navegador.

Consulta TWELVE-DATA.md para caché, metodología, variables y diagnóstico. CONEXION-NINJATRADER.md documenta el conector existente.

## Verificar

`npm ci`, `npm test`, `npm run build`.

Las pruebas usan respuestas simuladas, sin consumir créditos. No certifican una conexión real a tu cuenta Twelve Data, Upstash ni NinjaTrader. El build funciona sin variables; en ese estado la interfaz muestra ausencia de datos.

## Contenido

- API y bridge de NinjaTrader originales, con pruebas de regresión.
- /api/market-context: lectura autenticada, ocho pares, cuotas y caché compartidas.
- USD Strength y EUR Strength calculados a partir de cotizaciones válidas.
- DXY, tasas, commodities y order flow avanzado identificados como DEMO. Confluence desactivada hasta integrar sus entradas reales.
- Sin archivos .env (tampoco .env.example), claves reales, node_modules, .next ni .git.

Dependencias originales conservadas. No se despliega ni se modifica GitHub automáticamente.
