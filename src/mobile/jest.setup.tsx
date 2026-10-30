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
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.0.0', nativeBuildVersion: '1' }));

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { apiUrl: 'http://api.test' } } } }));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

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
