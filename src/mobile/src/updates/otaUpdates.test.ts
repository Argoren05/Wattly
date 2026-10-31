/** Tests of the OTA update flow. */
import { checkAndFetchUpdate, MIN_CHECK_INTERVAL_MS, shouldCheck, type UpdatesModule } from './otaUpdates';

/** Creates an UpdatesModule double. */
const module = (o: Partial<UpdatesModule> = {}): UpdatesModule => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })),
  fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
  reloadAsync: jest.fn(async () => undefined),
  ...o,
});

test('disabled module never contacts the server', async () => {
  const updates = module({ isEnabled: false });

  await expect(checkAndFetchUpdate(updates)).resolves.toBe('disabled');
  expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
});

test('no update available means up to date', async () => {
  await expect(checkAndFetchUpdate(module())).resolves.toBe('upToDate');
});

test('available update is downloaded and waits for restart (never applied automatically)', async () => {
  const updates = module({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })) });
  const progress: string[] = [];

  await expect(checkAndFetchUpdate(updates, (s) => progress.push(s))).resolves.toBe('ready');
  expect(progress).toEqual(['checking', 'downloading']);
  expect(updates.reloadAsync).not.toHaveBeenCalled();
});

test('roll back to embedded bundle is treated as an update', async () => {
  const updates = module({
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false, isRollBackToEmbedded: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: false, isRollBackToEmbedded: true })),
  });

  await expect(checkAndFetchUpdate(updates)).resolves.toBe('ready');
});

test('download without new bundle and errors are reported', async () => {
  await expect(checkAndFetchUpdate(module({
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: false })),
  }))).resolves.toBe('upToDate');
  await expect(checkAndFetchUpdate(module({ checkForUpdateAsync: jest.fn(async () => { throw new Error('offline'); }) }))).resolves.toBe('error');
});

test('foreground checks are throttled', () => {
  expect(shouldCheck(null, 0)).toBe(true);
  expect(shouldCheck(1000, 1000 + MIN_CHECK_INTERVAL_MS - 1)).toBe(false);
  expect(shouldCheck(1000, 1000 + MIN_CHECK_INTERVAL_MS)).toBe(true);
});
