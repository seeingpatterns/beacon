import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPLY } from '../lib/plan.js';

const data = JSON.parse(readFileSync(new URL('../route-data.json', import.meta.url), 'utf8'));

test('route km 단조증가 + 시작 0', () => {
  assert.equal(data.route[0].km, 0);
  for (let i = 1; i < data.route.length; i++) {
    assert.ok(data.route[i].km > data.route[i - 1].km, `index ${i}`);
  }
});

test('총거리 3,300~3,900km (멜버른→GOR→애들레이드→퍼스)', () => {
  assert.ok(data.totalKm > 3300 && data.totalKm < 3900, `totalKm=${data.totalKm}`);
});

test('POI km가 경로 범위 안 + 정렬', () => {
  for (let i = 0; i < data.pois.length; i++) {
    const p = data.pois[i];
    assert.ok(p.km >= 0 && p.km <= data.totalKm, p.name);
    if (i > 0) assert.ok(p.km >= data.pois[i - 1].km, p.name);
    assert.ok(['water', 'roadhouse', 'town', 'supermarket', 'camp'].includes(p.type), p.name);
    assert.equal(typeof p.verified, 'boolean', p.name);
  }
});

test('물 보급 간격 상한 250km (초과 = 데이터 구멍)', () => {
  const waters = data.pois.filter(p => SUPPLY.water.includes(p.type));
  assert.ok(waters[0].km < 250, '첫 보급이 너무 멂');
  for (let i = 1; i < waters.length; i++) {
    const gap = waters[i].km - waters[i - 1].km;
    assert.ok(gap <= 250, `${waters[i - 1].name} → ${waters[i].name} 간격 ${gap.toFixed(0)}km`);
  }
});
