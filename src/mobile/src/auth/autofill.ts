import { Platform, type TextInputProps } from 'react-native';

// Autofill hints for password managers (Bitwarden, Google Password Manager, iCloud Keychain…).
//
// React Native passes `autoComplete` to Android only for the values it maps to Android autofill hints;
// any other value (including the web/iOS names "current-password" and "new-password") makes React Native
// mark the field as NOT important for autofill, so password managers skip it. Android therefore needs
// "password" / "password-new", while iOS uses "current-password" / "new-password" plus `textContentType`.

/** Props of the login (e-mail) field: saved as the account's user name by password managers. */
export const usernameAutofill: TextInputProps = {
  autoComplete: 'username',
  textContentType: 'username',
  importantForAutofill: 'yes',
};

/** Props of the password field on the sign-in screen. */
export const currentPasswordAutofill: TextInputProps = {
  autoComplete: Platform.OS === 'android' ? 'password' : 'current-password',
  textContentType: 'password',
  importantForAutofill: 'yes',
};

/** Props of password fields when creating an account (managers offer to generate and save a password). */
export const newPasswordAutofill: TextInputProps = {
  autoComplete: Platform.OS === 'android' ? 'password-new' : 'new-password',
  textContentType: 'newPassword',
  importantForAutofill: 'yes',
};
