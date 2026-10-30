/** Tests of the detail and form screens: readings, invoices and cost breakdown. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import Breakdown from '../../app/(app)/breakdown';
import InvoiceDetails from '../../app/(app)/invoice/[id]';
import NewInvoice from '../../app/(app)/invoice/new';
import ReadingDetails from '../../app/(app)/reading/[id]';
import NewReading from '../../app/(app)/reading/new';
import { analyticsApi, catalogApi, invoiceApi, meterApi, propertyApi, readingApi } from '../../api/endpoints';
import { ApiError } from '../../api/errors';
import { calculation, catalog, contract, forecast, invoice, meter, reading } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

beforeEach(() => {
  jest.mocked(meterApi.list).mockResolvedValue([meter()]);
  jest.mocked(readingApi.list).mockResolvedValue({ items: [reading()], page: 1, pageSize: 50, totalCount: 1 });
});
afterEach(() => jest.restoreAllMocks());

describe('new reading', () => {
  test('saves for the register passed in the route and goes back', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ registerId: 'rNight' });
    jest.mocked(readingApi.create).mockResolvedValue({ reading: reading(), warnings: [] });
    await renderWithProviders(<NewReading />);

    await fireEvent.changeText(await screen.findByLabelText('Wskazanie (kWh)'), '1300');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz odczyt/ }));

    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(readingApi.create).toHaveBeenCalledWith('rNight', expect.objectContaining({ value: 1300 }));
  });

  test('without meter shows guidance', async () => {
    jest.mocked(meterApi.list).mockResolvedValue([]);
    await renderWithProviders(<NewReading />);
    expect(await screen.findByText('Brak licznika')).toBeOnTheScreen();
  });
});

describe('reading details', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'read1' }));

  test('shows details and corrects the reading', async () => {
    jest.mocked(readingApi.get).mockResolvedValue(reading({ note: 'Notatka' }));
    jest.mocked(readingApi.correct).mockResolvedValue({ reading: reading({ value: 1240 }), warnings: [] });
    await renderWithProviders(<ReadingDetails />);

    expect(await screen.findByText('Licznik główny: Dzień')).toBeOnTheScreen();
    expect(screen.getByText('Notatka: Notatka')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Skoryguj odczyt/ }));
    await fireEvent.changeText(screen.getByLabelText('Wskazanie (kWh)'), '1240');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz korektę/ }));

    await waitFor(() => expect(readingApi.correct).toHaveBeenCalledWith('read1', expect.objectContaining({ value: 1240 })));
    expect(router.back).toHaveBeenCalled();
  });

  test('voids the reading with a reason', async () => {
    jest.mocked(readingApi.get).mockResolvedValue(reading());
    jest.mocked(readingApi.void).mockResolvedValue(reading({ status: 'Voided' }));
    await renderWithProviders(<ReadingDetails />);

    await fireEvent.press(await screen.findByRole('button', { name: /Anuluj odczyt/ }));
    await fireEvent.changeText(screen.getByLabelText('Powód (opcjonalnie)'), 'Pomyłka');
    await fireEvent.press(screen.getByRole('button', { name: /Potwierdź anulowanie/ }));

    await waitFor(() => expect(readingApi.void).toHaveBeenCalledWith('read1', 'Pomyłka'));
  });

  test('inactive readings cannot be changed', async () => {
    jest.mocked(readingApi.get).mockResolvedValue(reading({ status: 'Voided', voidReason: 'Błąd', supersedesReadingId: 'x' }));
    await renderWithProviders(<ReadingDetails />);

    expect(await screen.findByText('Anulowany')).toBeOnTheScreen();
    expect(screen.getByText('Powód anulowania: Błąd')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Skoryguj/ })).toBeNull();
  });
});

describe('new invoice', () => {
  async function fill() {
    await fireEvent.changeText(screen.getByLabelText('Numer faktury'), 'FV/9');
    await fireEvent.changeText(screen.getByLabelText('Okres od'), '2026-09-01');
    await fireEvent.changeText(screen.getByLabelText('Okres do (włącznie)'), '2026-09-30');
    await fireEvent.changeText(screen.getByLabelText('Kwota brutto (PLN)'), '150,20');
  }

  test('validates and saves an invoice with attachment', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///f.pdf', name: 'f.pdf', mimeType: 'application/pdf', size: 100, lastModified: 0 }] } as never);
    jest.mocked(invoiceApi.create).mockResolvedValue(invoice({ id: 'i9' }));
    jest.mocked(invoiceApi.attach).mockResolvedValue({ id: 'a', fileName: 'f.pdf', contentType: 'application/pdf', sizeBytes: 100, createdAt: '' });
    await renderWithProviders(<NewInvoice />);

    await fireEvent.press(screen.getByRole('button', { name: /Zapisz fakturę/ }));
    expect(screen.getByText('Podaj numer faktury.')).toBeOnTheScreen();

    await fill();
    await fireEvent.press(screen.getByRole('button', { name: /Dodaj PDF lub zdjęcie/ }));
    await screen.findByText('Załącznik: f.pdf');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz fakturę/ }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/invoice/[id]', params: { id: 'i9' } }));
    expect(invoiceApi.create).toHaveBeenCalledWith('p1', expect.objectContaining({ invoiceNumber: 'FV/9', totalGross: 150.2, periodStart: '2026-09-01' }));
    expect(invoiceApi.attach).toHaveBeenCalledWith('i9', expect.any(FormData));
  });

  test('rejects reversed periods and too large files', async () => {
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'f', name: 'big.pdf', size: 11 * 1024 * 1024, lastModified: 0 }] } as never);
    await renderWithProviders(<NewInvoice />);
    await fill();

    await fireEvent.changeText(screen.getByLabelText('Okres do (włącznie)'), '2026-08-01');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz fakturę/ }));
    expect(screen.getByText('Koniec okresu nie może być przed początkiem.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Okres do (włącznie)'), '2026-09-30');
    await fireEvent.press(screen.getByRole('button', { name: /Dodaj PDF/ }));
    await screen.findByText('Załącznik: big.pdf');
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz fakturę/ }));
    expect(screen.getByText('Załącznik może mieć maksymalnie 10 MB.')).toBeOnTheScreen();
    expect(invoiceApi.create).not.toHaveBeenCalled();
  });

  test('server errors are shown', async () => {
    jest.mocked(invoiceApi.create).mockRejectedValue(new ApiError(400, 'x', undefined, { TotalGross: ['Nieprawidłowa kwota brutto.'] }));
    await renderWithProviders(<NewInvoice />);
    await fill();
    await fireEvent.press(screen.getByRole('button', { name: /Zapisz fakturę/ }));

    expect(await screen.findByText('Nieprawidłowa kwota brutto.')).toBeOnTheScreen();
  });
});

describe('invoice details', () => {
  beforeEach(() => jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'i1' }));

  test('shows comparison and deletes after confirmation', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.[1]?.onPress?.());
    jest.mocked(invoiceApi.get).mockResolvedValue(invoice({ attachment: { id: 'a', fileName: 'f.pdf', contentType: 'application/pdf', sizeBytes: 1, createdAt: '' } }));
    jest.mocked(invoiceApi.remove).mockResolvedValue(undefined);
    await renderWithProviders(<InvoiceDetails />);

    expect(await screen.findByText('Porównanie z szacunkiem')).toBeOnTheScreen();
    expect(screen.getByText('f.pdf')).toBeOnTheScreen();
    expect(screen.getByText(/8,55/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Usuń fakturę/ }));
    await waitFor(() => expect(invoiceApi.remove).toHaveBeenCalledWith('i1'));
    expect(router.back).toHaveBeenCalled();
  });

  test('without comparison explains why', async () => {
    jest.mocked(invoiceApi.get).mockResolvedValue(invoice({ comparison: null }));
    await renderWithProviders(<InvoiceDetails />);
    expect(await screen.findByText('Brak stawek lub odczytów dla okresu faktury.')).toBeOnTheScreen();
  });

  test('incomplete comparison is flagged', async () => {
    jest.mocked(invoiceApi.get).mockResolvedValue(invoice({ comparison: { ...invoice().comparison!, isComplete: false, isEstimate: true } }));
    await renderWithProviders(<InvoiceDetails />);
    expect(await screen.findByText(/porównanie jest niepełne/)).toBeOnTheScreen();
  });
});

describe('cost breakdown', () => {
  test('uses the exact forecast instants and shows lines by category', async () => {
    const data = catalog();
    jest.mocked(catalogApi.operators).mockResolvedValue(data.operators);
    jest.mocked(catalogApi.suppliers).mockResolvedValue(data.suppliers);
    jest.mocked(catalogApi.tariffs).mockResolvedValue(data.tariffs);
    jest.mocked(propertyApi.contract).mockResolvedValue(contract());
    jest.mocked(analyticsApi.forecast).mockResolvedValue(forecast());
    jest.mocked(analyticsApi.preview).mockResolvedValue(calculation({ isComplete: false }));
    await renderWithProviders(<Breakdown />);

    expect(await screen.findByText('Razem brutto')).toBeOnTheScreen();
    expect(analyticsApi.preview).toHaveBeenCalledWith('p1', '2026-08-31T22:00:00Z', '2026-10-31T23:00:00Z');
    expect(screen.getByText('Energia')).toBeOnTheScreen();
    expect(screen.getByText('Dystrybucja')).toBeOnTheScreen();
    expect(await screen.findByText(/strefa dzienna/)).toBeOnTheScreen();
    expect(screen.getByText(/Kalkulacja jest niepełna/)).toBeOnTheScreen();
    expect(screen.getByText('• Moje stawki – Faktura 1')).toBeOnTheScreen();
  });

  test('errors offer retry', async () => {
    jest.mocked(analyticsApi.forecast).mockRejectedValue(new Error('x'));
    await renderWithProviders(<Breakdown />);
    expect(await screen.findByText('Nie udało się wczytać danych')).toBeOnTheScreen();
  });
});
