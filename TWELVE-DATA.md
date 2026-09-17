# Contexto FX

## Variables del servidor

Configura solo en Vercel: `TWELVE_DATA_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DASHBOARD_READ_TOKEN`. Conserva también `NINJATRADER_INGEST_TOKEN` y `FEED_NAMESPACE`. Los tokens de lectura y envío deben ser distintos y de al menos 32 caracteres. No uses prefijos NEXT_PUBLIC_.

## Caché y presupuesto Basic 8

- Batch `/quote`: EUR/USD, GBP/USD, AUD/USD, USD/JPY, USD/CHF, USD/CAD, EUR/GBP, EUR/JPY. Cada lote cuesta 8 créditos, no 1.
- Refresco bajo demanda cada 20 minutos: hasta 72 lotes / 576 créditos por 24 horas. Sin visitantes autenticados no hay consultas nuevas.
- El navegador consulta nuestra API cada 60 segundos, nunca Twelve Data directamente.
- Upstash conserva el último resultado 7 días. Tras 30 minutos de antigüedad de la cotización o consulta se marca antiguo y se excluye del cálculo.
- Un script Redis atómico reserva 8 créditos ANTES de consultar, aplica 20 minutos de espera y contabiliza el consumo. La espera persiste aunque haya errores, timeout o respuestas parciales. No hay reintentos inmediatos.
- Límite adicional de 768 créditos por día UTC según el reloj Redis; el contador caduca tras 48 horas. La frecuencia normal ya limita a 576.
- Producción y previews con la misma API key deben compartir la MISMA base Redis. Las claves FX usan un hash de la API key, independientemente de FEED_NAMESPACE. No borres `6emc:td:v1:*`: reiniciarías la protección.
- Si Redis falla, NO se consulta al proveedor. No hay fallback a memoria local.
- WebSockets utilizados: 0. Los 8 créditos WS de prueba no garantizan acceso a estos ocho pares y no se utilizan en esta solución para Vercel.
- La protección solo cubre este proyecto y su Redis compartido. Otros programas o bases Redis consumen por separado la cuota de la misma cuenta.

## Strength

Cambio porcentual frente al cierre previo proporcionado por `/quote`. USD: EUR/USD, GBP/USD y AUD/USD invertidos; USD/JPY, USD/CHF y USD/CAD directos. EUR: EUR/USD, EUR/GBP y EUR/JPY directos. Inversión exacta: `100 × (1 / (1 + cambio/100) − 1)`.

Amplitud con pesos iguales: positivo aporta 1, plano 0.5, negativo 0. Score = 100 × suma / número de pares. Más de 50 = STRONG, menos de 50 = WEAK, 50 = NEUTRAL. Es dirección, no magnitud, probabilidad ni señal de entrada. La API incluye el cambio medio orientado.

Cada cesta requiere todos sus componentes recientes. Si falta uno o es antiguo, muestra SIN DATOS. Fuera de mercado puede aparecer ANTIGUO. La hora del proveedor y la hora de consulta se muestran por separado. No hay sustituciones con datos demo.

## Seguridad y compatibilidad

`GET /api/market-context` exige `Authorization: Bearer <DASHBOARD_READ_TOKEN>` y devuelve `Cache-Control: no-store, private`. No acepta símbolos, URLs ni frecuencia del cliente. No devuelve errores brutos, URLs con claves ni configuración. El token de lectura permanece solo en memoria de la pestaña y se elimina al desconectarse.

`/api/ninjatrader`, `lib/feed.mjs` y `ninjatrader/MarketCommandBridge.cs` permanecen sin cambios. FX usa otras claves Redis y no escribe en el snapshot 6E. LiveFeed comparte su token en memoria con el contexto FX.

## Diagnóstico

- 401: token de lectura incorrecto o no configurado.
- not_configured: falta TWELVE_DATA_API_KEY; vuelve a desplegar tras guardarla.
- storage_unavailable: revisa Upstash; se detiene el consumo por seguridad.
- cooldown: espera al siguiente intervalo; otro proceso reservó un lote o un intento falló.
- daily_budget: presupuesto agotado hasta cambiar el día UTC.
- provider_or_cache_unavailable: rechazo del proveedor, datos inválidos, timeout o fallo de guardado. Revisa el acceso de tu plan y el servicio, sin compartir claves.
- partial_or_stale: pares incompletos o antiguos; no se calcula una cesta incompleta.

## Fuentes

- https://twelvedata.com/docs — quote, campos y coste por símbolo.
- https://support.twelvedata.com/en/articles/5203360-batch-api-requests — batch.
- https://support.twelvedata.com/en/articles/5615854-credits — reinicio UTC.
- https://twelvedata.com/pricing — Basic y WS de prueba.

La tabla actual de Basic indica uso interno no destinado a visualización. Confirma con Twelve Data los permisos de visualización de tu cuenta antes de publicar cotizaciones para terceros. El endpoint permanece privado mediante token.
