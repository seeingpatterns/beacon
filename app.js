import { projectToRoute } from './lib/geo.js';
import { sunsetUTC } from './lib/sun.js';
import { SUPPLY, nextPoi, stopsWithReach } from './lib/plan.js';
import { pushCrumb, sosText } from './lib/beacon.js';

const $ = id => document.getElementById(id);
const state = { data: null, km: null, lat: null, lon: null };

// ---- 터미널 연출 ----
// 시스템 로그: 화면 아래 패널에 "> 메시지" 한 줄 추가 (최근 30줄만 유지)
function log(text, cls = '') {
  const box = $('console');
  const line = document.createElement('div');
  line.textContent = '> ' + text;
  if (cls) line.className = cls;
  box.appendChild(line);
  while (box.children.length > 30) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
}

// 시계 (1초 간격 — 배터리 부담 없음)
setInterval(() => { $('clock').textContent = new Date().toTimeString().slice(0, 8); }, 1000);

// 별똥별 매트릭스: 글자가 밝은 머리 + 초록 꼬리를 끌며 대각선으로 떨어진다.
// 부팅 후 2.5초만 돌고 정지 — 계속 돌리면 아웃백에서 제일 귀한 배터리를 태우기 때문.
(function bootMatrix() {
  const canvas = $('matrix');
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.clientWidth;
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const pick = () => CHARS[Math.floor(Math.random() * CHARS.length)];
  const stars = Array.from({ length: 12 }, () => ({
    x: Math.random() * (canvas.width + 80),
    y: Math.random() * -canvas.height,          // 화면 위 밖에서 출발
    v: 4 + Math.random() * 4,                    // 별마다 속도 다르게
  }));
  const stopAt = Date.now() + 2500;
  const timer = setInterval(() => {
    // 반투명 덮칠 = 이전 프레임이 서서히 사라지며 혜성 꼬리가 됨
    ctx.fillStyle = 'rgba(10,21,10,0.22)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '12px monospace';
    stars.forEach(s => {
      s.x -= s.v * 0.7; s.y += s.v;              // 대각선 낙하 = 별똥별 각도
      if (s.y > canvas.height + 16) { s.y = -12; s.x = Math.random() * (canvas.width + 80); }
      ctx.fillStyle = 'rgba(51,255,153,0.55)';   // 꼬리 글자 (머리 뒤쪽 위)
      ctx.fillText(pick(), s.x + s.v * 1.4, s.y - s.v * 2);
      ctx.fillStyle = '#EFFFF7';                 // 밝은 머리
      ctx.fillText(pick(), s.x, s.y);
    });
    if (Date.now() > stopAt) clearInterval(timer); // 마지막 프레임에서 정지
  }, 50);
})();

// ---- 데이터 로드 (서비스 워커 캐시에서 — 오프라인 동작) ----
const res = await fetch('./route-data.json');
state.data = await res.json();
$('data-note').textContent =
  `경로 ${state.data.totalKm.toFixed(0)}km · POI ${state.data.pois.length}개 · ` +
  `미확인 POI는 이름 옆 ⚠️ — 데이터 기준 ${state.data.generated.slice(0, 10)}`;
log('시스템 시작 — 오프라인 모드 준비 완료');
log(`경로 데이터 로드: ${state.data.totalKm.toFixed(0)}km · POI ${state.data.pois.length}개`);

// ---- 위치 ----
$('btn-gps').onclick = () => {
  $('pos-status').textContent = 'GPS 잡는 중… (하늘이 보이는 곳에서)';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const hit = projectToRoute(state.data.route, lat, lon);
    if (hit.offKm > 20) { // 틀린 안내 금지: 경로 밖에선 보급 계산을 하지 않는다
      $('off-route').classList.remove('hidden');
      $('pos-status').textContent = `경로에서 ${hit.offKm.toFixed(0)}km 벗어남`;
      log(`경로 이탈 감지: ${hit.offKm.toFixed(0)}km — 보급 계산 중단`, 'warn');
      // 단, 마지막 신호는 진짜 좌표를 기록한다 — 구조에 필요한 건 경로가 아니라 진실
      recordCrumb({ km: null, lat, lon, src: 'gps-offroute' });
      log('경로 밖이지만 SOS용 실제 좌표는 저장됨');
      return;
    }
    $('off-route').classList.add('hidden');
    state.km = hit.km; state.lat = lat; state.lon = lon;
    $('pos-status').textContent = `📍 경로상 ${hit.km.toFixed(0)}km 지점 (경로에서 ${hit.offKm.toFixed(1)}km)`;
    log(`GPS 고정: 경로 ${hit.km.toFixed(0)}km 지점`);
    recordCrumb({ km: hit.km, lat, lon, src: 'gps' });
    render();
  }, err => {
    $('pos-status').textContent = 'GPS 실패 — 아래에 km를 직접 입력하세요. (' + err.message + ')';
    log('GPS 실패: ' + err.message, 'err');
  },
  { enableHighAccuracy: true, timeout: 15000 });
};

// km 확정 공통 경로 — 위경도는 경로점에서 역산 (일몰 계산용)
function applyKm(v, statusText, src) {
  state.km = v;
  localStorage.setItem('nc.manualKm', String(v));
  const p = state.data.route.reduce((a, b) => Math.abs(b.km - v) < Math.abs(a.km - v) ? b : a);
  state.lat = p.lat; state.lon = p.lon;
  $('pos-status').textContent = statusText;
  recordCrumb({ km: v, lat: p.lat, lon: p.lon, src });
  render();
}

$('manual-km').oninput = e => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v)) applyKm(v, `⌨️ 수동 입력: ${v}km 지점`, 'manual');
};

// 표지판 모드: 라이더가 아는 건 "다음 도시까지 남은 km"다. 뺄셈은 앱이 한다.
state.data.pois.forEach(p => {
  const o = document.createElement('option');
  o.value = p.km; o.textContent = p.name;
  $('sign-poi').appendChild(o);
});
function applySign() {
  const rem = parseFloat($('sign-km').value);
  const poiKm = parseFloat($('sign-poi').value);
  if (Number.isNaN(rem) || Number.isNaN(poiKm)) return;
  const name = $('sign-poi').selectedOptions[0].textContent;
  const v = Math.round((poiKm - rem) * 10) / 10;
  if (v < 0) {
    $('pos-status').textContent = `⚠️ ${name}까지 ${rem}km면 경로 시작 전이에요 — 도시 선택을 확인하세요`;
    return;
  }
  applyKm(v, `🪧 ${name} ${rem}km 전 = 멜버른 기준 ${Math.round(v)}km 지점`, 'sign');
}
$('sign-poi').onchange = applySign;
$('sign-km').oninput = applySign;

$('speed').value = localStorage.getItem('nc.speed') || '18';
$('speed').oninput = e => { localStorage.setItem('nc.speed', e.target.value); render(); };

// ---- 판단 렌더 ----
function fmtPoi(p) {
  if (!p) return '앞에 없음';
  return `${p.distKm ?? (p.km - state.km).toFixed(0)}km · ${p.name}${p.verified ? '' : ' ⚠️'}`;
}

function render() {
  if (state.km == null) return;
  const { pois } = state.data;
  const speed = parseFloat($('speed').value) || 18;
  const sunset = sunsetUTC(new Date(), state.lat, state.lon);
  const hoursLeft = sunset ? (sunset.getTime() - Date.now()) / 3600000 : 0;

  $('next-water').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.water));
  $('next-food').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.food));
  $('next-shop').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.shop));
  $('sunset-left').textContent = hoursLeft > 0
    ? `${Math.floor(hoursLeft)}h ${Math.round(hoursLeft % 1 * 60)}m`
    : '해 졌음 — 라이딩 종료';

  $('stops').innerHTML = stopsWithReach(pois, state.km, hoursLeft, speed)
    .map(s => `<div class="row"><span>${s.name}${s.verified ? '' : ' <span class="warn-badge">⚠️미확인</span>'}</span>` +
      `<b class="${s.beforeSunset ? 'ok' : 'no'}">${s.distKm}km ${s.beforeSunset ? '✅' : '❌'}</b></div>`)
    .join('') || '<p class="sub">400km 안에 POI 없음</p>';

  $('verdict').classList.remove('hidden');
  $('stops-card').classList.remove('hidden');
}

// ---- 마지막 신호 (비상 위치 공유) ----
// GPS/수동 입력이 잡힐 때마다 위치를 자동 저장한다 — 블랙박스처럼.
// 전송은 못 한다(오프라인). 문자 초안만 만들고, 발사는 신호 잡힐 때 메시지 앱이 한다.
const loadCrumbs = () => JSON.parse(localStorage.getItem('nc.crumbs') || '[]');

function recordCrumb({ km, lat, lon, src }) {
  if (lat == null || lon == null) return;
  const crumb = { t: new Date().toISOString(), km, lat, lon, src };
  localStorage.setItem('nc.crumbs', JSON.stringify(pushCrumb(loadCrumbs(), crumb)));
  renderLastCrumb();
}

function renderLastCrumb() {
  const last = loadCrumbs().at(-1);
  if (!last) return;
  const when = new Date(last.t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const where = last.km != null ? `${Math.round(last.km)}km 지점` : '경로 밖 — GPS 좌표 저장됨';
  $('last-crumb').textContent = `마지막 기록: ${when} · ${where} (${loadCrumbs().length}개 저장됨)`;
}

function currentSosText() {
  // 우선순위: 가장 최근 기록(crumb) — 경로 이탈 GPS의 "진짜 좌표"가 수동입력 추정치보다 늦게 왔다면 그게 진실이다
  const last = loadCrumbs().at(-1);
  const p = last || (state.lat != null ? { km: state.km, lat: state.lat, lon: state.lon, t: new Date().toISOString() } : null);
  return p ? sosText(p) : null;
}

$('family-num').value = localStorage.getItem('nc.familyNum') || '';
$('family-num').oninput = e => localStorage.setItem('nc.familyNum', e.target.value.trim());

$('btn-sos-sms').onclick = () => {
  const text = currentSosText();
  if (!text) { log('보낼 위치가 없음 — 먼저 GPS를 잡으세요', 'err'); return; }
  const num = localStorage.getItem('nc.familyNum') || '';
  log('위치 문자 초안 생성 — 신호 잡히면 전송하세요', 'warn');
  location.href = `sms:${num}&body=${encodeURIComponent(text)}`; // iOS는 &body= 문법
};

$('btn-sos-copy').onclick = async () => {
  const text = currentSosText();
  if (!text) { log('복사할 위치가 없음 — 먼저 GPS를 잡으세요', 'err'); return; }
  await navigator.clipboard.writeText(text);
  log('위치 복사됨 — 아무 데나 붙여넣기 가능');
  $('btn-sos-copy').textContent = '✅ 복사됨';
  setTimeout(() => { $('btn-sos-copy').textContent = '📋 위치 복사'; }, 1500);
};

renderLastCrumb();

// ---- 초기 상태 복원 + 홈화면 안내 ----
if (window.navigator.standalone) $('install-tip').classList.add('hidden');
const savedKm = localStorage.getItem('nc.manualKm');
if (savedKm) { $('manual-km').value = savedKm; $('manual-km').dispatchEvent(new Event('input')); }

// ---- 오프라인 캐시 등록 ----
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
