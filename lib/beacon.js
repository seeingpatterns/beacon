// 마지막 신호(비상 위치 공유) 로직 — 순수 함수만. DOM/저장은 app.js가 한다.
// 정직함 원칙: 이 코드는 아무것도 "전송"하지 못한다. 문자 초안을 만들 뿐이고,
// 실제 전송은 신호가 잡힐 때 iOS 메시지 앱이 한다.

export const CRUMB_CAP = 50; // 위치 기록 상한 — 오래된 것부터 버린다

export function pushCrumb(crumbs, crumb, cap = CRUMB_CAP) {
  return [...crumbs, crumb].slice(-cap);
}

export function sosText({ km, lat, lon, t }) {
  const latS = lat.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  const lonS = lon.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
  const lines = [
    '🆘 BEACON 위치 공유 (자전거 호주 횡단 중)',
    `시각: ${t}`,
  ];
  if (km != null) lines.push(`경로: Eyre Hwy 기점 ${Math.round(km)}km 지점`);
  lines.push(`좌표: ${latS}, ${lonS}`);
  lines.push(`지도: https://maps.google.com/?q=${latS},${lonS}`);
  return lines.join('\n');
}
