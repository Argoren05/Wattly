import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '../theme/theme';
import { extractPpe, isValidPpe, normalizePpe } from '../utils/gs1';
import { Body, Button, Field } from './ui';

/** Props of {@link PpeField}. */
export interface PpeFieldProps {
  /** Current text (may contain spaces). */
  value: string;
  /** Receives the typed or scanned number. */
  onChange: (value: string) => void;
}

/**
 * Returns a validation message for a PPE number, or null when it is empty or valid.
 * @param value Field text.
 */
export function ppeError(value: string): string | null {
  const normalized = normalizePpe(value);
  if (!normalized) return null;
  return isValidPpe(normalized) ? null : 'Numer PPE ma 18 cyfr i cyfrę kontrolną – sprawdź, czy nie ma literówki.';
}

/**
 * Metering point number (PPE) with GS1 check-digit validation and a barcode scanner (camera, native apps only).
 * The number is printed on the invoice ("Numer Punktu Poboru Energii") and often on a sticker at the meter.
 */
export function PpeField({ value, onChange }: PpeFieldProps) {
  const [scanning, setScanning] = useState(false);
  const error = ppeError(value);
  return (
    <View style={{ gap: spacing.sm }}>
      <Field label="Numer PPE (opcjonalnie)" value={value} onChangeText={onChange} keyboardType="number-pad" maxLength={24}
        error={error ?? undefined} hint="18 cyfr z faktury: „Numer Punktu Poboru Energii”." />
      {Platform.OS !== 'web' ? <Button title="Skanuj kod PPE" variant="secondary" onPress={() => setScanning(true)} /> : null}
      {scanning ? <PpeScanner onScanned={(code) => { onChange(code); setScanning(false); }} onClose={() => setScanning(false)} /> : null}
    </View>
  );
}

/** Full-screen camera that closes as soon as a barcode containing a valid PPE number is read. */
function PpeScanner({ onScanned, onClose }: { onScanned: (code: string) => void; onClose: () => void }) {
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  // The camera reports the same code many times per second – accept only the first valid one.
  const done = useRef(false);

  /** Handles a decoded barcode: valid PPE closes the scanner, anything else shows a hint and scanning continues. */
  const handle = (data: string) => {
    if (done.current) return;
    const code = extractPpe(data);
    if (!code) return setMessage('Ten kod nie zawiera numeru PPE. Zeskanuj kod przy numerze PPE na fakturze lub liczniku.');
    done.current = true;
    onScanned(code);
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
        {permission?.granted ? (
          <CameraView style={styles.camera} facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'datamatrix', 'qr', 'ean13', 'itf14'] }}
            onBarcodeScanned={(result) => handle(result.data)} />
        ) : (
          <View style={[styles.camera, styles.center]}>
            <Body>Aparat jest potrzebny tylko do odczytania kodu. Zdjęcia nie są zapisywane.</Body>
            {permission && !permission.canAskAgain
              ? <Body muted>Dostęp do aparatu jest zablokowany – włącz go w ustawieniach telefonu.</Body>
              : <Button title="Zezwól na aparat" onPress={() => void requestPermission()} />}
          </View>
        )}
        <View style={styles.footer}>
          <Text style={{ color: message ? colors.danger : colors.text }} accessibilityLiveRegion="polite">
            {message ?? 'Skieruj aparat na kod kreskowy przy numerze PPE.'}
          </Text>
          <Button title="Anuluj" variant="ghost" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Layout of the scanner. */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  camera: { flex: 1 },
  center: { justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  footer: { padding: spacing.lg, gap: spacing.sm },
});
