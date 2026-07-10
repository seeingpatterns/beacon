import test from 'node:test';
import assert from 'node:assert/strict';
import { sunsetUTC } from '../lib/sun.js';

function minutesUTC(d) { return d.getUTCHours() * 60 + d.getUTCMinutes(); }

test('멜버른 2026-07-03 일몰 ≈ 17:15 AEST (07:15 UTC)', () => {
  const s = sunsetUTC(new Date('2026-07-03T00:00:00Z'), -37.8136, 144.9631);
  assert.ok(Math.abs(minutesUTC(s) - (7 * 60 + 15)) <= 10, `got ${s.toISOString()}`);
});

test('퍼스 2026-07-03 일몰 ≈ 17:22 AWST (09:22 UTC)', () => {
  const s = sunsetUTC(new Date('2026-07-03T00:00:00Z'), -31.9505, 115.8605);
  assert.ok(Math.abs(minutesUTC(s) - (9 * 60 + 22)) <= 10, `got ${s.toISOString()}`);
});

test('적도 낮 길이 ≈ 12시간 (일몰 - 일출 대칭성 간접검증)', () => {
  // 적도·경도0: 일몰은 정오(태양시) + 약 6시간 → 17:50~18:20 UTC 사이면 합격
  const s = sunsetUTC(new Date('2026-03-20T00:00:00Z'), 0, 0);
  const m = minutesUTC(s);
  assert.ok(m > 17 * 60 + 50 && m < 18 * 60 + 20, `got ${s.toISOString()}`);
});

test('남극 한겨울 = 극야 → null', () => {
  assert.equal(sunsetUTC(new Date('2026-06-21T00:00:00Z'), -85, 0), null);
});

test('회귀: 호주 현지 아침(퍼스 07:00 AWST)에도 hoursLeft는 양수 — UTC 날짜가 아직 안 넘어간 시각에 "어제" 일몰을 계산하던 버그 재현', () => {
  // 2026-07-03T23:00:00Z = 퍼스 현지 2026-07-04 07:00 (AWST = UTC+8).
  // UTC 달력 날짜만으로 고르면 아직 07-03이라 "어제(07-03)" 일몰(과거, 이미 13시간+ 지남)을 계산해버려
  // app.js의 hoursLeft = sunset - now 가 깊은 음수가 되고, 리스트 전부 beforeSunset:false로 표시됐다.
  const now = new Date('2026-07-03T23:00:00Z');
  const sunset = sunsetUTC(now, -31.9505, 115.8605);
  const hoursLeft = (sunset.getTime() - now.getTime()) / 3600000;
  assert.ok(hoursLeft > 0, `hoursLeft가 음수 — 아침에 "어제" 일몰을 계산 중: ${hoursLeft}`);
});
