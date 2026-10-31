import { Alert, Platform } from 'react-native';

import { confirmAsync } from './confirm';

/** Buttons passed to the last Alert.alert call. */
const buttons = () => jest.mocked(Alert.alert).mock.calls.at(-1)![2]!;

describe('confirmAsync', () => {
  beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  test('resolves true for the confirming button and shows it as destructive', async () => {
    const result = confirmAsync('Usunąć?', 'Na pewno?', 'Usuń', { destructive: true });
    expect(buttons()[1]).toMatchObject({ text: 'Usuń', style: 'destructive' });
    buttons()[1]!.onPress!();
    await expect(result).resolves.toBe(true);
  });

  test('resolves false when cancelled or dismissed', async () => {
    const cancelled = confirmAsync('Usunąć?', 'Na pewno?', 'Usuń', { cancelLabel: 'Nie' });
    expect(buttons()[0]).toMatchObject({ text: 'Nie', style: 'cancel' });
    buttons()[0]!.onPress!();
    await expect(cancelled).resolves.toBe(false);

    const dismissed = confirmAsync('Usunąć?', 'Na pewno?', 'Usuń');
    jest.mocked(Alert.alert).mock.calls.at(-1)![3]!.onDismiss!();
    await expect(dismissed).resolves.toBe(false);
  });

  test('uses the browser dialog on the web', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const confirm = jest.fn(() => true);
    (globalThis as { confirm?: unknown }).confirm = confirm;
    await expect(confirmAsync('Usunąć?', 'Na pewno?', 'Usuń')).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith('Usunąć?\n\nNa pewno?');
    delete (globalThis as { confirm?: unknown }).confirm;
  });
});
