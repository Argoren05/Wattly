/**
 * UI for automatic updates: a banner offering a restart after an OTA download, a banner about a new installer
 * and a blocking screen when the installed version is no longer supported.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppUpdates } from '../updates/UpdateContext';
import { spacing } from '../theme/theme';
import { Body, Button, Notice, Screen, Title } from './ui';

/**
 * Renders the update banners above the app content, or only the blocking screen when an update is required.
 * @param props.children App content.
 */
export function UpdateGate({ children }: { children: ReactNode }) {
  const { ota, release, releaseDismissed, restart, dismissRelease, openDownload } = useAppUpdates();

  const showOta = ota === 'ready';
  const showRelease = !!release?.updateAvailable && !releaseDismissed;

  if (release?.updateRequired) {
    return (
      <Screen>
        <View style={{ gap: spacing.lg, marginTop: spacing.xxl }}>
          <Title>Wymagana aktualizacja</Title>
          <Body>
            Twoja wersja aplikacji ({release.currentVersion}) nie jest już obsługiwana. Zainstaluj wersję {release.latestVersion ?? release.minimumVersion}, aby dalej korzystać z Wattly.
          </Body>
          {release.releaseNotes ? <Body muted>{release.releaseNotes}</Body> : null}
          {release.downloadUrl
            ? <Button title="Pobierz aktualizację" icon="download-outline" onPress={() => void openDownload()} />
            : <Notice tone="warning">Pobierz nową wersję ze sklepu z aplikacjami.</Notice>}
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView edges={showOta || showRelease ? ['top'] : []}>
      {showOta ? (
        <View style={{ padding: spacing.sm }}>
          <Notice title="Nowa wersja aplikacji jest gotowa" action={<Button title="Uruchom ponownie" icon="refresh" onPress={() => void restart()} />}>
            Aktualizacja została pobrana w tle. Uruchom aplikację ponownie, aby ją zastosować.
          </Notice>
        </View>
      ) : null}
      {showRelease && release ? (
        <View style={{ padding: spacing.sm }}>
          <Notice
            title={`Dostępna wersja ${release.latestVersion}`}
            action={(
              <View style={{ gap: spacing.xs }}>
                {release.downloadUrl ? <Button title="Pobierz instalator" icon="download-outline" onPress={() => void openDownload()} /> : null}
                <Button title="Później" variant="ghost" onPress={dismissRelease} />
              </View>
            )}
          >
            {release.releaseNotes ?? 'Nowa wersja instalatora zawiera zmiany, których nie da się dostarczyć automatycznie.'}
          </Notice>
        </View>
      ) : null}
      </SafeAreaView>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
