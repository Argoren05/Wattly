/** Tests of the update provider (automatic checks, foreground re-checks, actions). */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Linking } from 'react-native';

import { appApi } from '../api/endpoints';
import type { MobileRelease } from '../api/types';
import type { UpdatesModule } from './otaUpdates';
import { UpdateProvider, useAppUpdates } from './UpdateContext';

jest.mock('../api/endpoints');

const release: MobileRelease = {
  platform: 'android', currentVersion: '1.0.0', latestVersion: '1.2.0', minimumVersion: '1.0.0', downloadUrl: 'https://x/app.apk',
  releaseNotes: 'Nowości', updateAvailable: true, updateRequired: false,
};

function setup(updates: UpdatesModule, now = () => 0) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UpdateProvider deps={{ updates, installedVersion: '1.0.0', platform: 'android', now }}>{children}</UpdateProvider>
  );
  return renderHook(() => useAppUpdates(), { wrapper });
}

const updatesWithNewBundle = (): UpdatesModule => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
});

beforeEach(() => jest.mocked(appApi.release).mockResolvedValue(release));

// Spies on AppState/Linking must not leak into other tests.
afterEach(() => jest.restoreAllMocks());

test('checks OTA and native release on start', async () => {
  const updates = updatesWithNewBundle();
  const { result } = await setup(updates);

  await waitFor(() => expect(result.current.ota).toBe('ready'));
  await waitFor(() => expect(result.current.release?.latestVersion).toBe('1.2.0'));
  expect(appApi.release).toHaveBeenCalledWith('android', '1.0.0');

  await act(() => result.current.restart());
  expect(updates.reloadAsync).toHaveBeenCalled();
});

test('re-checks when returning to foreground only after the throttle interval', async () => {
  let listener: ((state: string) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    listener = handler as (state: string) => void;
    return { remove: jest.fn() } as never;
  });
  let time = 0;
  const updates = updatesWithNewBundle();
  jest.mocked(updates.checkForUpdateAsync).mockResolvedValue({ isAvailable: false });
  const { result } = await setup(updates, () => time);
  await waitFor(() => expect(result.current.ota).toBe('upToDate'));

  await act(async () => listener?.('active'));
  expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

  time = 31 * 60 * 1000;
  await act(async () => listener?.('active'));
  await waitFor(() => expect(updates.checkForUpdateAsync).toHaveBeenCalledTimes(2));
});

test('dismiss hides the installer banner and download opens the link', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const { result } = await setup({ ...updatesWithNewBundle(), isEnabled: false });
  await waitFor(() => expect(result.current.release).not.toBeNull());
  expect(result.current.ota).toBe('disabled');

  await act(() => result.current.openDownload());
  await act(async () => result.current.dismissRelease());

  expect(openURL).toHaveBeenCalledWith('https://x/app.apk');
  expect(result.current.releaseDismissed).toBe(true);
});

test('manual check keeps a downloaded update ready', async () => {
  const updates = updatesWithNewBundle();
  const { result } = await setup(updates);
  await waitFor(() => expect(result.current.ota).toBe('ready'));

  jest.mocked(updates.checkForUpdateAsync).mockRejectedValueOnce(new Error('offline'));
  await act(() => result.current.checkNow());

  expect(result.current.ota).toBe('ready');
});
