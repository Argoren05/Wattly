import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';

import { Button, Notice } from './ui';

/**
 * Toggle for the phone's flashlight – handy when the meter hangs in a dark cupboard or staircase.
 *
 * The torch is driven through expo-camera (already used by the PPE scanner, so no new native module): while it is on,
 * an invisible 1×1 camera view with `enableTorch` is mounted. The light goes off when the button is pressed again or
 * the screen is left (the view unmounts). Not shown on the web.
 */
export function FlashlightButton() {
  const [permission, requestPermission] = useCameraPermissions();
  const [on, setOn] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (Platform.OS === 'web') return null;

  /** Turns the light on (asking for camera access the first time) or off. */
  const toggle = async () => {
    setProblem(null);
    if (on) return setOn(false);
    const granted = permission?.granted || (await requestPermission()).granted;
    if (granted) return setOn(true);
    setProblem(permission && !permission.canAskAgain
      ? 'Latarka wymaga dostępu do aparatu – włącz go w ustawieniach telefonu.'
      : 'Bez dostępu do aparatu nie można włączyć latarki.');
  };

  return (
    <View>
      <Button title={on ? 'Wyłącz latarkę' : 'Latarka'} variant="secondary" icon={on ? 'flashlight' : 'flashlight-outline'}
        onPress={() => void toggle()} accessibilityHint="Oświetla licznik diodą aparatu" />
      {problem ? (
        <>
          <Notice tone="warning">{problem}</Notice>
          {permission && !permission.canAskAgain ? <Button title="Otwórz ustawienia telefonu" variant="ghost" onPress={() => void Linking.openSettings()} /> : null}
        </>
      ) : null}
      {on ? <CameraView style={styles.hidden} facing="back" enableTorch testID="flashlight-camera" /> : null}
    </View>
  );
}

/** The camera view only powers the torch – it must stay invisible. */
const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
