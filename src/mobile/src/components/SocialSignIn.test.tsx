/** Tests of the social sign-in buttons. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '../api/errors';
import { authApi } from '../api/endpoints';
import type { ProviderToken } from '../auth/social/providers';
import { tokens } from '../test/fixtures';
import { renderWithProviders } from '../test/render';
import { SocialSignIn } from './SocialSignIn';

jest.mock('../api/endpoints');

const config = { googleWebClientId: 'web', microsoftClientId: 'ms', facebookAppId: '999', appleEnabled: true };

/** Provider token double; the default returns a token, tests may return null (cancelled). */
type GetToken = jest.Mock<Promise<ProviderToken | null>>;

async function renderButtons(getToken: GetToken = jest.fn(async () => ({ token: 'provider-token', nonce: 'n' })), platform = 'android') {
  await renderWithProviders(<SocialSignIn config={config} platform={platform} getToken={getToken} />, { signedIn: false, waitForProperty: false });
  return getToken;
}

test('renders nothing without configured providers', async () => {
  await renderWithProviders(<SocialSignIn config={{}} platform="android" />, { signedIn: false, waitForProperty: false });
  expect(screen.queryByText('lub')).toBeNull();
});

test('shows configured providers for the platform', async () => {
  await renderWithProviders(
    <SocialSignIn config={{ ...config, googleIosClientId: 'ios.apps.googleusercontent.com' }} platform="ios" getToken={jest.fn()} />,
    { signedIn: false, waitForProperty: false },
  );

  for (const label of ['Kontynuuj z Apple', 'Kontynuuj z Google', 'Kontynuuj z Microsoft', 'Kontynuuj z Facebookiem']) {
    expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
  }
});

test('Google is hidden on iOS without the iOS client ID', async () => {
  await renderButtons(undefined, 'ios');

  expect(screen.queryByRole('button', { name: 'Kontynuuj z Google' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Kontynuuj z Apple' })).toBeOnTheScreen();
});

test('exchanges the provider token for a Wattly session and opens the app', async () => {
  jest.mocked(authApi.external).mockResolvedValue(tokens);
  const getToken = await renderButtons();

  await fireEvent.press(screen.getByRole('button', { name: 'Kontynuuj z Microsoft' }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  expect(getToken).toHaveBeenCalledWith('microsoft', config);
  expect(authApi.external).toHaveBeenCalledWith('microsoft', 'provider-token', 'n');
});

test('cancelling the provider does nothing', async () => {
  await renderButtons(jest.fn(async (): Promise<ProviderToken | null> => null));

  await fireEvent.press(screen.getByRole('button', { name: 'Kontynuuj z Google' }));

  await waitFor(() => expect(screen.getByRole('button', { name: 'Kontynuuj z Google' })).toBeEnabled());
  expect(authApi.external).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

test('existing password account gets a clear message', async () => {
  jest.mocked(authApi.external).mockRejectedValue(new ApiError(409, 'x', 'external.email_in_use'));
  await renderButtons();

  await fireEvent.press(screen.getByRole('button', { name: 'Kontynuuj z Facebookiem' }));

  expect(await screen.findByText(/Zaloguj się e-mailem i hasłem/)).toBeOnTheScreen();
});

test('other errors are shown', async () => {
  jest.mocked(authApi.external).mockRejectedValue(new ApiError(401, 'Nie udało się potwierdzić logowania. Spróbuj ponownie.', 'external.invalid_token'));
  await renderButtons();

  await fireEvent.press(screen.getByRole('button', { name: 'Kontynuuj z Google' }));

  expect(await screen.findByText('Nie udało się potwierdzić logowania. Spróbuj ponownie.')).toBeOnTheScreen();
});
