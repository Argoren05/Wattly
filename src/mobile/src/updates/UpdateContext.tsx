/**
 * Provides automatic update handling for the whole app:
 * - OTA: checks on start and whenever the app returns to the foreground (throttled), downloads in the background
 *   and offers a restart;
 * - native: asks the API whether a new installer is available or required.
 */
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import type { MobileRelease } from '../api/types';
import { fetchReleaseStatus } from './nativeRelease';
import { checkAndFetchUpdate, shouldCheck, type OtaState, type UpdatesModule } from './otaUpdates';

/** Values exposed by {@link useAppUpdates}. */
export interface AppUpdatesState {
  /** State of the OTA update. */
  ota: OtaState;
  /** Native release status, or null when unknown. */
  release: MobileRelease | null;
  /** True when the user hid the optional "new installer" banner. */
  releaseDismissed: boolean;
  /** Restarts the app to apply a downloaded OTA update. */
  restart(): Promise<void>;
  /** Hides the optional installer banner for this session. */
  dismissRelease(): void;
  /** Opens the installer / store page. */
  openDownload(): Promise<void>;
  /** Runs an OTA check immediately (e.g. from settings). */
  checkNow(): Promise<void>;
}

/** React context of the update state. */
const UpdatesContext = createContext<AppUpdatesState | null>(null);

/** Dependencies of the provider; overridable in tests. */
export interface UpdateProviderDeps {
  /** expo-updates module. */
  updates?: UpdatesModule;
  /** Installed native version. */
  installedVersion?: string | null;
  /** Device platform. */
  platform?: string;
  /** Clock in ms. */
  now?: () => number;
}

/**
 * Wraps the app and runs automatic update checks.
 * @param props.children App content.
 * @param props.deps Optional dependencies (tests).
 */
export function UpdateProvider({ children, deps }: { children: ReactNode; deps?: UpdateProviderDeps }) {
  const updates = deps?.updates ?? (Updates as unknown as UpdatesModule);
  const installedVersion = deps && 'installedVersion' in deps ? deps.installedVersion ?? null : __DEV__ ? null : Application.nativeApplicationVersion;
  const platform = deps?.platform ?? Platform.OS;
  const now = deps?.now ?? Date.now;

  const [ota, setOta] = useState<OtaState>(updates.isEnabled ? 'idle' : 'disabled');
  const [release, setRelease] = useState<MobileRelease | null>(null);
  const [releaseDismissed, setReleaseDismissed] = useState(false);
  const lastCheck = useRef<number | null>(null);
  const running = useRef(false);
  const downloaded = useRef(false);

  /**
   * One OTA check; never runs twice in parallel. Once an update is downloaded nothing more is checked until
   * the restart, so the "ready" banner cannot be replaced by a later failed or empty check.
   */
  const runOtaCheck = useCallback(async () => {
    if (running.current || downloaded.current) return;
    running.current = true;
    lastCheck.current = now();
    try {
      const result = await checkAndFetchUpdate(updates, setOta);
      downloaded.current = result === 'ready';
      setOta(result);
    } finally {
      running.current = false;
    }
  }, [updates, now]);

  /** Native release check (cheap API call). */
  const runReleaseCheck = useCallback(async () => {
    setRelease(await fetchReleaseStatus(platform, installedVersion));
  }, [platform, installedVersion]);

  useEffect(() => {
    // Start the first checks after the initial render so they never delay showing the app.
    const initial = setTimeout(() => {
      void runOtaCheck();
      void runReleaseCheck();
    }, 0);

    // Re-check when the user comes back to the app, at most every 30 minutes.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && shouldCheck(lastCheck.current, now())) {
        void runOtaCheck();
        void runReleaseCheck();
      }
    });
    return () => {
      clearTimeout(initial);
      subscription.remove();
    };
  }, [runOtaCheck, runReleaseCheck, now]);

  const value = useMemo<AppUpdatesState>(() => ({
    ota,
    release,
    releaseDismissed,
    restart: () => updates.reloadAsync(),
    dismissRelease: () => setReleaseDismissed(true),
    openDownload: async () => {
      if (release?.downloadUrl) await Linking.openURL(release.downloadUrl);
    },
    checkNow: runOtaCheck,
  }), [ota, release, releaseDismissed, updates, runOtaCheck]);

  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

/** Access to the update state; must be used inside {@link UpdateProvider}. */
export function useAppUpdates(): AppUpdatesState {
  const context = useContext(UpdatesContext);
  if (!context) throw new Error('useAppUpdates must be used inside UpdateProvider');
  return context;
}
