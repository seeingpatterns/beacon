import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPLY, nextPoi, reachableKm, stopsWithReach } from '../lib/plan.js';

const POIS = [
  { name: 'Caiguna', type: 'roadhouse', km: 100, verified: true },
  { name: '급수탱크', type: 'water', km: 150, verified: false },
  { name: 'Balladonia', type: 'roadhouse', km: 280, verified: true },
  { name: 'Norseman', type: 'town', km: 470, verified: true },
];

test('nextPoi: 현재 지점 앞의 가장 가까운 물', () => {
  const p = nextPoi(POIS, 120, SUPPLY.water);
  assert.equal(p.name, '급수탱크');
});

test('nextPoi: 마트는 town만 매치', () => {
  const p = nextPoi(POIS, 0, SUPPLY.shop);
  assert.equal(p.name, 'Norseman');
});

test('nextPoi: 앞에 없으면 null', () => {
  assert.equal(nextPoi(POIS, 480, SUPPLY.water), null);
});

test('reachableKm: 3시간 × 18km/h = +54km', () => {
  assert.equal(reachableKm(100, 3, 18), 154);
});

test('reachableKm: 일몰 지났으면(음수) 전진 0', () => {
  assert.equal(reachableKm(100, -1, 18), 100);
});

test('stopsWithReach: 일몰 전 도달 가능 여부 판정', () => {
  const stops = stopsWithReach(POIS, 90, 3, 18); // 한계 = 144km
  assert.equal(stops[0].name, 'Caiguna');
  assert.equal(stops[0].distKm, 10);
  assert.equal(stops[0].beforeSunset, true);
  assert.equal(stops[1].name, '급수탱크');
  assert.equal(stops[1].beforeSunset, false);
});
