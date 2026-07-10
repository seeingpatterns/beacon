import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('sw.js의 ASSETS가 디스크의 실제 파일과 일치', () => {
  const src = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const m = src.match(/const ASSETS = \[([^\]]+)\]/);
  assert.ok(m, 'ASSETS 배열을 찾을 수 없음');
  const assets = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).filter(a => a !== './');
  assert.ok(assets.includes('./route-data.json'), '경로 데이터가 캐시 목록에 없음');
  assert.ok(assets.includes('./lib/sun.js'), 'sun.js가 캐시 목록에 없음');
  for (const a of assets) {
    assert.ok(existsSync(new URL('../' + a, import.meta.url)), `캐시 목록의 파일이 디스크에 없음: ${a}`);
  }
});
