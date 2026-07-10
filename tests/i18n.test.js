import test from 'node:test';
import assert from 'node:assert/strict';
import { STR, fmt } from '../lib/i18n.js';

test('ko와 en의 키가 완전히 일치한다 — 한쪽만 있는 문구는 토글 시 구멍', () => {
  const ko = Object.keys(STR.ko).sort();
  const en = Object.keys(STR.en).sort();
  assert.deepEqual(ko, en);
});

test('fmt: {x} 자리표시자 치환', () => {
  assert.equal(fmt('{name}까지 {rem}km', { name: 'Adelaide', rem: 300 }), 'Adelaide까지 300km');
  assert.equal(fmt('없는 건 빈칸 {ghost}', {}), '없는 건 빈칸 ');
});

test('자리표시자 세트도 양 언어 동일 — 번역하다 변수 빠뜨리면 여기서 잡힘', () => {
  for (const k of Object.keys(STR.ko)) {
    const vars = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
    assert.deepEqual(vars(STR.ko[k]), vars(STR.en[k]), `키 "${k}"의 변수 불일치`);
  }
});
