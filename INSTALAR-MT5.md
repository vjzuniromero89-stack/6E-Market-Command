# INSTALAR MT5 LIVE — 6E Market Command

Esta entrega añade FOREX.com desde tu MT5 al dashboard. NinjaTrader/6E conserva su indicador, ruta, tokens y almacenamiento. MT5 intenta enviar un lote de los ocho pares cada segundo y la web intenta consultarlo cada segundo. Es muestreo HTTPS, no entrega de todos los ticks: red, carga, suspensión del navegador o descarga inicial de histórico pueden aumentar la demora. La pantalla muestra la edad del último tick; no cambia números artificialmente.

## 1. Actualiza GitHub/Vercel

Descomprime y reemplaza los archivos del repositorio con el ZIP completo. Node.js 24.x, npm ci, npm run build. No borres las variables actuales.

En Vercel → Settings → Environment Variables añade:

| Nombre | Valor |
|---|---|
| MARKET_CONTEXT_SOURCE | mt5 |
| MT5_INGEST_TOKEN | Una nueva clave aleatoria de 48 caracteres alfanuméricos, creada con tu gestor de contraseñas |

MT5_INGEST_TOKEN debe ser distinta de DASHBOARD_READ_TOKEN y NINJATRADER_INGEST_TOKEN. No es tu contraseña de FOREX.com. No uses NEXT_PUBLIC_. No publiques ni compartas su valor. Guarda en el entorno que despliegas y vuelve a desplegar.

Mantén UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, FEED_NAMESPACE, DASHBOARD_READ_TOKEN y NINJATRADER_INGEST_TOKEN. TWELVE_DATA_API_KEY puede permanecer: en modo mt5 no se consulta Twelve Data ni se gastan sus créditos. Si MARKET_CONTEXT_SOURCE no es mt5, la versión anterior con caché continúa seleccionada, para permitir volver atrás de forma controlada. No existe sustitución automática de datos MT5 por Twelve Data ante un fallo.

## 2. Instala el conector en MT5

1. En MT5: File → Open Data Folder.
2. Abre MQL5 → Experts. Copia allí mt5/MarketCommandFX.mq5 y mt5/MarketCommandFX.ex5 desde este ZIP.
3. Regresa a MT5. En Navigator → Expert Advisors, clic derecho → Refresh. Debe aparecer MarketCommandFX.
4. Tools → Options → Expert Advisors: habilita Allow WebRequest for listed URL y añade SOLO tu dominio HTTPS final de Vercel, por ejemplo https://tu-proyecto.vercel.app. No uses un dominio que redirija.
5. Abre un gráfico nuevo de EURUSD y arrastra MarketCommandFX a ese gráfico. Usa un gráfico dedicado para no sustituir otro EA existente.
6. En Inputs completa DashboardEndpoint con tu dominio final seguido de /api/mt5. Por ejemplo https://tu-proyecto.vercel.app/api/mt5.
7. En IngestToken introduce el mismo MT5_INGEST_TOKEN que guardaste en Vercel.
8. BrokerSymbols trae, EN ESTE ORDEN: EURUSD,GBPUSD,AUDUSD,USDJPY,USDCHF,USDCAD,EURGBP,EURJPY. Si tu broker usa sufijos, cambia cada nombre por el equivalente exacto de Market Watch, sin alterar el orden. El conector intenta añadirlos a Market Watch automáticamente; comprueba especialmente EURGBP y EURJPY.
9. Deja ServerUTCOffsetMinutes=9999 (detección automática) y RequestTimeoutMs=1500 inicialmente. La hora de Windows debe estar sincronizada.
10. Acepta. En el gráfico aparecerá el estado de envío. En Experts se muestran errores limitados, sin imprimir claves.

Instala una sola instancia para este dashboard. No adjuntes el EA a ocho gráficos. La clave queda en los parámetros de MT5; no compartas plantillas, perfiles ni capturas que la incluyan. No requiere DLL. El código no contiene llamadas para colocar/cerrar órdenes y no transmite número de cuenta, saldo, nombre ni contraseña. Solo lee el tipo live/demo para identificar la fuente. No necesitas habilitar operaciones automáticas para su lógica de lectura/temporizador; deja desmarcado Allow Algo Trading para este EA. WebRequest sí debe estar permitido.

El EX5 se compiló con MetaEditor local: 0 errores y 0 advertencias, X64 Regular. Si tu terminal solicita recompilar, abre el MQ5 en MetaEditor y pulsa F7. No se ejecuta en Strategy Tester porque WebRequest no está disponible allí.

## 3. Comprueba datos reales

- Abre la web e introduce tu DASHBOARD_READ_TOKEN habitual en el panel superior.
- La franja FX debe indicar MT5 / FOREX.com y CUENTA LIVE. Si aparece Twelve Data, revisa MARKET_CONTEXT_SOURCE y vuelve a desplegar.
- Compara EURUSD Bid/Ask entre Market Watch y el dashboard. El número principal es BID; ASK aparece en la descripción.
- Comprueba los ocho pares y su edad de tick. No todos deben cambiar cada segundo: depende de la llegada de precios del broker.
- Observa varios cambios consecutivos y compara la demora real. El envío y la consulta son ciclos independientes; espera latencia de red más hasta aproximadamente dos ciclos en condiciones normales, no latencia cero garantizada.
- Si retiras el EA o desconectas MT5, el panel debe marcar datos antiguos y retirar Strength en unos 10 segundos desde el último dato válido. A los 120 segundos el snapshot Redis caduca.
- Comprueba que NinjaTrader/6E sigue llegando por su conexión separada, cada 5 segundos como antes.

Deja MT5, el gráfico y la computadora encendidos y sin suspensión. Cerrar o desconectar el dashboard detiene sus consultas, pero NO detiene el envío del EA. Retira el EA del gráfico cuando no lo necesites.

## 4. Strength live

Se conserva el selector 15 min / 1 hora / día UTC. Ahora el numerador es el BID actual de cada tick muestreado, no un cierre de cinco minutos.

- 15 min y 1 hora: comparación con el cierre M1 que termina en el minuto UTC actual menos 15 o 60 minutos; por tanto, la duración efectiva es de 15m00s a 15m59s o de 1h00s a 1h00m59s. No pretende precisión histórica al segundo.
- Día UTC: BID frente al cierre M1 de las 00:00 UTC del día actual, no apertura Nueva York ni cierre diario del broker.
- Se exige continuidad de barras M1 hasta el minuto actual para cada referencia. Los huecos del histórico dejan esa ventana sin datos; no afectan la visualización del Bid/Ask disponible.
- Las referencias se calculan una vez al minuto en MT5. Durante el cambio de minuto puede aparecer SIN DATOS brevemente hasta recibir la nueva referencia. La descarga inicial de histórico también puede tardar.
- Se infiere el desfase del servidor desde TimeTradeServer y TimeGMT, redondeado a 15 minutos. Si existe error de reloj o desfase manual incorrecto, el conector se detiene o faltan referencias. El cambio horario del broker dentro de una ventana puede producir huecos; no se fuerza un valor.
- Históricos BID frente a BID actual, evitando mezclar mid-price con cierres BID. Si el símbolo no usa gráficos BID, no se calcula su histórico.
- Una cesta exige todos sus pares recientes (máximo 10 segundos desde su tick y envío). Se toma el último tick de cada par dentro del lote; no se afirma que todos ocurrieron simultáneamente.
- Banda neutral ±0,01%, inversión exacta de pares USD y cambio medio se conservan. La amplitud es descriptiva, no probabilidad ni señal operativa.

DXY, tasas, commodities y order flow avanzado siguen identificados DEMO. Confluence no se activa con datos ficticios.

## 5. Consumo y costos

No hay cuota Twelve Data en modo MT5. Sí hay tráfico Vercel/Upstash: un envío y una lectura por segundo son aproximadamente 7.200 invocaciones HTTP por hora para un navegador. Con 8 horas al día durante 22 días: 1.267.200 invocaciones para FX, más NinjaTrader. Cada navegador adicional agrega una lectura por segundo. Hay un SET atómico mediante Lua por envío (incluye GET/SET internos) y un GET por consulta; verifica cómo se contabilizan en tu plan.

Esto puede superar cuotas gratuitas. No se ha contratado ni actualizado ningún plan. Revisa Usage en Vercel y Upstash y configura alertas antes de dejarlo funcionando todo el día. Tarifas consultadas: Upstash pay-as-you-go publica US$0,20/100.000 comandos; el total depende de comandos facturados, horas, navegadores y plan. No se promete costo cero.

https://upstash.com/pricing/redis

## 6. Diagnóstico

- Esperando el primer envío: confirma EA, URL, permisos WebRequest y variables Vercel.
- HTTP 401: MT5_INGEST_TOKEN incorrecto, corto, igual a otro token o falta de acceso por protección de despliegue. La clave de lectura NO puede enviar datos.
- HTTP 400: JSON rechazado, reloj Windows fuera de sincronización o referencias inválidas. No cambies la zona horaria de Windows para arreglar el broker: sincroniza su reloj.
- HTTP 429: envíos demasiado próximos. Usa un solo EA.
- HTTP 503: revisar Redis y disponibilidad de Vercel.
- HTTP -1: falta URL permitida, conexión, TLS o timeout. Si el servidor responde lentamente, puede aumentarse RequestTimeoutMs hasta 5000; eso puede reducir la cadencia.
- Faltan pares: revisa los símbolos exactos y su disponibilidad en Market Watch.
- Precios presentes pero Strength vacío: falta histórico M1 completo o hay ticks antiguos. Abre temporalmente gráficos M1 de los pares afectados para descargar histórico.
- Todo queda antiguo aunque llegan envíos: revisa hora de Windows, zona del servidor y si el broker está enviando ticks nuevos; no refresques artificialmente su fecha.

El conector reintenta fallos con espera creciente de 2 a 30 segundos. Cuando MT5 no tiene conexión, deja de enviar; la web caduca los datos por edad. Nunca se detiene ni modifica el conector NinjaTrader.

Fuentes técnicas: https://www.mql5.com/en/docs/network/webrequest · https://www.mql5.com/en/docs/eventfunctions/eventsettimer · https://www.mql5.com/en/docs/series/copyrates · https://www.mql5.com/en/docs/dateandtime/timetradeserver
