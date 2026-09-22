import { diagnoseFxCoverage } from './fx-coverage.mjs';

// Facts from connected engines only. This is not a trading signal or a probability.
export function buildDailyBrief(general, { market, period = '1h', now } = {}) {
  const items = [];
  if (Number.isFinite(general.sixEChangePercent)) {
    const direction = general.sixEDirection === 'up' ? 'sube' : general.sixEDirection === 'down' ? 'baja' : 'no cambia';
    items.push({ label: '6E reciente', text: `El 6E ${direction} ${Math.abs(general.sixEChangePercent).toFixed(3)}% frente a la apertura de su barra actual.`, tone: general.sixEDirection });
  } else {
    items.push({ label: '6E', text: 'No hay una lectura reciente verificable del 6E.', tone: 'unavailable' });
  }
  if (general.fxReady) {
    const eur = general.eur.net > 0 ? 'se fortalece' : general.eur.net < 0 ? 'se debilita' : 'está equilibrado';
    const usd = general.usd.net > 0 ? 'se fortalece' : general.usd.net < 0 ? 'se debilita' : 'está equilibrado';
    const implication = general.fxBias === 'up' ? 'el contexto FX favorece al euro frente al dólar' :
      general.fxBias === 'down' ? 'el contexto FX favorece al dólar frente al euro' : 'las dos cestas no dan una dirección conjunta';
    items.push({ label: 'EUR y USD', text: `En las cestas independientes, el EUR ${eur} y el USD ${usd}; ${implication}. Es amplitud de 12 cruces, no probabilidad.`, tone: general.fxBias });
  } else {
    items.push({ label: 'EUR y USD', text: `Sin lectura FX conjunta: ${diagnoseFxCoverage({ market, period, now })}`, tone: 'unavailable' });
  }
  if (general.integratedState === 'aligned_up' || general.integratedState === 'aligned_down')
    items.push({ label: 'Lectura conjunta', text: `La amplitud FX y el movimiento de la barra 6E coinciden ${general.integratedState === 'aligned_up' ? 'al alza' : 'a la baja'}. Coincidencia observada, no pronóstico.`, tone: general.sixEDirection });
  else if (general.integratedState === 'divergent')
    items.push({ label: 'Lectura conjunta', text: 'La amplitud FX y la barra 6E divergen; no se fuerza una señal.', tone: 'mixed' });
  else
    items.push({ label: 'Lectura conjunta', text: 'Aún no hay dos lecturas direccionales comparables de FX y 6E.', tone: 'unavailable' });
  for (const root of ['GC', 'CL']) {
    const move = general.intermarketMoves[root];
    const text = Number.isFinite(move?.changePercent)
      ? `${root} ${move.direction === 'up' ? 'sube' : move.direction === 'down' ? 'baja' : 'no cambia'} ${Math.abs(move.changePercent).toFixed(3)}% frente a su propia barra${move.alignedBar ? '; barra comparable con 6E' : '; barra no comparable con 6E'}.`
      : `${root} no tiene un movimiento reciente verificable.`;
    items.push({ label: root === 'GC' ? 'Oro futuro' : 'WTI futuro', text, tone: move?.direction || 'unavailable' });
  }
  items.push({ label: 'Tasas 2 años', text: general.rateSpread?.date
    ? `US 2Y − DE 2Y: ${general.rateSpread.value >= 0 ? '+' : ''}${general.rateSpread.value.toFixed(3)} pp al cierre ${general.rateSpread.date}; no es dato intradía.`
    : 'No hay un diferencial oficial de la misma fecha disponible.', tone: 'neutral' });
  items.push({ label: 'Opciones 6E', text: 'No hay fuente automática autorizada de series, vencimientos, OI, cambio de OI, volumen y liquidaciones. No se puede verificar si vence una opción hoy; opciones no vota.', tone: 'unavailable' });
  return { items, probability: null, entrySignal: false };
}
