/** Tests of shared query hooks. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError } from '../api/errors';
import { catalogApi, propertyApi } from '../api/endpoints';
import { catalog, contract, meter } from '../test/fixtures';
import { importRegisters, keys, useCatalog, useContract, useInvalidateEnergyData } from './queries';

jest.mock('../api/endpoints');

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

test('importRegisters flattens active meters and adds the meter name', () => {
  const registers = importRegisters([meter(), meter({ id: 'm2', isActive: false })]);

  expect(registers.map((r) => r.id)).toEqual(['rDay', 'rNight']);
  expect(registers[0]?.meterName).toBe('Licznik główny');
  expect(importRegisters(undefined)).toEqual([]);
});

test('useContract maps 404 to null and rethrows other errors', async () => {
  const { wrapper } = setup();
  jest.mocked(propertyApi.contract).mockRejectedValueOnce(new ApiError(404, 'Brak'));
  const missing = await renderHook(() => useContract('p1'), { wrapper });
  await waitFor(() => expect(missing.result.current.isSuccess).toBe(true));
  expect(missing.result.current.data).toBeNull();

  jest.mocked(propertyApi.contract).mockRejectedValueOnce(new ApiError(500, 'Błąd'));
  const failing = await renderHook(() => useContract('p2'), { wrapper });
  await waitFor(() => expect(failing.result.current.isError).toBe(true));

  jest.mocked(propertyApi.contract).mockResolvedValueOnce(contract());
  const ok = await renderHook(() => useContract('p3'), { wrapper });
  await waitFor(() => expect(ok.result.current.data?.tariffCode).toBe('G12'));
});

test('useCatalog loads operators, suppliers and tariffs together', async () => {
  const { wrapper } = setup();
  const data = catalog();
  jest.mocked(catalogApi.operators).mockResolvedValue(data.operators);
  jest.mocked(catalogApi.suppliers).mockResolvedValue(data.suppliers);
  jest.mocked(catalogApi.tariffs).mockResolvedValue(data.tariffs);

  const { result } = await renderHook(() => useCatalog(), { wrapper });

  await waitFor(() => expect(result.current.data?.tariffs).toHaveLength(2));
});

test('useInvalidateEnergyData refreshes forecast, series, invoices and readings', async () => {
  const { client, wrapper } = setup();
  const spy = jest.spyOn(client, 'invalidateQueries');
  const { result } = await renderHook(() => useInvalidateEnergyData(), { wrapper });

  await result.current('p1');

  expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([keys.forecast('p1'), keys.series('p1'), keys.invoices('p1'), ['readings']]);
});
