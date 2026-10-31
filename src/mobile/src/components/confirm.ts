import { Alert, Platform } from 'react-native';

/**
 * Asks a yes/no question with the platform dialog (the browser dialog on web).
 * @param title Dialog title.
 * @param message Explanation of the consequences.
 * @param confirmLabel Label of the confirming button.
 * @param options.cancelLabel Label of the cancelling button.
 * @param options.destructive Shows the confirming button as destructive (red on iOS).
 * @returns True when the user confirmed.
 */
export function confirmAsync(title: string, message: string, confirmLabel: string,
  options: { cancelLabel?: string; destructive?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: options.cancelLabel ?? 'Anuluj', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: options.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}
