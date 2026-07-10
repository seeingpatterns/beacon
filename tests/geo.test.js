import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, projectToRoute } from '../lib/geo.js';

test('haversineKm: 위도 1도 ≈ 111.2km', () => {
  const d = haversineKm(0, 0, 1, 0);
  assert.ok(Math.abs(d - 111.2) < 0.5, `got ${d}`);
});

test('haversineKm: 같은 점 = 0', () => {
  assert.equal(haversineKm(-31.5, 129.0, -31.5, 129.0), 0);
});

const ROUTE = [
  { km: 0, lat: 0, lon: 0 },
  { km: 111.2, lat: 1, lon: 0 },
  { km: 222.4, lat: 2, lon: 0 },
];

test('projectToRoute: 경로 중간점에 투영', () => {
  const { km, offKm } = projectToRoute(ROUTE, 0.5, 0.1);
  assert.ok(Math.abs(km - 55.6) < 2, `km=${km}`);
  assert.ok(Math.abs(offKm - 11.1) < 1, `offKm=${offKm}`);
});

test('projectToRoute: 경로 시작 전 점은 km 0으로 클램프', () => {
  const { km } = projectToRoute(ROUTE, -0.5, 0);
  assert.equal(km, 0);
});

test('projectToRoute: 경로 위의 점은 offKm ≈ 0', () => {
  const { offKm } = projectToRoute(ROUTE, 1, 0);
  assert.ok(offKm < 0.1, `offKm=${offKm}`);
});
