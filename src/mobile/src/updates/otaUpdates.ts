/**
 * Over-the-air (OTA) updates of the JavaScript bundle via expo-updates / EAS Update.
 *
 * The logic is written against a small interface instead of importing expo-updates directly,
 * so it can be unit-tested without the native module.
 */

/** State of the OTA update flow shown in the UI. */
export type OtaState = 'disabled' | 'idle' | 'checking' | 'downloading' | 'ready' | 'upToDate' | 'error';

/** Subset of the expo-updates API used by Wattly. */
export interface UpdatesModule {
  /** False in development builds / Expo Go and when no update URL is configured. */
  isEnabled: boolean;
  /** Asks the update server whether a newer compatible bundle exists. */
  checkForUpdateAsync(): Promise<{ isAvailable: boolean; isRollBackToEmbedded?: boolean }>;
  /** Downloads the update found by the check. */
  fetchUpdateAsync(): Promise<{ isNew: boolean; isRollBackToEmbedded?: boolean }>;
  /** Restarts the app with the downloaded bundle. */
  reloadAsync(): Promise<void>;
}

/** Minimum time between automatic checks when the app returns to the foreground (30 minutes). */
export const MIN_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Decides whether an automatic check should run now.
 * @param lastCheckAt Time of the previous check in ms, or null if none happened yet.
 * @param now Current time in ms.
 * @param minIntervalMs Minimum interval between checks.
 * @returns True when no check was made yet or the interval has passed.
 */
export function shouldCheck(lastCheckAt: number | null, now: number, minIntervalMs = MIN_CHECK_INTERVAL_MS): boolean {
  return lastCheckAt === null || now - lastCheckAt >= minIntervalMs;
}

/**
 * Checks for an update and downloads it in the background.
 * The update is NOT applied here – restarting is left to the user, so no unsaved form is lost.
 * @param updates expo-updates module (or a test double).
 * @param onProgress Receives intermediate states (checking, downloading).
 * @returns Final state: `ready` when a new bundle is downloaded and waits for restart.
 */
export async function checkAndFetchUpdate(updates: UpdatesModule, onProgress?: (state: OtaState) => void): Promise<OtaState> {
  if (!updates.isEnabled) return 'disabled';

  try {
    onProgress?.('checking');
    const check = await updates.checkForUpdateAsync();
    // A roll back to the embedded bundle (published by `eas update:roll-back-to-embedded`) is applied like an update.
    if (!check.isAvailable && !check.isRollBackToEmbedded) return 'upToDate';

    onProgress?.('downloading');
    const fetched = await updates.fetchUpdateAsync();
    return fetched.isNew || fetched.isRollBackToEmbedded ? 'ready' : 'upToDate';
  } catch {
    // Network problems must never disturb using the app – the next check will retry.
    return 'error';
  }
}
