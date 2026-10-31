/** Tests of the 8-step setup wizard. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Onboarding from '../../app/onboarding';
import { catalogApi, meterApi, propertyApi, readingApi } from '../../api/endpoints';
import { catalog, contract, meter, property, ratePlan, reading } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

const press = (name: RegExp | string) => fireEvent.press(screen.getAllByRole('button', { name: typeof name === 'string' ? new RegExp(name) : name })[0]!);

beforeEach(() => {
  const data = catalog();
  jest.mocked(catalogApi.operators).mockResolvedValue(data.operators);
  jest.mocked(catalogApi.suppliers).mockResolvedValue(data.suppliers);
  jest.mocked(catalogApi.tariffs).mockResolvedValue(data.tariffs);
  jest.mocked(propertyApi.create).mockResolvedValue(property({ billingAnchorDate: '2026-10-01' }));
  jest.mocked(propertyApi.update).mockResolvedValue(property({ billingAnchorDate: '2026-10-01', ppeCode: '590322428100789765' }));
  jest.mocked(propertyApi.setContract).mockResolvedValue(contract());
  jest.mocked(meterApi.create).mockResolvedValue(meter());
  jest.mocked(propertyApi.createRatePlan).mockResolvedValue(ratePlan());
  jest.mocked(readingApi.create).mockResolvedValue({ reading: reading(), warnings: [] });
});

test('completes the whole wizard and saves each step', async () => {
  await renderWithProviders(<Onboarding />, { properties: [], waitForProperty: false });
  await screen.findByText('Krok 1 z 8');

  await fireEvent.changeText(screen.getByLabelText('Miesięczny budżet brutto (opcjonalnie)'), '200');
  await press('Dalej');
  await screen.findByText('Krok 2 z 8');
  expect(propertyApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Moje mieszkanie', billingPeriodMonths: 2, monthlyBudget: 200 }));

  await fireEvent.press(screen.getByRole('radio', { name: /Enea Operator/ }));
  await press('Dalej');
  await screen.findByText('Krok 3 z 8');
  await press('Pomiń');
  await screen.findByText('Krok 4 z 8');

  await fireEvent.press(screen.getByRole('radio', { name: /^.*G12$/ }));
  await fireEvent.changeText(screen.getByLabelText('Moc umowna kW (opcjonalnie)'), '7');
  await fireEvent.changeText(screen.getByLabelText('Umowa obowiązuje od'), '2026-02-07');
  await press('Dalej');
  await screen.findByText('Krok 5 z 8');
  expect(propertyApi.setContract).toHaveBeenCalledWith('p1', expect.objectContaining({ tariffId: 't12', operatorId: 'o1', supplierId: null, contractedPowerKw: 7, validFrom: '2026-02-07' }));

  await fireEvent.changeText(screen.getByLabelText('Numer PPE (opcjonalnie)'), '590322428100789765');
  await press('Dalej');
  await screen.findByText('Krok 6 z 8');
  expect(propertyApi.update).toHaveBeenCalledWith('p1', expect.objectContaining({ ppeCode: '590322428100789765', billingAnchorDate: '2026-10-01' }));
  // The rate plan starts with the contract by default.
  expect(screen.getByLabelText('Obowiązuje od')).toBeOnTheScreen();
  expect(meterApi.create).toHaveBeenCalledWith('p1', expect.objectContaining({
    registers: [expect.objectContaining({ zoneCode: 'DAY' }), expect.objectContaining({ zoneCode: 'NIGHT' })],
  }));

  await fireEvent.changeText(screen.getAllByLabelText(/Stawka netto/)[0]!, '0,6');
  await fireEvent.changeText(screen.getByLabelText('Źródło stawek'), 'Faktura');
  await press('Zapisz stawki');
  await screen.findByText('Krok 7 z 8');
  expect(propertyApi.createRatePlan).toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText('Dzień (kWh)'), '1000');
  await fireEvent.changeText(screen.getByLabelText('Noc (kWh)'), '500');
  await press('Zapisz odczyt');
  await screen.findByText('Krok 8 z 8');
  expect(readingApi.create).toHaveBeenCalledTimes(2);

  await press('Przejdź do aplikacji');
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(app)/(tabs)'));
});

test('validates the first step and reading values', async () => {
  await renderWithProviders(<Onboarding />, { properties: [], waitForProperty: false });
  await screen.findByText('Krok 1 z 8');

  await fireEvent.changeText(screen.getByLabelText('Początek okresu rozliczeniowego'), '2026-10-01');
  await fireEvent.changeText(screen.getByLabelText('Miesięczny budżet brutto (opcjonalnie)'), '-5');
  await press('Dalej');
  expect(await screen.findByText('Budżet musi być dodatnią kwotą.')).toBeOnTheScreen();
  expect(propertyApi.create).not.toHaveBeenCalled();
});

test('skipping the tariff shows guidance instead of meter setup and allows going back', async () => {
  await renderWithProviders(<Onboarding />, { properties: [], waitForProperty: false });
  await screen.findByText('Krok 1 z 8');
  await press('Dalej');
  await screen.findByText('Krok 2 z 8');
  await press('Pomiń');
  await press('Pomiń');
  await screen.findByText('Krok 4 z 8');

  await press('Wstecz');
  expect(await screen.findByText('Krok 3 z 8')).toBeOnTheScreen();
});

test('API errors are shown on the current step', async () => {
  jest.mocked(propertyApi.create).mockRejectedValue(new Error('offline'));
  await renderWithProviders(<Onboarding />, { properties: [], waitForProperty: false });
  await screen.findByText('Krok 1 z 8');

  await press('Dalej');

  expect(await screen.findByText('Wystąpił nieoczekiwany błąd.')).toBeOnTheScreen();
  expect(screen.getByText('Krok 1 z 8')).toBeOnTheScreen();
});
