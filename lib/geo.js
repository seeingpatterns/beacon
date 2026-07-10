// 지구를 구로 근사한 거리·투영 계산. 앱의 모든 "몇 km" 숫자가 여기서 나온다.
const R = 6371; // 지구 반지름 km
const rad = Math.PI / 180;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// GPS 점을 경로 폴리라인의 최근접 세그먼트에 수직으로 내려 "경로상 km"로 바꾼다.
// 수십 km 스케일에선 도(degree) 평면 근사로 충분 (경도는 cos(lat) 보정).
export function projectToRoute(route, lat, lon) {
  let best = { km: 0, offKm: Infinity };
  const cosLat = Math.cos(lat * rad);
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const ax = (a.lon - lon) * cosLat, ay = a.lat - lat;
    const bx = (b.lon - lon) * cosLat, by = b.lat - lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : -(ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t)); // 세그먼트 밖이면 끝점으로
    const px = ax + t * dx, py = ay + t * dy;
    const offKm = Math.sqrt(px * px + py * py) * (Math.PI * R / 180); // 1도 ≈ 111.2km
    if (offKm < best.offKm) best = { km: a.km + t * (b.km - a.km), offKm };
  }
  return best;
}
