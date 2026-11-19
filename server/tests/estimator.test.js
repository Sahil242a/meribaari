import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blendAverage, etaMinutes } from '../src/services/estimator.js';

test('blendAverage leans on the default until there are 3 samples', () => {
  assert.equal(blendAverage([], 8), 8);
  assert.equal(blendAverage([2], 8), 6); // (2 + 8 + 8) / 3
  assert.equal(blendAverage([4, 6, 8, 10], 99), 7); // enough data, default ignored
});

test('etaMinutes with one counter and nobody being served', () => {
  const ctx = { avg: 10, counters: 1, serving: [] };
  assert.equal(etaMinutes(0, ctx), 0);
  assert.equal(etaMinutes(2, ctx), 20);
});

test('etaMinutes waits for the current consultation when all counters are busy', () => {
  const now = Date.now();
  const ctx = { avg: 10, counters: 1, serving: [{ calledAt: new Date(now - 4 * 60000) }], now };
  assert.equal(etaMinutes(0, ctx), 6); // 10 avg - 4 already spent
  assert.equal(etaMinutes(1, ctx), 16);
});

test('etaMinutes spreads people across counters', () => {
  const ctx = { avg: 10, counters: 2, serving: [] };
  assert.equal(etaMinutes(0, ctx), 0);
  assert.equal(etaMinutes(1, ctx), 0);
  assert.equal(etaMinutes(2, ctx), 10);
  assert.equal(etaMinutes(5, ctx), 20);
});
