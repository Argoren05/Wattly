import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useRequiredProperty } from '../../../state/PropertyContext';
import { useTheme } from '../../../theme/theme';

/** Name of an Ionicons glyph. */
type IconName = ComponentProps<typeof Ionicons>['name'];

/** Tab bar icon; React Navigation may pass a non-string color, which falls back to the default. */
function TabIcon({ name, color, size }: { name: IconName; color: unknown; size: number }) {
  return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
}

/** Creates the `tabBarIcon` renderer for an icon name. */
const icon = (name: IconName) => function TabBarIcon({ color, size }: { color: unknown; size: number }) {
  return <TabIcon name={name} color={color} size={size} />;
};

/** Bottom tab navigation: Start, Odczyty, Statystyki, Faktury, Ustawienia. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const property = useRequiredProperty();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Start', headerTitle: property.name, tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="readings" options={{ title: 'Odczyty', tabBarIcon: icon('speedometer-outline') }} />
      <Tabs.Screen name="stats" options={{ title: 'Statystyki', tabBarIcon: icon('bar-chart-outline') }} />
      <Tabs.Screen name="invoices" options={{ title: 'Faktury', tabBarIcon: icon('document-text-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ustawienia', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
