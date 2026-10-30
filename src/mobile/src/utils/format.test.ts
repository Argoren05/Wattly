/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatDate, parseDecimal, parseIsoDate, parseLocalDateTime } from './format.ts';
import { componentTemplate } from './rateTemplates.ts';

test('parseDecimal accepts comma and dot', () => {
  assert.equal(parseDecimal('1234,5'), 1234.5);
  assert.equal(parseDecimal(' 0.62 '), 0.62);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('12a'), null);
});

test('parseIsoDate rejects impossible dates', () => {
  assert.equal(parseIsoDate('2026-02-28'), '2026-02-28');
  assert.equal(parseIsoDate('2026-02-30'), null);
  assert.equal(parseIsoDate('30.10.2026'), null);
});

test('parseLocalDateTime returns ISO instant with offset', () => {
  const iso = parseLocalDateTime('2026-10-30 18:05');
  assert.ok(iso);
  assert.match(iso, /^2026-10-30T18:05:00[+-]\d{2}:\d{2}$/);
  assert.equal(new Date(iso).getHours(), 18);
  assert.equal(parseLocalDateTime('2026-10-30 25:00'), null);
});

test('formatDate converts ISO date to Polish format', () => {
  assert.equal(formatDate('2026-10-30'), '30.10.2026');
});

test('component template creates zone-specific energy rows without rates', () => {
  const rows = componentTemplate([
    { code: 'DAY', name: 'Dzienna', scheduleDescription: null },
    { code: 'NIGHT', name: 'Nocna', scheduleDescription: null },
  ]);
  const energy = rows.filter((r) => r.componentType === 'Energy');
  assert.deepEqual(energy.map((r) => r.zoneCode), ['DAY', 'NIGHT']);
  assert.ok(rows.every((r) => r.netRate === ''));
});
