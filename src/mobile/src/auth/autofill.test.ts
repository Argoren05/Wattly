import { Platform } from 'react-native';

/** Loads the module with the given platform (values are computed at import time). */
function load(os: 'android' | 'ios') {
  jest.resetModules();
  jest.replaceProperty(Platform, 'OS', os);
  return jest.requireActual<typeof import('./autofill')>('./autofill');
}

describe('autofill hints', () => {
  afterEach(() => jest.restoreAllMocks());

  it('uses the Android hint names that React Native forwards to password managers', () => {
    const hints = load('android');
    expect(hints.currentPasswordAutofill.autoComplete).toBe('password');
    expect(hints.newPasswordAutofill.autoComplete).toBe('password-new');
    expect(hints.usernameAutofill.autoComplete).toBe('username');
    expect(hints.currentPasswordAutofill.importantForAutofill).toBe('yes');
  });

  it('uses the iOS names on iOS', () => {
    const hints = load('ios');
    expect(hints.currentPasswordAutofill.autoComplete).toBe('current-password');
    expect(hints.newPasswordAutofill).toMatchObject({ autoComplete: 'new-password', textContentType: 'newPassword' });
  });
});
