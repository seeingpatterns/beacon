// NOAA 태양 위치 근사식 (https://gml.noaa.gov/grad/solcalc/solareqns.PDF)
// 정확도 ±수 분 — "일몰까지 몇 시간" 용도엔 충분. 순수 수학, 네트워크 0.
const rad = Math.PI / 180;

export function sunsetUTC(date, lat, lon) {
  // 어떤 "달력 날짜"의 일몰을 구할지는 UTC 날짜가 아니라 현지(경도 근사) 태양시 날짜로 정한다.
  // 호주는 UTC+8~+10.5라서, 현지 오전(UTC 날짜가 아직 안 넘어간 시간대)에 UTC 날짜만 쓰면
  // "어제" 일몰을 계산해버려 hoursLeft가 13시간 이상 음수로 나오는 버그가 생긴다.
  // 이후 삼각함수 계산(day-of-year, 균시차, 적위, 시간각)은 실제 date/lon을 그대로 쓴다 —
  // 여기서 바뀌는 건 "어느 날"을 고를지뿐이다.
  const localShifted = new Date(date.getTime() + (lon / 15) * 3600000);
  const y = localShifted.getUTCFullYear();
  const midnight = Date.UTC(y, localShifted.getUTCMonth(), localShifted.getUTCDate());
  const doy = Math.floor((midnight - Date.UTC(y, 0, 0)) / 86400000);
  const g = (2 * Math.PI / 365) * (doy - 1 + 0.5); // 연중 각도

  // 균시차(분): 시계 정오와 태양 정오의 차이
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  // 태양 적위(라디안): 계절에 따른 태양의 남북 위치
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
    - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
    - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);

  // 일몰 시각의 시간각 (90.833° = 대기굴절 + 태양 반지름 보정)
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl))
    - Math.tan(lat * rad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null; // 백야(해 안 짐) 또는 극야(해 안 뜸)

  const ha = Math.acos(cosHa) / rad; // 도
  const minutes = 720 - 4 * (lon - ha) - eqtime; // UTC 자정 기준 분
  return new Date(midnight + minutes * 60000);
}
