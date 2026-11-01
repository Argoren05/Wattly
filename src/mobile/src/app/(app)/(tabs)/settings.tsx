import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { authApi } from '../../../api/endpoints';
import { useAuth } from '../../../auth/AuthContext';
import { useAppUpdates } from '../../../updates/UpdateContext';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { describeVersion } from '../../../updates/versionInfo';
import { Body, Button, Card, Chips, KeyValue, Screen, SectionTitle } from '../../../components/ui';
import { useProperty } from '../../../state/PropertyContext';
import { accents, modeLabels, spacing, useAppearance, useTheme, type AccentName, type ThemeMode } from '../../../theme/theme';

/** Navigation row of the settings list. */
function Item({ icon, title, subtitle, href }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string; href: Href }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>{title}</Text>
        <Text style={{ color: colors.textMuted }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** Settings tab: property selection, configuration screens, app version, updates and sign-out. */
export default function Settings() {
  const { signOut } = useAuth();
  const appearance = useAppearance();
  const { properties, property, select } = useProperty();
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me });
  const { ota, checkNow, restart } = useAppUpdates();
  // Installer version changes only with a new APK; the update line changes with every automatic (OTA) update.
  const version = describeVersion({
    nativeVersion: Application.nativeApplicationVersion,
    nativeBuild: Application.nativeBuildVersion,
    updatesEnabled: Updates.isEnabled,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
  });
  const otaLabel: Record<typeof ota, string> = {
    disabled: 'Automatyczne aktualizacje są wyłączone w tej wersji (tryb deweloperski).',
    idle: 'Aktualizacje są sprawdzane automatycznie.',
    checking: 'Sprawdzanie aktualizacji…',
    downloading: 'Pobieranie aktualizacji…',
    ready: 'Aktualizacja pobrana – uruchom aplikację ponownie.',
    upToDate: 'Masz najnowszą wersję.',
    error: 'Nie udało się sprawdzić aktualizacji. Spróbujemy ponownie później.',
  };

  return (
    <Screen>
      <Card>
        <SectionTitle>{properties.length > 1 ? 'Wybrana nieruchomość' : 'Nieruchomość'}</SectionTitle>
        {properties.length > 1
          ? <Chips value={property?.id ?? null} onChange={select} options={properties.map((p) => ({ value: p.id, label: p.name }))} />
          : <Body>{property?.name ?? ''}</Body>}
        <Button title="Dodaj nieruchomość" variant="secondary" icon="add-circle-outline" onPress={() => router.push('/onboarding')}
          accessibilityHint="Otwiera kreator konfiguracji nowej nieruchomości" />
      </Card>
      <Card>
        <Item icon="home-outline" title="Nieruchomość" subtitle="Nazwa, okres rozliczeniowy, budżet" href="/settings/property" />
        <Item icon="flash-outline" title="Umowa i taryfa" subtitle="Operator, sprzedawca, grupa taryfowa" href="/settings/contract" />
        <Item icon="pricetags-outline" title="Stawki" subtitle="Cenniki i ich okresy obowiązywania" href="/settings/rates" />
        <Item icon="speedometer-outline" title="Liczniki i rejestry" subtitle="Konfiguracja liczników" href="/settings/meters" />
      </Card>
      <Card>
        <SectionTitle>Wygląd</SectionTitle>
        <Chips<ThemeMode> label="Tryb" value={appearance.mode} onChange={appearance.setMode}
          options={(Object.keys(modeLabels) as ThemeMode[]).map((m) => ({ value: m, label: modeLabels[m] }))} />
        <Chips<AccentName> label="Kolor motywu" value={appearance.accent} onChange={appearance.setAccent}
          options={(Object.keys(accents) as AccentName[]).map((a) => ({ value: a, label: accents[a].label }))} />
        <Body muted>Ustawienia wyglądu są zapisywane na tym telefonie.</Body>
      </Card>
      <Card>
        <SectionTitle>Konto</SectionTitle>
        <Body muted>{me.data?.email ?? ''}</Body>
        <Button title="Wyloguj" variant="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/login'); }} />
      </Card>
      <Card>
        <SectionTitle>Aplikacja</SectionTitle>
        <KeyValue label="Instalator" value={version.installer} />
        <KeyValue label="Aktualizacja" value={version.update} />
        <Body>{otaLabel[ota]}</Body>
        {ota === 'ready'
          ? <Button title="Uruchom ponownie" icon="refresh" onPress={() => void restart()} />
          : <Button title="Sprawdź aktualizacje" variant="secondary" icon="cloud-download-outline" disabled={ota === 'disabled' || ota === 'checking' || ota === 'downloading'} onPress={() => void checkNow()} />}
      </Card>
      <Body muted>
        Wattly jest narzędziem informacyjnym i szacunkowym. Nie zastępuje oficjalnego rozliczenia sprzedawcy energii.
      </Body>
    </Screen>
  );
}
