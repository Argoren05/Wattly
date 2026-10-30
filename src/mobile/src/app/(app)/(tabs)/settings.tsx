import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';

import { authApi } from '../../../api/endpoints';
import { useAuth } from '../../../auth/AuthContext';
import { Body, Button, Card, Chips, Screen, SectionTitle } from '../../../components/ui';
import { useProperty } from '../../../state/PropertyContext';
import { spacing, useTheme } from '../../../theme/theme';

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

export default function Settings() {
  const { signOut } = useAuth();
  const { properties, property, select } = useProperty();
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me });

  return (
    <Screen>
      {properties.length > 1 ? (
        <Card>
          <SectionTitle>Wybrana nieruchomość</SectionTitle>
          <Chips value={property?.id ?? null} onChange={select} options={properties.map((p) => ({ value: p.id, label: p.name }))} />
        </Card>
      ) : null}
      <Card>
        <Item icon="home-outline" title="Nieruchomość" subtitle="Nazwa, okres rozliczeniowy, budżet" href="/settings/property" />
        <Item icon="flash-outline" title="Umowa i taryfa" subtitle="Operator, sprzedawca, grupa taryfowa" href="/settings/contract" />
        <Item icon="pricetags-outline" title="Stawki" subtitle="Cenniki i ich okresy obowiązywania" href="/settings/rates" />
        <Item icon="speedometer-outline" title="Liczniki i rejestry" subtitle="Konfiguracja liczników" href="/settings/meters" />
      </Card>
      <Card>
        <SectionTitle>Konto</SectionTitle>
        <Body muted>{me.data?.email ?? ''}</Body>
        <Button title="Wyloguj" variant="secondary" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/login'); }} />
      </Card>
      <Body muted>
        Wattly jest narzędziem informacyjnym i szacunkowym. Nie zastępuje oficjalnego rozliczenia sprzedawcy energii.
      </Body>
    </Screen>
  );
}
