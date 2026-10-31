/**
 * Renders components with the real app providers (query cache, auth, selected property, updates).
 * The API module must be mocked in the test file with `jest.mock('<relative>/api/endpoints')`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import type { ReactElement, ReactNode } from 'react';
import { Text } from 'react-native';

import { propertyApi } from '../api/endpoints';
import type { Property } from '../api/types';
import { AuthProvider } from '../auth/AuthContext';
import { PropertyProvider, useProperty } from '../state/PropertyContext';
import { AppearanceProvider } from '../theme/theme';
import { UpdateProvider, type UpdateProviderDeps } from '../updates/UpdateContext';
import { property as sampleProperty, tokens } from './fixtures';

/** Update dependencies that disable all update checks. */
export const noUpdates: UpdateProviderDeps = {
  updates: { isEnabled: false, checkForUpdateAsync: jest.fn(), fetchUpdateAsync: jest.fn(), reloadAsync: jest.fn() },
  installedVersion: null,
};

/** Options of {@link renderWithProviders}. */
export interface RenderOptions {
  /** Whether a session (tokens) exists in secure storage. Default: true. */
  signedIn?: boolean;
  /** Properties returned by the API. Default: one sample property. */
  properties?: Property[];
  /** Render the UI only after the property list is loaded (needed by screens using useRequiredProperty). Default: true. */
  waitForProperty?: boolean;
  /** Update provider dependencies. */
  updates?: UpdateProviderDeps;
  /** When set, loading the property list fails with this error. */
  propertiesError?: unknown;
}

/** Renders children only once a property is selected (mirrors the guard in app/(app)/_layout). */
function PropertyGate({ children }: { children: ReactNode }) {
  const { property } = useProperty();
  return property ? <>{children}</> : <Text>test:loading-property</Text>;
}

/**
 * Renders the element inside all providers and waits until it is ready.
 * @returns The query client (to inspect or invalidate caches).
 */
export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}) {
  const { signedIn = true, properties = [sampleProperty()], waitForProperty = true, updates = noUpdates, propertiesError } = options;
  const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
  store.clear();
  if (signedIn) store.set('wattly.tokens', JSON.stringify(tokens));
  if (propertiesError) jest.mocked(propertyApi.list).mockRejectedValue(propertiesError);
  else jest.mocked(propertyApi.list).mockResolvedValue(properties);

  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  await render(
    <AppearanceProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <PropertyProvider>
            <UpdateProvider deps={updates}>
              {waitForProperty ? <PropertyGate>{ui}</PropertyGate> : ui}
            </UpdateProvider>
          </PropertyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppearanceProvider>,
  );

  // Wait until the session is restored and the property list is loaded.
  if (waitForProperty && properties.length > 0)
    await waitFor(() => expect(screen.queryByText('test:loading-property')).toBeNull());
  return client;
}
