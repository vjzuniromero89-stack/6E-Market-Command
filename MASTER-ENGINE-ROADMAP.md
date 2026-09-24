# 6E Master Engine

Esta versión incorpora la primera capa del Master Engine con 14 motores. Los motores existentes pueden votar sólo cuando tienen datos verificables; los demás aparecen como PENDIENTE y no afectan el score.

## Motores
6E Order Flow, EUR Strength, USD/DXY, cruces EUR, tasas/bonos, Fed, BCE, macro, noticias, calendario, COT/posicionamiento, técnico 6E, intermarket e histórico/calibración.

## Regla de probabilidad
El score de evidencia (-100 a +100) NO se presenta como probabilidad. La probabilidad arriba/abajo se habilita únicamente cuando exista una muestra histórica calibrada (mínimo técnico actual: 500 observaciones validadas). El rango esperado de ticks y horizonte también quedan bloqueados hasta disponer de una distribución histórica válida.

## Próxima fase
Conectar fuentes para Fed/BCE/macro/noticias/calendario/COT, ampliar NinjaTrader con delta/cumulative delta/VWAP/POC/imbalances/absorción, persistir snapshots y resultados en Supabase, y crear calibración por horizonte (scalp, intradía, 1-3 días).
