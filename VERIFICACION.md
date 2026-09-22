# Verificación — MT5 Live

## Análisis conjunto en la tarjeta 6E — 22 de septiembre de 2026

- La tarjeta reúne EUR ex-USD, USD ex-EUR, movimiento directo del 6E, cambios porcentuales de las barras GC/CL y diferencial oficial US2Y–DE2Y. Si FX y la barra del 6E coinciden o divergen, lo explica textualmente.
- GC/CL se comparan con 6E solo cuando las marcas temporales de las barras son compatibles; muestra cuántos se mueven en el mismo sentido o en el contrario. No les asigna una correlación ni un voto predictivo sin historia comparable. Las tasas siguen siendo contexto diario.
- El porcentaje grande sigue siendo movimiento directo de la barra 6E. No hay probabilidad de dirección ni señal de entrada fabricada.
- `npm test`: 57/57 pruebas aprobadas. `npm run build`: compilación de producción correcta. No hubo prueba con las fuentes reales del usuario ni despliegue desde este entorno.

## Círculo 6E directo — 22 de septiembre de 2026

- El porcentaje central se calcula del precio 6E recibido frente a la apertura de la barra actual del mismo gráfico NinjaTrader. Verde indica precio por encima; rojo, por debajo; neutro, igual. El balance FX 0–100 permanece separado.
- El cálculo requiere una observación 6E reciente y verificada. Si faltan datos o el envío supera los 20 segundos, el círculo muestra `—`; ni GC/CL ni el EUR/USD spot rellenan ese hueco.
- Actualización de la pantalla: consulta NinjaTrader cada cinco segundos, sujeta a ticks, envío y red. El porcentaje no es probabilidad, pronóstico ni señal de entrada.
- `npm test`: 55/55 pruebas aprobadas. `npm run build`: compilación de producción correcta. No se confirmó el flujo con la cuenta NinjaTrader real del usuario desde este entorno.

## Integridad del contexto 6E — 22 de septiembre de 2026

- El círculo se rotula explícitamente `6E · CONTEXTO FX PARCIAL`; GC/CL son cotizaciones, no votos direccionales para 6E.
- El cálculo FX también comprueba la antigüedad de las observaciones y de la última lectura. El EUR/USD del cintillo superior se oculta si no llega una cotización MT5 live reciente.
- La captura del usuario mostró GC reciente, CL antiguo, 6E no verificado y FX sin cobertura completa. No se dedujo una señal ni una probabilidad de esa mezcla.
- `npm test`: 53/53 pruebas aprobadas. `npm run build`: compilación de producción correcta. No se verificó contra las cuentas o fuentes reales del usuario desde este entorno.

## Indicador circular del Engine General — 22 de septiembre de 2026

- Se agregó un círculo grande con `6E` en el centro. Muestra el balance FX de doce cruces en escala 0–100, con 50 como equilibrio. La dirección textual del contexto permanece separada de ese número.
- El porcentaje no es probabilidad de subida/bajada, ni mide todavía todos los motores; 6E, tasas, GC/CL y Bookmap aparecen como estados sin votos direccionales. Cuando faltan o caducan cruces FX live, se muestra `—`.
- `npm test`: 52/52 pruebas aprobadas. `npm run build`: compilación de producción correcta. El servidor local respondió HTTP 200 y entregó la estructura del círculo. La captura visual automatizada no pudo completarse en este entorno; queda pendiente verificar la apariencia y los datos con la cuenta real tras el despliegue.

## Primera etapa del Engine General — 22 de septiembre de 2026

- El sesgo FX usa exclusivamente seis cruces EUR sin EUR/USD y seis cruces USD sin EUR/USD, con la misma ventana y cierre. Solo MT5 en cuenta live puede producirlo; cuenta demo, Twelve Data, cobertura incompleta y ventanas desalineadas producen `SIN DATOS`.
- El 6E de NinjaTrader, tasas oficiales diarias e intermercado se informan por separado, sin convertirlos en votos direccionales. Bookmap permanece `BLOQUEADO` por la restricción de Python API en `6EZ6.CME@BMD`.
- No se generan señal de entrada, objetivo de pips ni probabilidad numérica. El índice USD estimado no se suma de nuevo al cálculo FX.
- `npm test`: 52/52 pruebas aprobadas. `npm run build`: compilación de producción correcta. No hubo despliegue ni prueba con las cuentas reales del usuario.

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

## Actualización DXY estimado y tasas — 22 de septiembre de 2026

- `npm test`: 38 de 38 pruebas aprobadas, incluidas las nuevas de seis cruces USD, caducidad, tasas y fecha común.
- `npm run build`: compilación correcta con `/api/official-rates`.
- MetaEditor: versión 1.30 de `MarketCommandFX.ex5`, compilada con **0 errores y 0 advertencias**.
- Tasas: fuentes oficiales Tesoro de EE. UU. y Bundesbank, ambos 2 años; el diferencial usa una observación diaria de la misma fecha dentro de 7 días. Después de la primera publicación, la captura del usuario mostró `Alemania source_error`. La API del Bundesbank respondió realmente en CSV con separador `;` y decimal `,`; el lector fue corregido y verificado contra ambas fuentes públicas el 22 de septiembre: EE. UU. 4,76 % con fecha 2026-09-21, Alemania 3,20 % como último dato de 2026-09-22 y diferencial **+1,55 puntos porcentuales** para la fecha común 2026-09-21 (Alemania 3,21 % ese día). **Aún falta verificar el nuevo despliegue en Cloudflare**.
- Índice USD: la fórmula pública de ICE se aplica a seis pares FOREX.com con punto medio bid/ask. **Es una estimación, no DXY oficial.** Falta comprobar que la cuenta FOREX.com del usuario ofrece `USDSEK` y que llegan seis ticks recientes. Si no, el índice permanece `UNAVAILABLE`.
- `npm run cf:build` no se pudo completar en Windows: OpenNext reportó acceso denegado al resolver un directorio raíz. No hay prueba de despliegue Cloudflare de esta versión.

## Ajuste de motores FX — 22 de septiembre de 2026

- `npm test`: 39 de 39 pruebas aprobadas. Cuando falta la referencia horaria de NZD/USD, USD Strength sigue `SIN DATOS`, pero se entrega un promedio **parcial 6/7** rotulado como tal y excluido de la puntuación y de cualquier señal. EUR conserva su cálculo completo cuando sus siete pares están presentes.
- Los siete spots de USD se movieron inmediatamente después del detalle principal; `USD ex-EUR` queda debajo de ellos. En la comprobación visual local, las filas EUR/USD de USD y EUR empezaron exactamente en la misma coordenada vertical y midieron 56 px de alto. No hubo error visible ni errores en la consola del navegador.
- `npm run build`: compilación de producción correcta. No cambió el ejecutable MT5; la actualización es solo de la página.
