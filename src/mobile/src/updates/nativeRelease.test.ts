/** Tests of the native installer check. */
import { appApi } from '../api/endpoints';
import type { MobileRelease } from '../api/types';
import { fetchReleaseStatus } from './nativeRelease';

jest.mock('../api/endpoints');

const release: MobileRelease = {
  platform: 'android', currentVersion: '1.0.0', latestVersion: '1.1.0', minimumVersion: '1.0.0', downloadUrl: 'https://x/app.apk',
  releaseNotes: null, updateAvailable: true, updateRequired: false,
};

test('asks the API for supported platforms', async () => {
  jest.mocked(appApi.release).mockResolvedValue(release);

  await expect(fetchReleaseStatus('android', '1.0.0')).resolves.toEqual(release);
  expect(appApi.release).toHaveBeenCalledWith('android', '1.0.0');
});

test('skips development builds and other platforms', async () => {
  await expect(fetchReleaseStatus('android', null)).resolves.toBeNull();
  await expect(fetchReleaseStatus('web', '1.0.0')).resolves.toBeNull();
  expect(appApi.release).not.toHaveBeenCalled();
});

test('API failures do not break the app', async () => {
  jest.mocked(appApi.release).mockRejectedValue(new Error('offline'));
  await expect(fetchReleaseStatus('ios', '1.0.0')).resolves.toBeNull();
});
