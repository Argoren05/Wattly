import { act, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { Appearance, Text } from 'react-native';

import { accents, APPEARANCE_KEY, AppearanceProvider, buildColors, parseAppearance, useAppearance, useTheme, type AccentName } from './theme';

/** WCAG relative luminance of a #RRGGBB colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('accent palettes', () => {
  const cases = (Object.keys(accents) as AccentName[]).flatMap((accent) => [false, true].map((isDark) => [accent, isDark] as const));

  test.each(cases)('%s (dark: %s) keeps WCAG AA contrast', (accent, isDark) => {
    const colors = buildColors(isDark, accent);
    expect(contrast(colors.primaryText, colors.primary)).toBeGreaterThanOrEqual(4.5); // button text
    expect(contrast(colors.primary, colors.background)).toBeGreaterThanOrEqual(3); // selected chips, icons, links
    expect(contrast(colors.primary, colors.surface)).toBeGreaterThanOrEqual(3);
  });

  test('the accent changes only accent tokens', () => {
    const green = buildColors(false, 'green');
    const blue = buildColors(false, 'blue');
    expect(blue.primary).not.toBe(green.primary);
    expect(blue.danger).toBe(green.danger);
    expect(blue.text).toBe(green.text);
  });
});

test('parseAppearance ignores invalid or unknown values', () => {
  expect(parseAppearance(null)).toEqual({ mode: 'system', accent: 'green' });
  expect(parseAppearance('{"mode":"dark","accent":"blue"}')).toEqual({ mode: 'dark', accent: 'blue' });
  expect(parseAppearance('{"mode":"neon","accent":"pink"}')).toEqual({ mode: 'system', accent: 'green' });
  expect(parseAppearance('not json')).toEqual({ mode: 'system', accent: 'green' });
});

/** Setters of the rendered provider, exposed to the test. */
const handle: { current?: ReturnType<typeof useAppearance> } = {};

/** Shows the theme and exposes the setters to the test. */
function Probe() {
  const appearance = useAppearance();
  const { colors, dark } = useTheme();
  useEffect(() => { handle.current = appearance; });
  return <Text>{`${dark ? 'dark' : 'light'} ${colors.primary}`}</Text>;
}

describe('AppearanceProvider', () => {
  beforeEach(() => jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  test('loads the saved appearance, applies the mode to native UI and saves changes', async () => {
    await SecureStore.setItemAsync(APPEARANCE_KEY, JSON.stringify({ mode: 'dark', accent: 'violet' }));
    await render(<AppearanceProvider><Probe /></AppearanceProvider>);

    expect(await screen.findByText(`dark ${accents.violet.dark.primary}`)).toBeOnTheScreen();
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');

    await act(async () => handle.current!.setMode('light'));
    await act(async () => handle.current!.setAccent('orange'));
    expect(screen.getByText(`light ${accents.orange.light.primary}`)).toBeOnTheScreen();
    expect(JSON.parse((await SecureStore.getItemAsync(APPEARANCE_KEY))!)).toEqual({ mode: 'light', accent: 'orange' });

    await act(async () => handle.current!.setMode('system'));
    expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified');
  });
});
