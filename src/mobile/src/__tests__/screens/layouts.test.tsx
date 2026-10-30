/** Tests of the route layouts (root providers, authenticated guard, tabs). */
import { render, screen } from '@testing-library/react-native';

import AppLayout from '../../app/(app)/_layout';
import TabsLayout from '../../app/(app)/(tabs)/_layout';
import RootLayout from '../../app/_layout';
import { NetworkError } from '../../api/errors';
import { propertyApi } from '../../api/endpoints';
import { property } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

test('root layout renders the providers without crashing', async () => {
  jest.mocked(propertyApi.list).mockResolvedValue([]);
  await render(<RootLayout />);
  // The mocked navigator renders nothing; reaching this point means all providers mounted.
  expect(screen.toJSON()).not.toBeUndefined();
});

test('authenticated layout redirects anonymous users to sign-in', async () => {
  await renderWithProviders(<AppLayout />, { signedIn: false, waitForProperty: false });
  expect(await screen.findByText('redirect:/login')).toBeOnTheScreen();
});

test('authenticated layout sends users without property to onboarding', async () => {
  await renderWithProviders(<AppLayout />, { properties: [], waitForProperty: false });
  expect(await screen.findByText('redirect:/onboarding')).toBeOnTheScreen();
});

test('authenticated layout shows an error with retry when properties cannot load', async () => {
  await renderWithProviders(<AppLayout />, { waitForProperty: false, propertiesError: new NetworkError() });

  expect(await screen.findByText('Brak połączenia')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Spróbuj ponownie/ })).toBeOnTheScreen();
});

test('tabs layout renders for a selected property', async () => {
  await renderWithProviders(<TabsLayout />, { properties: [property()] });
  expect(screen.queryByText('redirect:/login')).toBeNull();
});
