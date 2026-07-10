import test from 'node:test';
import assert from 'node:assert/strict';
import { pushCrumb, sosText, CRUMB_CAP } from '../lib/beacon.js';

test('pushCrumb: 추가되고 최신이 마지막', () => {
  const out = pushCrumb([], { t: '2026-07-10T01:00:00Z', km: 1200, lat: -31.5, lon: 129.0 });
  assert.equal(out.length, 1);
  assert.equal(out[0].km, 1200);
});

test('pushCrumb: 상한을 넘으면 오래된 것부터 버린다', () => {
  let crumbs = [];
  for (let i = 0; i < CRUMB_CAP + 10; i++) {
    crumbs = pushCrumb(crumbs, { t: `t${i}`, km: i, lat: 0, lon: 0 });
  }
  assert.equal(crumbs.length, CRUMB_CAP);
  assert.equal(crumbs[crumbs.length - 1].km, CRUMB_CAP + 9); // 최신 유지
  assert.equal(crumbs[0].km, 10); // 가장 오래된 10개 버려짐
});

test('sosText: 좌표·km·지도링크가 들어간다', () => {
  const txt = sosText({ km: 1240, lat: -31.55212, lon: 129.08137, t: '2026-07-10T01:12:00Z' });
  assert.ok(txt.includes('-31.55212'), '위도 누락');
  assert.ok(txt.includes('129.08137'), '경도 누락');
  assert.ok(txt.includes('1240'), 'km 지점 누락');
  assert.ok(txt.includes('maps.google.com/?q=-31.55212,129.08137'), '지도 링크 누락');
});

test('sosText: km를 모르면 km 줄 없이도 만들어진다', () => {
  const txt = sosText({ km: null, lat: -31.5, lon: 129.0, t: '2026-07-10T01:12:00Z' });
  assert.ok(txt.includes('-31.5'));
  assert.ok(!txt.includes('null'));
});
