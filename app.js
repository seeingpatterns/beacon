import { projectToRoute } from './lib/geo.js';
import { sunsetUTC } from './lib/sun.js';
import { SUPPLY, nextPoi, stopsWithReach } from './lib/plan.js';
import { pushCrumb, sosText } from './lib/beacon.js';
import { STR, fmt } from './lib/i18n.js';

const $ = id => document.getElementById(id);
const state = { data: null, km: null, lat: null, lon: null, basis: null, status: null };

// ---- 언어 (ko/en 토글 — SOS 문자는 토글 무관 항상 병기) ----
let lang = localStorage.getItem('nc.lang') || 'ko';
const T = (k, vars) => fmt(STR[lang][k] ?? k, vars);

// {k, v, ageT} → 현재 언어 문장. ageT가 있으면 "N분/시간 전"을 매번 새로 계산한다.
function resolve(kv) {
  const vars = { ...(kv.v || {}) };
  if (kv.ageT) {
    const m = Math.round((Date.now() - kv.ageT) / 60000);
    vars.age = m < 60 ? T('age_min', { m }) : T('age_hr', { h: Math.round(m / 60) });
  } else vars.age = '';
  return T(kv.k, vars);
}

function setStatus(kv) { state.status = kv; renderStatus(); }
function renderStatus() {
  $('pos-status').textContent = state.status ? resolve(state.status) : T('pos_checking');
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const s = STR[lang][el.dataset.i18n]; if (s != null) el.innerHTML = s;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const s = STR[lang][el.dataset.i18nPh]; if (s != null) el.placeholder = s;
  });
  $('manual-ko').classList.toggle('hidden', lang !== 'ko');
  $('manual-en').classList.toggle('hidden', lang !== 'en');
  $('lang-btn').textContent = lang === 'ko' ? 'EN' : '한국어';
  renderStatus();
  renderLastCrumb();
  renderDataNote();
  if (state.km != null) render();
}
$('lang-btn').onclick = () => {
  lang = lang === 'ko' ? 'en' : 'ko';
  localStorage.setItem('nc.lang', lang);
  applyLang();
};

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
function renderDataNote() {
  $('data-note').textContent = T('data_note', {
    total: state.data.totalKm.toFixed(0),
    n: state.data.pois.length,
    date: state.data.generated.slice(0, 10),
  });
}
renderDataNote();
log(T('log_start'));
log(T('log_data', { total: state.data.totalKm.toFixed(0), n: state.data.pois.length }));

// ---- 위치 ----
// 피곤한 사용자 원칙: 앱을 여는 것이 질문이다. 버튼은 재시도용일 뿐, GPS는 열자마자 자동 시작.
function locateGPS() {
  setStatus({ k: 'gps_fixing' });
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    const hit = projectToRoute(state.data.route, lat, lon);
    if (hit.offKm > 20) { // 틀린 안내 금지: 경로 밖에선 보급 계산을 하지 않는다
      $('off-route').classList.remove('hidden');
      setStatus({ k: 'st_offroute', v: { off: hit.offKm.toFixed(0) } });
      log(T('log_offroute', { off: hit.offKm.toFixed(0) }), 'warn');
      // 단, 마지막 신호는 진짜 좌표를 기록한다 — 구조에 필요한 건 경로가 아니라 진실
      recordCrumb({ km: null, lat, lon, src: 'gps-offroute' });
      log(T('log_offroute_saved'));
      // 옛 답이 떠 있으면 근거 줄을 경고로 교체 — "지금 위치" 답으로 오독 방지
      if (state.km != null) {
        state.basis = { k: 'basis_offroute', v: { km: Math.round(state.km) } };
        render();
      }
      return;
    }
    $('off-route').classList.add('hidden');
    state.km = hit.km; state.lat = lat; state.lon = lon;
    state.basis = { k: 'basis_gps', v: { km: hit.km.toFixed(0) } };
    setStatus({ k: 'st_gps_fixed', v: { km: hit.km.toFixed(0), off: hit.offKm.toFixed(1) } });
    log(T('log_gps_fixed', { km: hit.km.toFixed(0) }));
    recordCrumb({ km: hit.km, lat, lon, src: 'gps' });
    render();
  }, err => {
    // 자동 시도가 실패해도 마지막 기록 기준 답은 이미 화면에 있다 — 조용히 알리고 유지
    setStatus({ k: state.km != null ? 'gps_fail_stale' : 'gps_fail_input', v: { err: err.message } });
    log('GPS: ' + err.message, 'err');
  },
  { enableHighAccuracy: true, timeout: 15000 });
}
$('btn-gps').onclick = locateGPS;

// km 확정 공통 경로 — 위경도는 경로점에서 역산 (일몰 계산용)
function applyKm(v, statusKV, src) {
  state.km = v;
  state.basis = statusKV;
  localStorage.setItem('nc.manualKm', String(v));
  const p = state.data.route.reduce((a, b) => Math.abs(b.km - v) < Math.abs(a.km - v) ? b : a);
  state.lat = p.lat; state.lon = p.lon;
  setStatus(statusKV);
  recordCrumb({ km: v, lat: p.lat, lon: p.lon, src });
  render();
}

$('manual-km').oninput = e => {
  const v = parseFloat(e.target.value);
  if (!Number.isNaN(v)) applyKm(v, { k: 'st_manual', v: { km: v } }, 'manual');
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
    setStatus({ k: 'sign_invalid', v: { name, rem } });
    return;
  }
  applyKm(v, { k: 'st_sign', v: { name, rem, km: Math.round(v) } }, 'sign');
}
$('sign-poi').onchange = applySign;
$('sign-km').oninput = applySign;

$('speed').value = localStorage.getItem('nc.speed') || '18';
$('speed').oninput = e => { localStorage.setItem('nc.speed', e.target.value); render(); };

// ---- 판단 렌더 ----
function fmtPoi(p) {
  if (!p) return T('poi_none');
  return `${p.distKm ?? (p.km - state.km).toFixed(0)}km · ${p.name}${p.verified ? '' : ' ⚠️'}`;
}

function render() {
  if (state.km == null) return;
  // 답의 근거를 답 옆에 — 피곤한 사용자가 옛 위치 기준 답을 "지금"으로 오독하지 않게
  $('verdict-basis').textContent = state.basis ? T('basis_prefix') + resolve(state.basis) : '';
  const { pois } = state.data;
  const speed = parseFloat($('speed').value) || 18;
  const sunset = sunsetUTC(new Date(), state.lat, state.lon);
  const hoursLeft = sunset ? (sunset.getTime() - Date.now()) / 3600000 : 0;

  $('next-water').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.water));
  $('next-food').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.food));
  $('next-shop').textContent = fmtPoi(nextPoi(pois, state.km, SUPPLY.shop));
  $('sunset-left').textContent = hoursLeft > 0
    ? `${Math.floor(hoursLeft)}h ${Math.round(hoursLeft % 1 * 60)}m`
    : T('sunset_over');

  $('stops').innerHTML = stopsWithReach(pois, state.km, hoursLeft, speed)
    .map(s => `<div class="row"><span>${s.name}${s.verified ? '' : ` <span class="warn-badge">${T('unverified')}</span>`}</span>` +
      `<b class="${s.beforeSunset ? 'ok' : 'no'}">${s.distKm}km ${s.beforeSunset ? '✅' : '❌'}</b></div>`)
    .join('') || `<p class="sub">${T('stops_empty')}</p>`;

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
  const when = new Date(last.t).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-AU',
    { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const where = last.km != null ? T('crumb_km', { km: Math.round(last.km) }) : T('crumb_off');
  $('last-crumb').textContent = T('crumb_last', { when, where, n: loadCrumbs().length });
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
  if (!text) { log(T('sos_need_fix'), 'err'); return; }
  const num = localStorage.getItem('nc.familyNum') || '';
  log(T('log_sms_draft'), 'warn');
  location.href = `sms:${num}&body=${encodeURIComponent(text)}`; // iOS는 &body= 문법
};

$('btn-sos-copy').onclick = async () => {
  const text = currentSosText();
  if (!text) { log(T('copy_need_fix'), 'err'); return; }
  await navigator.clipboard.writeText(text);
  log(T('log_copied'));
  $('btn-sos-copy').textContent = T('btn_copied');
  setTimeout(() => { $('btn-sos-copy').textContent = T('btn_sos_copy'); }, 1500);
};

// ---- 초기 상태 복원 + 홈화면 안내 ----
if (window.navigator.standalone) $('install-tip').classList.add('hidden');
applyLang();

// 열자마자 대답한다: GPS를 기다리지 않고 마지막 기록 기준으로 먼저 판단을 띄운다.
// (새 crumb은 기록하지 않는다 — 복원은 이동이 아니다)
(function restoreLast() {
  const last = [...loadCrumbs()].reverse().find(c => c.km != null);
  const savedKm = parseFloat(localStorage.getItem('nc.manualKm'));
  const km = last ? last.km : (Number.isNaN(savedKm) ? null : savedKm);
  if (km == null) return;
  state.km = km;
  const p = state.data.route.reduce((a, b) => Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a);
  state.lat = last ? last.lat : p.lat;
  state.lon = last ? last.lon : p.lon;
  $('manual-km').value = km;
  const ageT = last ? new Date(last.t).getTime() : null;
  state.basis = { k: 'basis_restore', v: { km: Math.round(km) }, ageT };
  setStatus({ k: 'st_restore', ageT });
  render();
})();

// GPS 자동 시작 — 피곤한 사용자는 버튼을 누르지 않는다
locateGPS();

// ---- 오프라인 캐시 등록 ----
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
