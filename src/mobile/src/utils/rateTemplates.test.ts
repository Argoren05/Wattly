/** Tests of the price list template. */
import { componentTemplate, unitLabel } from './rateTemplates';

describe('componentTemplate', () => {
  test('creates zone-specific energy rows for multi-zone tariffs, without rates', () => {
    const rows = componentTemplate([
      { code: 'DAY', name: 'Dzienna', scheduleDescription: null },
      { code: 'NIGHT', name: 'Nocna', scheduleDescription: null },
    ]);

    expect(rows.filter((r) => r.componentType === 'Energy').map((r) => r.zoneCode)).toEqual(['DAY', 'NIGHT']);
    expect(rows.every((r) => r.netRate === '')).toBe(true);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  test('single-zone tariff has one energy and one variable distribution row', () => {
    const rows = componentTemplate([]);

    expect(rows.filter((r) => r.componentType === 'Energy')).toHaveLength(1);
    expect(rows.filter((r) => r.zoneCode !== null)).toHaveLength(0);
    expect(rows.find((r) => r.name === 'Opłata handlowa')?.componentType).toBe('Subscription');
  });

  test('unit labels exist for every unit', () => {
    expect(Object.keys(unitLabel)).toEqual(['Kwh', 'Month', 'Day', 'Kw']);
  });
});
