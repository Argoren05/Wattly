import { describeVersion, type VersionSource } from './versionInfo';

const base: VersionSource = {
  nativeVersion: '1.1.0', nativeBuild: '2', updatesEnabled: true, isEmbeddedLaunch: false,
  updateId: '3f9a1c2b-0d4e-4b7a-9c11-2b5e8f6a7d90', createdAt: new Date(2026, 10, 1, 9, 20),
};

describe('describeVersion', () => {
  test('shows the installer with its build number and the applied update with date and short id', () => {
    expect(describeVersion(base, 'pl-PL')).toEqual({ installer: '1.1.0 (kompilacja 2)', update: '01.11.2026, 09:20 · 3f9a1c2b' });
  });

  test('before the first OTA update the bundle from the installer is running', () => {
    expect(describeVersion({ ...base, isEmbeddedLaunch: true }).update).toBe('wbudowana w instalator');
    expect(describeVersion({ ...base, updateId: null }).update).toBe('wbudowana w instalator');
  });

  test('development builds have no installer version and no updates', () => {
    expect(describeVersion({ ...base, nativeVersion: null, updatesEnabled: false })).toEqual({ installer: 'deweloperska', update: 'wyłączone w tej wersji' });
    expect(describeVersion({ ...base, nativeBuild: null }).installer).toBe('1.1.0');
    expect(describeVersion({ ...base, createdAt: null }).update).toBe('3f9a1c2b');
  });
});
