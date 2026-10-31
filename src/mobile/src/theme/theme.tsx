import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

/** Light colour palette (WCAG AA contrast for text). Accent-dependent tokens come from {@link accents}. */
const light = {
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF2F6',
  text: '#0F172A',
  textMuted: '#526071',
  border: '#D9E0E8',
  primary: '#0B7A5C',
  primaryText: '#FFFFFF',
  accent: '#F2A900',
  danger: '#B42318',
  dangerSurface: '#FDECEA',
  warning: '#8A5A00',
  warningSurface: '#FFF4D6',
  estimate: '#5B4CC4',
  estimateSurface: '#EEEBFF',
  chartBar: '#0B7A5C',
  chartBarEstimate: '#9ED3C2',
};

/** Dark colour palette. */
const dark: typeof light = {
  background: '#0B1117',
  surface: '#141C24',
  surfaceMuted: '#1C2630',
  text: '#E8EEF4',
  textMuted: '#9AA8B6',
  border: '#2A3642',
  primary: '#3CC79E',
  primaryText: '#04261C',
  accent: '#F5C04A',
  danger: '#FF8A80',
  dangerSurface: '#3A1714',
  warning: '#F5C04A',
  warningSurface: '#33270B',
  estimate: '#B3A8FF',
  estimateSurface: '#24204A',
  chartBar: '#3CC79E',
  chartBarEstimate: '#24614F',
};

/** Colour tokens of a theme. */
export type Colors = typeof light;

/** Light/dark mode chosen in the app; "system" follows the phone setting. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Colour of buttons, selections, links and charts. */
export type AccentName = 'green' | 'blue' | 'violet' | 'orange';

/** Tokens that change with the accent colour. */
type AccentTokens = Pick<Colors, 'primary' | 'primaryText' | 'chartBar' | 'chartBarEstimate'>;

/**
 * Accent palettes. Every pair is checked in unit tests: button text on `primary` ≥ 4.5:1 and `primary`
 * against the screen background ≥ 3:1 (WCAG AA for text and interface elements).
 */
export const accents: Record<AccentName, { label: string; light: AccentTokens; dark: AccentTokens }> = {
  green: {
    label: 'Zielony',
    light: { primary: '#0B7A5C', primaryText: '#FFFFFF', chartBar: '#0B7A5C', chartBarEstimate: '#9ED3C2' },
    dark: { primary: '#3CC79E', primaryText: '#04261C', chartBar: '#3CC79E', chartBarEstimate: '#24614F' },
  },
  blue: {
    label: 'Niebieski',
    light: { primary: '#1F5FC4', primaryText: '#FFFFFF', chartBar: '#1F5FC4', chartBarEstimate: '#A9C4F0' },
    dark: { primary: '#7AAEFF', primaryText: '#061A3A', chartBar: '#7AAEFF', chartBarEstimate: '#2A4A80' },
  },
  violet: {
    label: 'Fioletowy',
    light: { primary: '#6A3FC4', primaryText: '#FFFFFF', chartBar: '#6A3FC4', chartBarEstimate: '#CBB8F2' },
    dark: { primary: '#B9A0FF', primaryText: '#1B0D45', chartBar: '#B9A0FF', chartBarEstimate: '#4A3A80' },
  },
  orange: {
    label: 'Pomarańczowy',
    light: { primary: '#B04A0A', primaryText: '#FFFFFF', chartBar: '#B04A0A', chartBarEstimate: '#F3C2A0' },
    dark: { primary: '#FF9F5C', primaryText: '#3A1703', chartBar: '#FF9F5C', chartBarEstimate: '#7A3E14' },
  },
};

/** Labels of the modes shown in Settings. */
export const modeLabels: Record<ThemeMode, string> = { system: 'Jak w telefonie', light: 'Jasny', dark: 'Ciemny' };

/**
 * Builds the colours of a theme.
 * @param isDark Dark mode.
 * @param accent Accent colour.
 */
export function buildColors(isDark: boolean, accent: AccentName): Colors {
  const palette = accents[accent] ?? accents.green;
  return { ...(isDark ? dark : light), ...(isDark ? palette.dark : palette.light) };
}

/** Spacing scale in dp. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Corner radius scale in dp. */
export const radius = { sm: 8, md: 12, lg: 16 } as const;

/** Saved appearance. */
interface AppearanceSettings {
  mode: ThemeMode;
  accent: AccentName;
}

/** Appearance state with setters (persisted on the device). */
interface AppearanceState extends AppearanceSettings {
  setMode(mode: ThemeMode): void;
  setAccent(accent: AccentName): void;
}

/** Storage key of the appearance settings (small, non-secret value – kept on the device only). */
export const APPEARANCE_KEY = 'wattly.appearance';
/** Defaults: follow the phone, green accent. */
const DEFAULT_APPEARANCE: AppearanceSettings = { mode: 'system', accent: 'green' };

/** React context of the appearance; screens outside the provider (tests) use the defaults. */
const AppearanceContext = createContext<AppearanceState | null>(null);

/**
 * Reads a saved value, ignoring anything unknown (e.g. written by a newer app version).
 * @param raw Stored JSON.
 */
export function parseAppearance(raw: string | null): AppearanceSettings {
  try {
    const value = raw ? (JSON.parse(raw) as Partial<AppearanceSettings>) : {};
    return {
      mode: value.mode && value.mode in modeLabels ? value.mode : DEFAULT_APPEARANCE.mode,
      accent: value.accent && value.accent in accents ? value.accent : DEFAULT_APPEARANCE.accent,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/**
 * Keeps the chosen mode and accent, saves them on the device and applies the mode to native UI
 * (calendar dialogs, alerts) through `Appearance.setColorScheme`.
 * @param props.children App content.
 */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(APPEARANCE_KEY).then((raw) => { if (active) setAppearance(parseAppearance(raw)); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    Appearance.setColorScheme(appearance.mode === 'system' ? 'unspecified' : appearance.mode);
  }, [appearance.mode]);

  const update = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance((current) => {
      const next = { ...current, ...patch };
      void SecureStore.setItemAsync(APPEARANCE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const value = useMemo<AppearanceState>(() => ({
    ...appearance,
    setMode: (mode) => update({ mode }),
    setAccent: (accent) => update({ accent }),
  }), [appearance, update]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/** Appearance settings and setters (defaults when used outside the provider). */
export function useAppearance(): AppearanceState {
  return useContext(AppearanceContext) ?? { ...DEFAULT_APPEARANCE, setMode: () => undefined, setAccent: () => undefined };
}

/** Current theme: the mode chosen in the app (or the phone setting) and the chosen accent. */
export function useTheme() {
  const system = useColorScheme();
  const { mode, accent } = useAppearance();
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return { colors: buildColors(isDark, accent), dark: isDark, spacing, radius };
}
