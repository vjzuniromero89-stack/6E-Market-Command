# Opciones EUR/USD y su relación con el 6E

## Qué existe en CME

- [Calendario oficial de opciones Euro FX](https://www.cmegroup.com/markets/fx/g10/euro-fx.calendar.options.html): consultar la fecha de vencimiento y la serie efectivamente listada. El código mensual es EUU; los semanales de lunes a viernes tienen códigos propios. La [guía FX 2026](https://www.cmegroup.com/markets/fx/fx-product-guide.html) fija la hora habitual de expiración en 10:00 a. m. de Nueva York y el tamaño en 125.000 EUR por contrato.
- [Cotizaciones de opciones EUR/USD](https://www.cmegroup.com/markets/fx/g10/euro-fx.quotes.options.html): calls, puts y strikes disponibles para consulta en la web. Una página visible no es un permiso para integrarla automáticamente en otra aplicación.
- [Open Interest Profile](https://www.cmegroup.com/tools-information/quikstrike/options-open-interest-profile.html?pid=350): interés abierto y cambios por vencimiento. El interés abierto no identifica qué parte corresponde a market makers.
- [Boletín diario](https://www.cmegroup.com/market-data/daily-bulletin.html), página 39: strikes, delta, volumen e interés abierto, con fecha del día bursátil previo. Su publicación preliminar y final ocurre al día siguiente; no es un feed intradía.
- [CVOL](https://www.cmegroup.com/market-data/cme-group-benchmark-administration/cme-group-volatility-indexes.html): expectativa implícita de volatilidad a 30 días, no probabilidad de subida ni bajada.

## Cómo interpretarlo para el 6E

1. Identificar la **serie exacta**, su expiración y el **mes de futuro subyacente**. No comparar un strike con el spot EUR/USD ni con otro mes de 6E sin considerar la base entre ambos.
2. Comparar el strike con el precio de ese futuro y registrar por separado calls y puts, volumen de la sesión e interés abierto fechado. El interés abierto puede cambiar después del cierre y no es flujo en tiempo real.
3. Cerca de la expiración, un strike próximo al precio puede tener gamma elevada; el [fixing de CME](https://www.cmegroup.com/trading/fx/currfixprice.html) usa la ventana de 9:59:00 a 9:59:59 de Nueva York. Esto justifica una **alerta de riesgo de evento**, no una dirección garantizada.
4. La delta es exposición direccional; la gamma mide el cambio de delta. Si un dealer está largo de gamma, la cobertura *podría* vender subidas y comprar bajadas; si está corto, *podría* hacer lo contrario. La cadena pública no revela su cartera neta. El [interés abierto cuenta un comprador y un vendedor como un contrato](https://www.cmegroup.com/trading/about-volume.html), por lo que no permite asignar automáticamente un signo a la gamma del dealer.
5. Un “nivel de alto interés abierto” no es necesariamente soporte, resistencia o imán de precio. La actividad OTC EUR/USD tampoco queda completamente reflejada en una cadena listada de CME.

## Límite para la app

La tarjeta de la app enlaza las fuentes oficiales para consulta humana, **sin extraerlas ni copiar sus valores al motor**. Las [condiciones publicadas para los datos de la web CME](https://www.cmegroup.com/trading/about-volume.html) los presentan como referencia y restringen desarrollar productos basados en ese material. Para cálculos automáticos y almacenamiento hay que confirmar un derecho de uso apropiado. CME ofrece una [API de futuros y opciones](https://www.cmegroup.com/market-data/real-time-futures-and-options-data-api.html) y un servicio separado de [griegas e IV cada cinco minutos](https://www.cmegroup.com/market-data/greeks-and-implied-volatility-data.html); cobertura exacta, licencia y coste están pendientes de confirmar. NinjaTrader [no admite opciones en NinjaScript](https://ninjatrader.com/support/helpGuides/nt8/data_by_provider.htm), de modo que el actual conector 6E no es una vía de exportación de la cadena.

Hasta recibir un feed autorizado, el estado correcto del Options Engine es **SIN FEED** y su peso direccional en el Engine General es cero. Si se obtiene uno, primero se validarán procedencia, serie, mes subyacente, fecha, frescura y permiso; después se estudiará históricamente si sus variables añaden información para el horizonte negociado del 6E. Ninguna cifra de “gamma neta de MM” se publicará sin observar o identificar razonablemente el signo de sus posiciones.
