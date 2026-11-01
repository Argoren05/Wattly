import { formatDateTime } from '../utils/format';

/** Data needed to describe the running app version (from expo-application and expo-updates). */
export interface VersionSource {
  /** Version of the installed APK/IPA (`version` in app.json), null in development. */
  nativeVersion: string | null;
  /** Build number of the installer (`android.versionCode` / `ios.buildNumber`). */
  nativeBuild: string | null;
  /** False in development builds and Expo Go (no OTA updates). */
  updatesEnabled: boolean;
  /** True when the app runs the JavaScript bundle embedded in the installer (no OTA update applied yet). */
  isEmbeddedLaunch: boolean;
  /** Id of the running OTA update. */
  updateId: string | null;
  /** Publication time of the running OTA update. */
  createdAt: Date | null;
}

/** Two lines shown in Settings: the installer and the currently running update. */
export interface VersionInfo {
  installer: string;
  update: string;
}

/**
 * Describes the running version. The installer version changes only with a new APK; every OTA update has its own
 * publication time and id, so users can see that an update was applied although the installer version stays the same.
 * @param source Values read from the native modules.
 * @param locale Date format locale (device setting by default).
 */
export function describeVersion(source: VersionSource, locale?: string): VersionInfo {
  const installer = source.nativeVersion
    ? `${source.nativeVersion}${source.nativeBuild ? ` (kompilacja ${source.nativeBuild})` : ''}`
    : 'deweloperska';

  let update: string;
  if (!source.updatesEnabled) update = 'wyłączone w tej wersji';
  else if (source.isEmbeddedLaunch || !source.updateId) update = 'wbudowana w instalator';
  else {
    const id = source.updateId.replace(/-/g, '').slice(0, 8);
    update = source.createdAt ? `${formatDateTime(source.createdAt.toISOString(), locale)} · ${id}` : id;
  }

  return { installer, update };
}
