import { fireEvent, render, screen } from '@testing-library/react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Platform } from 'react-native';

import { FlashlightButton } from './Flashlight';

/** Props of the last rendered (hidden) camera view. */
const lastCamera = () => jest.mocked(CameraView).mock.calls.at(-1)?.[0] as { enableTorch?: boolean } | undefined;

afterEach(() => jest.restoreAllMocks());

test('turns the torch on and off with a hidden camera view', async () => {
  await render(<FlashlightButton />);
  expect(CameraView).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: /Latarka/ }));
  expect(lastCamera()?.enableTorch).toBe(true);
  expect(screen.getByRole('button', { name: /Wyłącz latarkę/ })).toBeOnTheScreen();

  jest.mocked(CameraView).mockClear();
  await fireEvent.press(screen.getByRole('button', { name: /Wyłącz latarkę/ }));
  expect(CameraView).not.toHaveBeenCalled(); // view unmounted = light off
});

test('asks for camera access and explains a permanent refusal', async () => {
  const request = jest.fn(async () => ({ granted: false, canAskAgain: false }));
  jest.mocked(useCameraPermissions).mockReturnValue([{ granted: false, canAskAgain: false } as never, request as never, jest.fn() as never]);
  await render(<FlashlightButton />);

  await fireEvent.press(screen.getByRole('button', { name: /Latarka/ }));
  expect(request).toHaveBeenCalled();
  expect(await screen.findByText(/włącz go w ustawieniach telefonu/)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Otwórz ustawienia telefonu/ })).toBeOnTheScreen();
});

test('is hidden on the web', async () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  await render(<FlashlightButton />);
  expect(screen.queryByRole('button', { name: /Latarka/ })).toBeNull();
});
