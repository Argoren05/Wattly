/** Tests of the reading form (validation, preview, anomaly confirmation). */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { ApiError } from '../api/errors';
import { readingApi } from '../api/endpoints';
import type { ReadingSaved } from '../api/types';
import { importRegisters } from '../hooks/queries';
import { meter, reading } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { ReadingForm } from './ReadingForm';

jest.mock('../api/endpoints');

const registers = importRegisters([meter()]);
const saved: ReadingSaved = { reading: reading(), warnings: [] };

beforeEach(() => {
  jest.mocked(readingApi.list).mockResolvedValue({ items: [reading({ value: 1200, readingAt: '2026-10-01T06:00:00Z' })], page: 1, pageSize: 50, totalCount: 1 });
});
afterEach(() => jest.restoreAllMocks());

async function renderForm(save = jest.fn(async () => saved), onSaved = jest.fn()) {
  await renderWithProviders(<ReadingForm registers={registers} submitLabel="Zapisz odczyt" save={save} onSaved={onSaved} />);
  return { save, onSaved };
}

test('previews consumption since the last reading and saves', async () => {
  const { save, onSaved } = await renderForm();

  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '1250,5');
  expect(await screen.findByText(/50,5\s?kWh/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  expect(save).toHaveBeenCalledWith('rDay', expect.objectContaining({ value: 1250.5, source: 'Manual', note: null }));
});

test('warns about values lower than the last reading and validates input', async () => {
  const { save } = await renderForm();

  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '100');
  expect(await screen.findByText('Wskazanie jest niższe niż ostatni odczyt.')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '');
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

  expect(screen.getByText('Podaj wskazanie licznika.')).toBeOnTheScreen();
  expect(save).not.toHaveBeenCalled();
});

test('register can be switched for multi-register meters', async () => {
  const { save } = await renderForm();

  await fireEvent.press(screen.getByRole('radio', { name: /Noc/ }));
  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '700');
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

  await waitFor(() => expect(save).toHaveBeenCalledWith('rNight', expect.anything()));
});

test('anomaly is saved after the user confirms it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
  const save = jest.fn()
    .mockRejectedValueOnce(new ApiError(409, 'Nietypowo duży wzrost. Aby zapisać mimo to, potwierdź.', 'reading.anomaly_requires_confirmation'))
    .mockResolvedValueOnce(saved);
  const { onSaved } = await renderForm(save);

  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '9000');
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(save.mock.calls[1][1]).toEqual(expect.objectContaining({ confirmAnomaly: true }));
  expect(Alert.alert).toHaveBeenCalledWith('Nietypowy odczyt', 'Nietypowo duży wzrost.', expect.any(Array), expect.objectContaining({ cancelable: true }));
});

test('anomaly is not saved when the user wants to fix it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[0]?.onPress?.());
  const save = jest.fn().mockRejectedValue(new ApiError(409, 'Skok', 'reading.anomaly_requires_confirmation'));
  await renderForm(save);

  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '9000');
  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

  await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
  expect(save).toHaveBeenCalledTimes(1);
});

test('server validation and conflicts are shown', async () => {
  const save = jest.fn()
    .mockRejectedValueOnce(new ApiError(400, 'Błąd', undefined, { Value: ['Za dużo miejsc po przecinku.'] }))
    .mockRejectedValueOnce(new ApiError(409, 'Istnieje już odczyt z tą datą.', 'reading.duplicate'));
  await renderForm(save);
  await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '1300');

  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));
  expect(await screen.findByText('Za dużo miejsc po przecinku.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));
  expect(await screen.findByText('Istnieje już odczyt z tą datą.')).toBeOnTheScreen();
});
