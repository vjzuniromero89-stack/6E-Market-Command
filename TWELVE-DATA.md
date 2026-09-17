# Strength por periodos — Twelve Data

## Qué cambió

La versión anterior interpretaba la variación de una sola vela como fortaleza general. Ahora se calculan retornos históricos de 15 minutos, 1 hora y día UTC. La vista inicial es 1 hora. El selector no hace solicitudes adicionales al proveedor.

## Datos y cálculo

Una solicitud batch a /time_series con interval=5min, outputsize=400, timezone=UTC y order=desc obtiene los ocho pares. Son 8 créditos por lote; el número de velas no multiplica el coste por símbolo. Se mantienen las consultas cada 20 minutos (máximo normal 576 créditos/día), presupuesto adicional de 768/día, bloqueo Redis compartido y cero WebSockets.

Solo se usan velas finalizadas según su hora de apertura UTC más cinco minutos. El precio mostrado es el cierre de esa vela, no un tick actual. Todos los pares disponibles se alinean al menor de sus cierres más recientes; se exige una vela exacta en ese instante. Cada retorno compara cierres: 100 × (cierre final / cierre de referencia − 1). No usa percent_change de quote.

- 15 min: cierre final frente al cierre exactamente 15 minutos antes.
- 1 hora: cierre final frente al cierre exactamente 60 minutos antes.
- Día UTC: cierre final frente al cierre a las 00:00 UTC del mismo día. NO representa la apertura de Nueva York, Londres ni el rollover del broker.

Se exige continuidad de todas las velas de cada ventana, incluido el cierre de referencia. Si falta una barra o el histórico no alcanza, esa ventana queda sin datos. No se cruza un fin de semana ni se interpola. Una cesta requiere todos sus componentes, con la misma referencia y cierre final.

USD: EUR/USD, GBP/USD y AUD/USD invertidos; USD/JPY, USD/CHF, USD/CAD directos. EUR: EUR/USD, EUR/GBP, EUR/JPY directos. Inversión exacta: 100 × (1 / (1 + cambio/100) − 1).

Amplitud: cada retorno orientado mayor que +0,01% aporta 1; menor que −0,01%, 0; entre ambos inclusive, 0,5. Score = 100 × suma / cantidad de pares. Esta banda neutral es una elección descriptiva de diseño, no un umbral validado de trading. Se muestra además el cambio medio orientado y el número de componentes positivos, neutrales y negativos. El porcentaje de amplitud no mide probabilidad ni magnitud.

Más de 50 = STRONG; menos de 50 = WEAK; 50 = NEUTRAL. Distintos periodos pueden mostrar direcciones opuestas. El resultado describe una ventana histórica al momento de consulta y no debe interpretarse como una señal en tiempo real. Las horas de referencia y de cierre se muestran en la zona local del navegador, indicando que el día comienza en UTC.

Los datos o consultas de más de 30 minutos se marcan antiguos y se excluyen de Strength. Tras el cambio de día UTC, la vista de día queda pendiente hasta recibir el histórico nuevo. No se inventan valores.

## Despliegue y compatibilidad

Reemplaza los archivos del repositorio por este ZIP completo y despliega. Conserva todas las variables actuales: TWELVE_DATA_API_KEY, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, DASHBOARD_READ_TOKEN, NINJATRADER_INGEST_TOKEN y FEED_NAMESPACE. Nunca uses NEXT_PUBLIC_ para secretos. No cambies el indicador ni el endpoint NinjaTrader.

Se usa una nueva instantánea :snapshot:strength-v3, conservando las claves :cooldown y :budget del despliegue anterior. Puede requerir hasta 20 minutos para obtener el primer lote; NO borres Redis para forzarlo. Producción y previews con la misma API key deben compartir la misma base Redis. Otros programas con esa API key consumen cuota fuera de este control.

La API exige el token de lectura habitual y evita caché HTTP pública. La API key se usa solo en servidor. Sin Redis se bloquean nuevas consultas al proveedor. Los errores del proveedor no revelan secretos y no disparan reintentos inmediatos. El ZIP no contiene .env, claves reales ni dependencias instaladas.

DXY, tasas, commodities y order flow avanzado continúan DEMO y excluidos del cálculo. Confluence sigue desactivada. Las rutas NinjaTrader, su almacenamiento y el bridge permanecen sin cambios.

## Diagnóstico

- not_configured: falta TWELVE_DATA_API_KEY.
- storage_unavailable: revisar Upstash.
- cooldown: espera activa, también puede ser posterior a un fallo.
- daily_budget: presupuesto agotado hasta cambio de día UTC.
- provider_or_cache_unavailable: fallo del proveedor, respuesta inválida, timeout o guardado fallido.
- SIN DATOS en un solo periodo: revisar cobertura histórica y fechas; otra ventana puede seguir disponible.

## Fuentes

https://twelvedata.com/docs — time_series, intervalos, outputsize y horas de apertura.
https://support.twelvedata.com/en/articles/5615854-credits — coste por símbolo y cuotas.
https://support.twelvedata.com/en/articles/5745849-timezones — timezone explícito.
https://twelvedata.com/pricing — permisos del plan: confirma con el proveedor la licencia de visualización antes de distribuir cotizaciones a terceros.
