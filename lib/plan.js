// "오늘의 판단" 로직: 다음 보급이 어디고, 일몰 전에 어디까지 가나.
// roadhouse엔 물·음식이 있고, town엔 마트까지 있다는 도메인 지식을 여기 박는다.
export const SUPPLY = {
  water: ['water', 'roadhouse', 'town'],
  food: ['roadhouse', 'town', 'supermarket'],
  shop: ['supermarket', 'town'],
};

export function nextPoi(pois, currentKm, kinds) {
  let best = null;
  for (const p of pois) {
    if (p.km <= currentKm || !kinds.includes(p.type)) continue;
    if (!best || p.km < best.km) best = p;
  }
  return best;
}

export function reachableKm(currentKm, hoursLeft, speedKmh) {
  return currentKm + Math.max(0, hoursLeft) * speedKmh;
}

export function stopsWithReach(pois, currentKm, hoursLeft, speedKmh, lookaheadKm = 400) {
  const limit = reachableKm(currentKm, hoursLeft, speedKmh);
  return pois
    .filter(p => p.km > currentKm && p.km <= currentKm + lookaheadKm)
    .sort((a, b) => a.km - b.km)
    .map(p => ({ ...p, distKm: +(p.km - currentKm).toFixed(1), beforeSunset: p.km <= limit }));
}
