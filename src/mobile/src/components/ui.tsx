import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type TextInputProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage, NetworkError } from '../api/errors';
import { radius, spacing, useTheme } from '../theme/theme';

/** Name of an Ionicons glyph. */
type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Screen container: safe area, optional pull-to-refresh, max width for tablets.
 * @param props.scroll Wrap content in a ScrollView (default true).
 */
export function Screen({ children, refreshing, onRefresh, scroll = true }: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  const content = <View style={styles.screenContent}>{children}</View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing ?? false} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : content}
    </SafeAreaView>
  );
}

/** Rounded surface grouping related content. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>;
}

/** Screen title (accessibility header). */
export function Title({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{children}</Text>;
}

/** Section heading (accessibility header). */
export function SectionTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>{children}</Text>;
}

/** Body text; `muted` renders secondary text. */
export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  const { colors } = useTheme();
  return <Text style={[styles.body, { color: muted ? colors.textMuted : colors.text }, style]}>{children}</Text>;
}

/** Accessible button (min. 48 px touch target) with variants, icon and loading state. */
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, accessibilityHint }: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerSurface, fg: colors.danger, border: colors.dangerSurface },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
      <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Labelled text input with error or hint below it. */
export function Field({ label, error, hint, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}
        {...props}
      />
      {error ? <Text style={[styles.help, { color: colors.danger }]}>{error}</Text> : hint ? <Text style={[styles.help, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

/** Single-choice chips exposed to screen readers as a radio group. */
export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: colors.text }]}>{label}</Text> : null}
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface }]}
            >
              {selected ? <Ionicons name="checkmark" size={14} color={colors.primaryText} /> : null}
              <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: '600' }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Tile with a key figure; estimates are marked with a text badge. */
export function Stat({ label, value, caption, estimate }: { label: string; value: string; caption?: string; estimate?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {estimate ? <EstimateBadge /> : null}
      {caption ? <Text style={[styles.help, { color: colors.textMuted }]}>{caption}</Text> : null}
    </View>
  );
}

/** Estimates are marked with text and an icon, never by color alone. */
export function EstimateBadge({ label = 'Dane szacunkowe' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.estimateSurface }]} accessibilityLabel={label}>
      <Ionicons name="analytics-outline" size={12} color={colors.estimate} />
      <Text style={{ color: colors.estimate, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

/** Information, warning or error message with an optional action. */
export function Notice({ tone = 'info', title, children, action }: {
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const palette = {
    info: { bg: colors.surfaceMuted, fg: colors.text, icon: 'information-circle-outline' as const },
    warning: { bg: colors.warningSurface, fg: colors.warning, icon: 'warning-outline' as const },
    danger: { bg: colors.dangerSurface, fg: colors.danger, icon: 'alert-circle-outline' as const },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg }]} accessibilityRole="alert">
      <Ionicons name={palette.icon} size={20} color={palette.fg} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        {title ? <Text style={{ color: palette.fg, fontWeight: '700' }}>{title}</Text> : null}
        <Text style={{ color: palette.fg }}>{children}</Text>
        {action}
      </View>
    </View>
  );
}

/** Centered loading indicator. */
export function Loading({ label = 'Wczytywanie…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ color: colors.textMuted }}>{label}</Text>
    </View>
  );
}

/** Error message (offline vs. other) with an optional retry button. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof NetworkError;
  return (
    <View style={styles.center}>
      <Notice tone="danger" title={offline ? 'Brak połączenia' : 'Nie udało się wczytać danych'}>
        {errorMessage(error)}
      </Notice>
      {onRetry ? <Button title="Spróbuj ponownie" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

/** Empty-data message with icon and optional action. */
export function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={[styles.sectionTitle, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={{ color: colors.textMuted, textAlign: 'center' }}>{description}</Text>
      {action}
    </View>
  );
}

/** Horizontal, wrapping layout row. */
export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Label–value line of a details list. */
export function KeyValue({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.keyValue}>
      <Text style={{ color: colors.textMuted, flexShrink: 1 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}

/** Shared styles of the UI primitives. */
const styles = StyleSheet.create({
  screenContent: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 26, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  button: {
    minHeight: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  help: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stat: { flex: 1, minWidth: 140, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs },
  statLabel: { fontSize: 13, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  keyValue: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 2 },
});
