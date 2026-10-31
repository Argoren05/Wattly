/** Tests of the entry gate, sign-in and registration screens. */
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import Index from '../../app/index';
import Login from '../../app/login';
import Register from '../../app/register';
import { ApiError } from '../../api/errors';
import { authApi } from '../../api/endpoints';
import { tokens } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';

jest.mock('../../api/endpoints');

describe('entry gate', () => {
  test('redirects to sign-in without a session', async () => {
    await renderWithProviders(<Index />, { signedIn: false, waitForProperty: false });
    expect(await screen.findByText('redirect:/login')).toBeOnTheScreen();
  });

  test('redirects to onboarding when the user has no property', async () => {
    await renderWithProviders(<Index />, { properties: [], waitForProperty: false });
    expect(await screen.findByText('redirect:/onboarding')).toBeOnTheScreen();
  });

  test('redirects to the main tabs otherwise', async () => {
    await renderWithProviders(<Index />, { waitForProperty: false });
    expect(await screen.findByText('redirect:/(app)/(tabs)')).toBeOnTheScreen();
  });
});

describe('login', () => {
  test('requires e-mail and password', async () => {
    await renderWithProviders(<Login />, { signedIn: false, waitForProperty: false });

    await fireEvent.press(screen.getByRole('button', { name: /Zaloguj się/ }));

    expect(screen.getByText('Podaj e-mail i hasło.')).toBeOnTheScreen();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  test('signs in and goes to the entry gate', async () => {
    jest.mocked(authApi.login).mockResolvedValue(tokens);
    await renderWithProviders(<Login />, { signedIn: false, waitForProperty: false });

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'jan@example.com');
    await fireEvent.changeText(screen.getByLabelText('Hasło'), 'Haslo12345');
    await fireEvent.press(screen.getByRole('button', { name: /Zaloguj się/ }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  test('shows a generic message for wrong credentials', async () => {
    jest.mocked(authApi.login).mockRejectedValue(new ApiError(401, 'Unauthorized'));
    await renderWithProviders(<Login />, { signedIn: false, waitForProperty: false });

    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'jan@example.com');
    await fireEvent.changeText(screen.getByLabelText('Hasło'), 'zle');
    await fireEvent.press(screen.getByRole('button', { name: /Zaloguj się/ }));

    expect(await screen.findByText('Nieprawidłowy e-mail lub hasło.')).toBeOnTheScreen();
  });
});

describe('register', () => {
  async function fill(email: string, password: string, confirm = password) {
    await fireEvent.changeText(screen.getByLabelText('E-mail'), email);
    await fireEvent.changeText(screen.getByLabelText('Hasło'), password);
    await fireEvent.changeText(screen.getByLabelText('Powtórz hasło'), confirm);
    await fireEvent.press(screen.getByRole('button', { name: /Załóż konto/ }));
  }

  test('validates input locally', async () => {
    await renderWithProviders(<Register />, { signedIn: false, waitForProperty: false });

    await fill('zly-email', 'Haslo12345');
    expect(screen.getByText('Podaj prawidłowy adres e-mail.')).toBeOnTheScreen();
    await fill('a@b.pl', 'krotkie');
    expect(screen.getByText('Hasło musi mieć co najmniej 10 znaków.')).toBeOnTheScreen();
    await fill('a@b.pl', 'Haslo12345', 'Inne12345678');
    expect(screen.getByText('Hasła nie są identyczne.')).toBeOnTheScreen();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  test('registers, signs in and goes to the entry gate', async () => {
    jest.mocked(authApi.register).mockResolvedValue(undefined);
    jest.mocked(authApi.login).mockResolvedValue(tokens);
    await renderWithProviders(<Register />, { signedIn: false, waitForProperty: false });

    await fill('a@b.pl', 'Haslo12345');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  test('translates Identity errors', async () => {
    await renderWithProviders(<Register />, { signedIn: false, waitForProperty: false });

    jest.mocked(authApi.register).mockRejectedValueOnce(new ApiError(400, 'x', undefined, { DuplicateEmail: ['taken'] }));
    await fill('a@b.pl', 'Haslo12345');
    expect(await screen.findByText('Konto z tym adresem już istnieje.')).toBeOnTheScreen();

    jest.mocked(authApi.register).mockRejectedValueOnce(new ApiError(400, 'x', undefined, { PasswordRequiresUpper: ['upper'] }));
    await fill('a@b.pl', 'haslo12345');
    expect(await screen.findByText(/małą i wielką literę/)).toBeOnTheScreen();
  });
});
