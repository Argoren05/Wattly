/**
 * Detection of new native installers (APK / store builds).
 *
 * OTA updates can only change JavaScript; changes to native modules require installing a new build.
 * The API tells the app which installer version is the newest and which is the oldest still supported.
 */
import { appApi } from '../api/endpoints';
import type { MobileRelease } from '../api/types';

/** Platforms that have native installers. */
export type NativePlatform = 'android' | 'ios';

/**
 * Asks the API whether the installed native version should be updated.
 * @param platform Operating system of the device.
 * @param installedVersion Native version of the installed app (e.g. "1.0.0"); null in development.
 * @returns Release status, or null when it cannot be determined (development build, unsupported platform, offline).
 */
export async function fetchReleaseStatus(platform: string, installedVersion: string | null): Promise<MobileRelease | null> {
  if (!installedVersion || (platform !== 'android' && platform !== 'ios')) return null;
  try {
    return await appApi.release(platform, installedVersion);
  } catch {
    // The check is best-effort: the app keeps working when the API is unreachable.
    return null;
  }
}
