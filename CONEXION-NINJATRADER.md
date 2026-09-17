# Conectar NinjaTrader 8 con 6E Market Command

Esta entrega contiene la web completa y el código fuente del indicador MarketCommandBridge. Debes configurar Vercel e instalar el indicador para activar los datos. No se conecta automáticamente al subir el ZIP.

## Qué conecta esta versión

Precio de 6E, volumen de la barra actual, delta de esa barra y delta acumulado que exponen las barras Volumetric. Usa la configuración de delta y sesión del gráfico. El delta acumulado puede diferir de otro indicador con configuración, filtros o histórico distintos.

El panel nuevo aparece encima del diseño original. El contexto FX de ocho pares se obtiene por separado de Twelve Data (ver TWELVE-DATA.md). DXY, tasas, oro, petróleo, VWAP, POC y señales avanzadas siguen marcados como DEMO. El precio de futuros 6E no se presenta como una cotización spot de EURUSD.

## 1. Subir a GitHub

Descomprime este ZIP y reemplaza los archivos del repositorio con su contenido. Mantén `package-lock.json`. Vercel usa Next.js, Node.js 24.x, instalación `npm ci` y compilación `npm run build`.

## 2. Almacenamiento compartido

La web publicada necesita guardar temporalmente el último envío para poder leerlo desde distintas instancias de Vercel. Esta versión usa Upstash Redis mediante HTTPS. No guarda el feed en la memoria de una función.

Crea una base Redis en Upstash o mediante su integración en Vercel. Revisa el plan y sus cuotas antes de activarlo. No se ha creado ni contratado ningún servicio por ti.

En Settings → Environment Variables del proyecto de Vercel agrega:

- `UPSTASH_REDIS_REST_URL`: la URL REST HTTPS de la base.
- `UPSTASH_REDIS_REST_TOKEN`: token REST de escritura de esa base.
- `NINJATRADER_INGEST_TOKEN`: clave aleatoria privada para enviar datos, mínimo 32 caracteres.
- `DASHBOARD_READ_TOKEN`: otra clave aleatoria distinta, mínimo 32 caracteres, para consultar el panel.
- `FEED_NAMESPACE`: `production`. Si conectas previews a la misma base, usa otro valor en esos entornos.

Genera las dos claves con un gestor de contraseñas (por ejemplo, 48 caracteres alfanuméricos). No uses la contraseña de NinjaTrader. No agregues prefijos NEXT_PUBLIC a estas variables. No subas claves a GitHub ni las compartas en capturas. Después de guardar las variables, vuelve a desplegar.

Con un gráfico activo se envía como máximo una instantánea cada 5 segundos y cada navegador conectado consulta cada 5 segundos. El consumo crece con el tiempo de uso y el número de navegadores. Cierra la conexión del panel cuando no la uses.

## 3. Instalar el indicador en NinjaTrader

1. Abre New → NinjaScript Editor.
2. Crea un indicador llamado exactamente `MarketCommandBridge` (clic derecho en Indicators → New Indicator).
3. En su editor, reemplaza el código generado por el contenido completo de `ninjatrader/MarketCommandBridge.cs` y compila con F5. NinjaTrader genera sus métodos auxiliares al compilar.
4. Abre tu gráfico de 6E con barras Volumetric, como el de tu captura. Selecciona el vencimiento que quieras seguir: el conector utiliza el contrato del gráfico y no lo cambia automáticamente.
5. Agrega `MarketCommandBridge` desde Indicators.
6. En Dashboard endpoint escribe `https://TU-PAGINA.vercel.app/api/ninjatrader` usando tu dirección real y definitiva, sin redirecciones.
7. En Ingest key introduce el mismo valor de `NINJATRADER_INGEST_TOKEN`. Deja el intervalo en 5 segundos y aplica.

Instálalo en un solo gráfico a la vez para este dashboard. Dos gráficos alimentando la misma clave mezclarían contratos o periodos. NinjaTrader puede guardar las propiedades del indicador en sus plantillas/workspaces: no compartas archivos que contengan la clave. El indicador no coloca órdenes ni consulta cuentas.

## 4. Ver los datos

Abre la web e introduce `DASHBOARD_READ_TOKEN` en el panel NinjaTrader. La clave se conserva solo en memoria de esa pestaña; al recargar debes introducirla de nuevo. La clave de lectura no puede enviar datos.

Compara contrato, precio, volumen y delta con el gráfico. Se envían instantáneas durante las actualizaciones en tiempo real, no cada operación individual ni datos históricos. Mantén NinjaTrader, su conexión y el gráfico abiertos. El estado «Recibiendo datos» confirma recepción reciente; no certifica por sí mismo que el proveedor esté entregando datos sin retraso o que no estés usando Playback.

Después de 20 segundos sin nuevos envíos aparece «Datos antiguos»; tras unos 120 segundos el almacenamiento caduca. Los valores antiguos nunca se sustituyen por números de ejemplo en el panel conectado. La web no calcula órdenes ni señales operativas a partir de este feed.

## Diagnóstico

- **Sin datos:** confirma que el gráfico recibe operaciones, el indicador está aplicado y el contrato es 6E Volumetric.
- **401:** verifica que la clave de envío y la de lectura coincidan con sus respectivas variables de Vercel. También puede indicar protección de acceso de Vercel; el endpoint necesita ser accesible al conector además de su autenticación propia.
- **400:** sincroniza la hora de Windows y comprueba los datos de la barra.
- **503:** revisa URL/token REST y disponibilidad de Upstash.
- **Error de envío:** New → NinjaScript Output muestra mensajes limitados a uno por minuto, sin claves. El indicador vuelve a intentar en futuras actualizaciones del gráfico y no bloquea el gráfico esperando la red.
- **Cambio de dominio:** actualiza el endpoint del indicador; no sigue redirecciones para evitar enviar claves a otro destino.

## Verificación y límites

La compilación web y las pruebas de validación/autenticación se ejecutan localmente. Las pruebas de almacenamiento usan un servidor simulado; no sustituyen una prueba con tu base Redis. El indicador debe compilarse y comprobarse en tu NinjaTrader: no se ha ejecutado ni validado contra tu instalación real. No se ha desplegado esta entrega ni modificado tu GitHub.

Fuentes: https://ninjatrader.com/support/helpGuides/nt8/order_flow_volumetric_bars2.htm y https://upstash.com/docs/redis/features/restapi

