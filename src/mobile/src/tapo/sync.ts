import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { applianceApi } from '../api/endpoints';
import type { Appliance, ApplianceRequest, ApplianceUsageEntry } from '../api/types';
import { toIsoDate } from '../utils/format';
import { TapoClient, TapoError, tapoErrorMessage, type TapoDailyEnergy } from './client';

// Synchronisation of Tapo plugs (DEC-034): the phone, when in the home Wi-Fi, reads the daily energy history the plug
// keeps (current and previous quarter) and uploads it as daily consumption entries. Re-sending a day replaces it on the
// server, so syncing often is safe. The Tapo password never leaves the phone.

/** Tapo account (secure storage on the phone only). */
export interface TapoAccount {
  email: string;
  password: string;
}

/** Address of a plug in the home network, per appliance. */
export type TapoPlugs = Record<string, { host: string }>;

/** Result of syncing one plug. */
export interface PlugSyncResult {
  applianceId: string;
  ok: boolean;
  /** Days uploaded. */
  days: number;
  error?: string;
}

/** Summary of the last synchronisation. */
export interface TapoSyncState {
  at: string;
  results: PlugSyncResult[];
}

/** Storage keys. */
export const TAPO_KEYS = { account: 'wattly.tapo.account', plugs: 'wattly.tapo.plugs', lastSync: 'wattly.tapo.lastSync' } as const;

/** Automatic sync runs at most this often (the plug keeps its history, so missing a day loses nothing). */
export const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Saved Tapo account, or null. */
export async function loadAccount(): Promise<TapoAccount | null> {
  try {
    const raw = await SecureStore.getItemAsync(TAPO_KEYS.account);
    const value = raw ? (JSON.parse(raw) as Partial<TapoAccount>) : null;
    return value?.email && value.password ? { email: value.email, password: value.password } : null;
  } catch {
    return null;
  }
}

/**
 * Saves (or with null removes) the Tapo account.
 * @param account E-mail and password.
 */
export async function saveAccount(account: TapoAccount | null): Promise<void> {
  if (account) await SecureStore.setItemAsync(TAPO_KEYS.account, JSON.stringify({ email: account.email.trim(), password: account.password }));
  else await SecureStore.deleteItemAsync(TAPO_KEYS.account);
}

/** Plug addresses. */
export async function loadPlugs(): Promise<TapoPlugs> {
  try {
    return JSON.parse((await AsyncStorage.getItem(TAPO_KEYS.plugs)) ?? '{}') as TapoPlugs;
  } catch {
    return {};
  }
}

/**
 * Sets (or with null removes) the address of a plug.
 * @param applianceId Appliance.
 * @param host IP address.
 */
export async function savePlug(applianceId: string, host: string | null): Promise<void> {
  const plugs = await loadPlugs();
  if (host) plugs[applianceId] = { host: host.trim() };
  else delete plugs[applianceId];
  await AsyncStorage.setItem(TAPO_KEYS.plugs, JSON.stringify(plugs));
}

/** Last synchronisation, or null. */
export async function loadSyncState(): Promise<TapoSyncState | null> {
  try {
    const raw = await AsyncStorage.getItem(TAPO_KEYS.lastSync);
    return raw ? (JSON.parse(raw) as TapoSyncState) : null;
  } catch {
    return null;
  }
}

/**
 * Local midnight of the first day of the quarter containing `date`, and of the previous quarter.
 * @param date Any day.
 */
export function quarterStarts(date: Date): [Date, Date] {
  const month = Math.floor(date.getMonth() / 3) * 3;
  return [new Date(date.getFullYear(), month, 1), new Date(date.getFullYear(), month - 3, 1)];
}

/**
 * Turns the plug's daily history into consumption entries (Wh → kWh), up to and including today.
 * @param energy Daily history.
 * @param today Current day (local).
 */
export function toUsageEntries(energy: TapoDailyEnergy, today: Date): ApplianceUsageEntry[] {
  const start = new Date(energy.startTimestamp * 1000);
  const last = toIsoDate(today);
  return energy.dailyWh.flatMap((wh, i) => {
    const day = toIsoDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    if (day > last || !Number.isFinite(wh) || wh < 0) return [];
    return [{ periodStart: day, periodEnd: day, energyKwh: Math.round(wh) / 1000 }];
  });
}

/** Dependencies, replaceable in tests. */
export interface SyncDeps {
  createClient(host: string, account: TapoAccount): Pick<TapoClient, 'getDailyEnergy'>;
  upload(applianceId: string, entries: ApplianceUsageEntry[]): Promise<unknown>;
  now(): Date;
}

/** Real dependencies: the KLAP client and the Wattly API. */
const defaultDeps: SyncDeps = {
  createClient: (host, account) => new TapoClient(host, account.email, account.password),
  upload: (applianceId, entries) => applianceApi.saveUsage(applianceId, entries),
  now: () => new Date(),
};

/**
 * Reads one plug (current and previous quarter) and uploads its days.
 * @param applianceId Appliance of the plug.
 * @param host IP address.
 * @param account Tapo account.
 * @param deps Dependencies.
 */
export async function syncPlug(applianceId: string, host: string, account: TapoAccount, deps: SyncDeps = defaultDeps): Promise<PlugSyncResult> {
  try {
    const client = deps.createClient(host, account);
    const now = deps.now();
    const entries = new Map<string, ApplianceUsageEntry>();
    for (const start of quarterStarts(now).reverse()) {
      for (const entry of toUsageEntries(await client.getDailyEnergy(start), now)) entries.set(entry.periodStart, entry);
    }
    const list = [...entries.values()];
    for (let i = 0; i < list.length; i += 400) await deps.upload(applianceId, list.slice(i, i + 400));
    return { applianceId, ok: true, days: list.length };
  } catch (e) {
    return { applianceId, ok: false, days: 0, error: tapoErrorMessage(e) };
  }
}

/**
 * Synchronises every configured plug and remembers the result.
 * @param deps Dependencies.
 * @returns Results, or null when no account or no plug is configured.
 */
export async function syncAll(deps: SyncDeps = defaultDeps): Promise<TapoSyncState | null> {
  const [account, plugs] = await Promise.all([loadAccount(), loadPlugs()]);
  const ids = Object.keys(plugs);
  if (!account || ids.length === 0) return null;
  const results: PlugSyncResult[] = [];
  for (const id of ids) results.push(await syncPlug(id, plugs[id]!.host, account, deps));
  const state = { at: deps.now().toISOString(), results };
  await AsyncStorage.setItem(TAPO_KEYS.lastSync, JSON.stringify(state));
  return state;
}

/**
 * Runs {@link syncAll} when the last run is older than {@link AUTO_SYNC_INTERVAL_MS}; never throws.
 * @param deps Dependencies.
 */
export async function autoSync(deps: SyncDeps = defaultDeps): Promise<TapoSyncState | null> {
  try {
    const last = await loadSyncState();
    if (last && deps.now().getTime() - new Date(last.at).getTime() < AUTO_SYNC_INTERVAL_MS) return null;
    return await syncAll(deps);
  } catch {
    return null;
  }
}

/** Dependencies of {@link linkPlug}, replaceable in tests. */
export interface LinkDeps {
  createClient(host: string, account: TapoAccount): Pick<TapoClient, 'getDeviceInfo'>;
  list(propertyId: string): Promise<Appliance[]>;
  create(propertyId: string, body: ApplianceRequest): Promise<Appliance>;
}

/** Real dependencies of {@link linkPlug}. */
const defaultLinkDeps: LinkDeps = {
  createClient: (host, account) => new TapoClient(host, account.email, account.password),
  list: (propertyId) => applianceApi.list(propertyId),
  create: (propertyId, body) => applianceApi.create(propertyId, body),
};

/**
 * Connects to a plug by its IP address and links it to an appliance: a new one named after the plug, or – when the
 * same plug was added before (e.g. its address changed) – the existing one. The address is remembered on the phone.
 * @param propertyId Property.
 * @param host IP address in the home network.
 * @param account Tapo account.
 * @param deps Dependencies.
 * @returns The linked appliance and whether it was created now.
 * @throws TapoError when the plug cannot be read or does not measure energy.
 */
export async function linkPlug(propertyId: string, host: string, account: TapoAccount, deps: LinkDeps = defaultLinkDeps): Promise<{ appliance: Appliance; created: boolean }> {
  const info = await deps.createClient(host.trim(), account).getDeviceInfo();
  if (!info.hasEnergyMonitoring) throw new TapoError('unsupported', `${info.model} nie mierzy zużycia prądu – potrzebne jest gniazdko P110 lub P115.`);
  const existing = (await deps.list(propertyId)).find((a) => a.source === 'Tapo' && a.externalId === info.deviceId);
  const appliance = existing ?? await deps.create(propertyId, { name: info.nickname, source: 'Tapo', externalId: info.deviceId, model: info.model });
  await savePlug(appliance.id, host);
  return { appliance, created: !existing };
}
