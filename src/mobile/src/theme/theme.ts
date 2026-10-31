import { useColorScheme } from 'react-native';

/** Light colour palette (WCAG AA contrast for text). */
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

/** Spacing scale in dp. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Corner radius scale in dp. */
export const radius = { sm: 8, md: 12, lg: 16 } as const;

/** Current theme following the system light/dark setting. */
export function useTheme() {
  const scheme = useColorScheme();
  return { colors: scheme === 'dark' ? dark : light, dark: scheme === 'dark', spacing, radius };
}
