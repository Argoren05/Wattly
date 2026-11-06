import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { WattlyTorch } from '../../modules/wattly-torch';
import { Button, Notice } from './ui';

/** True when the native flashlight module is built in and the phone has a flashlight. */
function nativeTorchAvailable(): boolean {
  try {
    return WattlyTorch?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * Toggle for the phone's flashlight – handy when the meter hangs in a dark cupboard or staircase.
 *
 * Preferred path: the local native module `wattly-torch` (Android CameraManager.setTorchMode, iOS AVCaptureDevice),
 * which needs **no camera permission** and lights up instantly. Fallback for builds without that module: an invisible
 * 1×1 expo-camera view with `enableTorch` (asks for camera access). Either way the light goes off when the button is
 * pressed again, when the screen is left, and (native path) when the app goes to the background. Not shown on the web.
 */
export function FlashlightButton() {
  const [native] = useState(nativeTorchAvailable);
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const lit = useRef(false);

  // Leaving the screen switches the native light off (the camera fallback unmounts its view by itself).
  useEffect(() => () => {
    if (native && lit.current) void WattlyTorch?.setEnabled(false).catch(() => undefined);
  }, [native]);

  if (Platform.OS === 'web') return null;

  /** Native path: switches the LED directly. */
  const toggleNative = async () => {
    setBusy(true);
    try {
      const next = await WattlyTorch!.setEnabled(!on);
      lit.current = next;
      setOn(next);
    } catch {
      setProblem('Nie udało się włączyć latarki – może jej teraz używać inna aplikacja.');
    } finally {
      setBusy(false);
    }
  };

  /** Fallback path: camera view with the torch (asks for camera access the first time). */
  const toggleCamera = async () => {
    if (on) return setOn(false);
    const granted = permission?.granted || (await requestPermission()).granted;
    if (granted) return setOn(true);
    setProblem(permission && !permission.canAskAgain
      ? 'Latarka wymaga dostępu do aparatu – włącz go w ustawieniach telefonu.'
      : 'Bez dostępu do aparatu nie można włączyć latarki.');
  };

  return (
    <View>
      <Button title={on ? 'Wyłącz latarkę' : 'Latarka'} variant="secondary" icon={on ? 'flashlight' : 'flashlight-outline'} loading={busy}
        onPress={() => { setProblem(null); void (native ? toggleNative() : toggleCamera()); }} accessibilityHint="Oświetla licznik diodą telefonu" />
      {problem ? (
        <>
          <Notice tone="warning">{problem}</Notice>
          {!native && permission && !permission.canAskAgain
            ? <Button title="Otwórz ustawienia telefonu" variant="ghost" onPress={() => void Linking.openSettings()} /> : null}
        </>
      ) : null}
      {on && !native ? <CameraView style={styles.hidden} facing="back" enableTorch testID="flashlight-camera" /> : null}
    </View>
  );
}

/** The fallback camera view only powers the torch – it must stay invisible. */
const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
