/**
 * Global Jest setup: replaces native modules (unavailable in Node) with simple test doubles.
 * Screen tests additionally mock the API module (`src/api/endpoints`) per test file.
 */
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// In-memory secure storage.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void store.delete(key)),
    __store: store,
  };
});

// OTA updates are disabled unless a test provides its own UpdatesModule double.
jest.mock('expo-updates', () => ({
  isEnabled: false,
  isEmbeddedLaunch: true,
  updateId: null,
  createdAt: null,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', nativeBuildVersion: '1' }));

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { apiUrl: 'http://api.test' } } } }));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

// Native date picker: the iOS control (the platform used by jest-expo) becomes a text input that accepts
// "YYYY-MM-DD" or "YYYY-MM-DD HH:mm", so tests "pick" a date by typing it. Invalid text is ignored like a cancelled picker.
jest.mock('@react-native-community/datetimepicker', () => {
  const { TextInput } = jest.requireActual('react-native');
  const { parseFieldDate } = jest.requireActual('./src/utils/format');
  const Picker = ({ accessibilityLabel, onValueChange }: { accessibilityLabel?: string; onValueChange?: (event: unknown, date: Date) => void }) => (
    <TextInput accessibilityLabel={accessibilityLabel} onChangeText={(text: string) => {
      const date = parseFieldDate(text);
      if (date) onValueChange?.({ nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } }, date);
    }} />
  );
  return { __esModule: true, default: Picker, DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() } };
});

// Barcode scanner camera: permission granted, no camera view in Node.
jest.mock('expo-camera', () => ({
  CameraView: jest.fn(() => null),
  useCameraPermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]),
}));

// Icons render as plain text so they do not need fonts.
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = jest.requireActual('react-native');
  const Icon = ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text>;
  return { __esModule: true, default: Icon };
});

// Expo Router: navigation calls are recorded; route components render nothing (or their children).
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const router = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
  const Screen = () => null;
  const Stack = Object.assign(() => null, { Screen });
  const Tabs = Object.assign(({ children }: { children?: unknown }) => children ?? null, { Screen });
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
    Link: ({ children }: { children: unknown }) => <Text>{children as string}</Text>,
    Stack,
    Tabs,
  };
});

// Sign-in with external providers: native SDKs replaced by test doubles (tests override return values).
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(async () => true), signIn: jest.fn() },
  isSuccessResponse: (response: { type: string }) => response.type === 'success',
  isErrorWithCode: (error: unknown) => typeof error === 'object' && error !== null && 'code' in error,
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' },
}));

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'test-nonce') }));

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));

jest.mock('expo-auth-session', () => {
  const promptAsync = jest.fn();
  class AuthRequest {
    codeVerifier = 'test-verifier';
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
      AuthRequest.instances.push(this);
    }
    static instances: AuthRequest[] = [];
    promptAsync = promptAsync;
  }
  return {
    AuthRequest,
    ResponseType: { Code: 'code', Token: 'token' },
    makeRedirectUri: jest.fn(() => 'wattly://auth'),
    exchangeCodeAsync: jest.fn(),
    __promptAsync: promptAsync,
  };
});
