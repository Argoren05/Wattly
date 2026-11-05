import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { TapoError } from './client';
import type { Appliance } from '../api/types';
import { autoSync, linkPlug, loadAccount, loadPlugs, loadSyncState, quarterStarts, saveAccount, savePlug, syncAll, toUsageEntries, type SyncDeps } from './sync';

const secure = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const NOW = new Date(2026, 10, 5, 21, 0); // 5 Nov 2026

beforeEach(async () => {
  secure.clear();
  await AsyncStorage.clear();
});

test('quarter starts: current and previous', () => {
  expect(quarterStarts(NOW)).toEqual([new Date(2026, 9, 1), new Date(2026, 6, 1)]);
  expect(quarterStarts(new Date(2026, 1, 10))).toEqual([new Date(2026, 0, 1), new Date(2025, 9, 1)]);
});

test('daily Wh become kWh entries up to today', () => {
  const start = new Date(2026, 10, 3).getTime() / 1000;
  expect(toUsageEntries({ startTimestamp: start, dailyWh: [1234, 0, 987.6, 500] }, NOW)).toEqual([
    { periodStart: '2026-11-03', periodEnd: '2026-11-03', energyKwh: 1.234 },
    { periodStart: '2026-11-04', periodEnd: '2026-11-04', energyKwh: 0 },
    { periodStart: '2026-11-05', periodEnd: '2026-11-05', energyKwh: 0.988 },
  ]);
});

/** Dependencies with plugs answering two quarters of data, or failing. */
function deps(failing: string[] = []): SyncDeps & { uploads: Record<string, number> } {
  const uploads: Record<string, number> = {};
  return {
    uploads,
    now: () => NOW,
    createClient: (host) => ({
      getDailyEnergy: async (start: Date) => {
        if (failing.includes(host)) throw new TapoError('unreachable', 'timeout');
        const days = start.getMonth() === 9 ? 36 : 92; // 1.10–5.11 and the whole Q3
        return { startTimestamp: start.getTime() / 1000, dailyWh: Array.from({ length: days }, () => 1000) };
      },
    }),
    upload: async (id, entries) => {
      uploads[id] = (uploads[id] ?? 0) + entries.length;
    },
  };
}

test('syncs every plug, uploads both quarters and records the result', async () => {
  await saveAccount({ email: ' jan@example.com ', password: 'Haslo123!' });
  await savePlug('a1', '192.168.1.50');
  await savePlug('a2', '192.168.1.51');
  const d = deps(['192.168.1.51']);

  const state = await syncAll(d);

  expect(d.uploads).toEqual({ a1: 128 });
  expect(state?.results).toEqual([
    { applianceId: 'a1', ok: true, days: 128 },
    { applianceId: 'a2', ok: false, days: 0, error: expect.stringMatching(/tej samej sieci Wi-Fi/) },
  ]);
  expect((await loadSyncState())?.at).toBe(NOW.toISOString());
  expect(await loadAccount()).toEqual({ email: 'jan@example.com', password: 'Haslo123!' });
});

test('nothing happens without an account or plugs; auto sync waits 6 hours', async () => {
  expect(await syncAll(deps())).toBeNull();
  await saveAccount({ email: 'a@b.pl', password: 'x' });
  expect(await syncAll(deps())).toBeNull();

  await savePlug('a1', '10.0.0.2');
  expect(await autoSync(deps())).not.toBeNull();
  expect(await autoSync(deps())).toBeNull(); // just synced
  const later = { ...deps(), now: () => new Date(NOW.getTime() + 7 * 3600_000) };
  expect(await autoSync(later)).not.toBeNull();

  await savePlug('a1', null);
  await saveAccount(null);
  expect(await loadPlugs()).toEqual({});
  expect(await loadAccount()).toBeNull();
});

test('linking a plug creates its appliance once and remembers the address', async () => {
  const account = { email: 'jan@example.com', password: 'x' };
  const created: Appliance = { id: 'a9', propertyId: 'p1', name: 'Pralka', source: 'Tapo', externalId: 'DEV1', model: 'P110', isHidden: false, lastUsageDate: null, createdAt: '' };
  const info = { deviceId: 'DEV1', model: 'P110', nickname: 'Pralka', hasEnergyMonitoring: true };
  const create = jest.fn(async () => created);
  let existing: Appliance[] = [];
  const deps = { createClient: () => ({ getDeviceInfo: async () => info }), list: async () => existing, create };

  expect(await linkPlug('p1', ' 192.168.1.50 ', account, deps)).toEqual({ appliance: created, created: true });
  expect(create).toHaveBeenCalledWith('p1', { name: 'Pralka', source: 'Tapo', externalId: 'DEV1', model: 'P110' });
  expect(await loadPlugs()).toEqual({ a9: { host: '192.168.1.50' } });

  existing = [created]; // same plug, new address after a router change
  expect(await linkPlug('p1', '192.168.1.77', account, deps)).toEqual({ appliance: created, created: false });
  expect(create).toHaveBeenCalledTimes(1);
  expect(await loadPlugs()).toEqual({ a9: { host: '192.168.1.77' } });

  const p100 = { ...deps, createClient: () => ({ getDeviceInfo: async () => ({ ...info, model: 'P100', hasEnergyMonitoring: false }) }) };
  await expect(linkPlug('p1', '192.168.1.80', account, p100)).rejects.toMatchObject({ kind: 'unsupported', message: expect.stringMatching(/P110 lub P115/) });
});
