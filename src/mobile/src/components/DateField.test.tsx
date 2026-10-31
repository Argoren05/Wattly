import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DateField } from './DateField';

/** Options passed to the Android dialog by the last `open` call. */
const lastOpen = () => jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)![0];
/** Simulates the user confirming a date in the Android dialog. */
const pick = (date: Date) => lastOpen().onValueChange!({ nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date);

describe('DateField on Android', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));
  afterEach(() => jest.restoreAllMocks());

  test('shows the value in the phone format and opens the system calendar', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Obowiązuje od" value="2026-02-07" onChange={onChange} hint="Podpowiedź" />);

    const field = screen.getByRole('button', { name: 'Obowiązuje od' });
    expect(screen.getByText(new Date(2026, 1, 7).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }))).toBeOnTheScreen();
    expect(screen.getByText('Podpowiedź')).toBeOnTheScreen();

    await fireEvent.press(field);
    expect(lastOpen()).toMatchObject({ mode: 'date', value: new Date(2026, 1, 7) });
    pick(new Date(2026, 0, 1));
    expect(onChange).toHaveBeenCalledWith('2026-01-01');
  });

  test('date-time fields ask for the day and then the time', async () => {
    const onChange = jest.fn();
    await render(<DateField label="Data i godzina" mode="datetime" value="2026-02-07 18:30" onChange={onChange} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Data i godzina' }));
    pick(new Date(2026, 1, 6));
    expect(lastOpen()).toMatchObject({ mode: 'time', value: new Date(2026, 1, 6, 18, 30) });
    pick(new Date(2026, 1, 6, 7, 45));
    expect(onChange).toHaveBeenCalledWith('2026-02-06 07:45');
  });

  test('empty value invites to pick a date and errors replace the hint', async () => {
    await render(<DateField label="Okres od" value="" onChange={jest.fn()} hint="Podpowiedź" error="Wybierz datę." />);
    expect(screen.getByText('Wybierz datę')).toBeOnTheScreen();
    expect(screen.getByText('Wybierz datę.')).toBeOnTheScreen();
    expect(screen.queryByText('Podpowiedź')).toBeNull();
  });
});

test('on the web the field is a text input', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const onChange = jest.fn();
  await render(<DateField label="Okres od" value="" onChange={onChange} />);
  await fireEvent.changeText(screen.getByPlaceholderText('RRRR-MM-DD'), '2026-03-01');
  expect(onChange).toHaveBeenCalledWith('2026-03-01');
  jest.restoreAllMocks();
});
