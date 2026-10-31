/** Tests of the selected-property state. */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import type { ReactNode } from 'react';

import { propertyApi } from '../api/endpoints';
import { AuthProvider } from '../auth/AuthContext';
import { property, tokens } from '../test/fixtures';
import { PropertyProvider, useProperty, useRequiredProperty } from './PropertyContext';

jest.mock('../api/endpoints');

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AuthProvider><PropertyProvider>{children}</PropertyProvider></AuthProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  store.clear();
  store.set('wattly.tokens', JSON.stringify(tokens));
});

test('selects the first property and allows switching', async () => {
  jest.mocked(propertyApi.list).mockResolvedValue([property(), property({ id: 'p2', name: 'Dom' })]);
  const { result } = await renderHook(() => useProperty(), { wrapper });

  await waitFor(() => expect(result.current.property?.id).toBe('p1'));
  await act(async () => result.current.select('p2'));

  expect(result.current.property?.name).toBe('Dom');
  expect(result.current.properties).toHaveLength(2);
});

test('does not load properties without a session', async () => {
  store.clear();
  const { result } = await renderHook(() => useProperty(), { wrapper });

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(propertyApi.list).not.toHaveBeenCalled();
  expect(result.current.property).toBeNull();
});

test('useRequiredProperty throws when no property exists', async () => {
  jest.mocked(propertyApi.list).mockResolvedValue([]);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

  await expect(renderHook(() => useRequiredProperty(), { wrapper })).rejects.toThrow('No property selected');
});
