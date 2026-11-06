import { requireOptionalNativeModule } from 'expo';

/**
 * Native flashlight control (local Expo module, see android/ and ios/).
 * Android uses CameraManager.setTorchMode and iOS AVCaptureDevice – neither needs the camera permission.
 */
export interface WattlyTorchNative {
  /** True when the device has a flashlight the app can switch. */
  isAvailable(): boolean;
  /** Turns the flashlight on or off and resolves with the new state; rejects when it is busy (e.g. used by another camera app). */
  setEnabled(enabled: boolean): Promise<boolean>;
}

/** The module, or null in builds without it (older installers, Expo Go, web, tests). */
export const WattlyTorch = requireOptionalNativeModule<WattlyTorchNative>('WattlyTorch');
