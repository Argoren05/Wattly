import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { radius, spacing, useTheme } from '../theme/theme';
import { formatDate, formatDateTime, parseFieldDate, toIsoDate, toLocalDateTimeText, toOffsetIso } from '../utils/format';
import { Field } from './ui';

/** Props of {@link DateField}. */
export interface DateFieldProps {
  /** Visible label, also announced by screen readers. */
  label: string;
  /** Current value: "YYYY-MM-DD" (date), "YYYY-MM-DD HH:mm" (datetime) or "HH:mm" (time), local time. */
  value: string;
  /** Receives the new value in the same text format. */
  onChange: (value: string) => void;
  /** Date only (default), date and time, or time of day only. */
  mode?: 'date' | 'datetime' | 'time';
  /** Help text under the field. */
  hint?: string;
  /** Validation message (replaces the hint). */
  error?: string;
  /** Earliest selectable date. */
  minimumDate?: Date;
  /** Latest selectable date. */
  maximumDate?: Date;
}

/** Converts a picked Date back to the text format of the field. */
const toText = (date: Date, mode: 'date' | 'datetime' | 'time') =>
  mode === 'date' ? toIsoDate(date) : mode === 'time' ? toLocalDateTimeText(date).slice(11) : toLocalDateTimeText(date);

/** Parses the field value; a time-only value becomes today at that time. */
function parseValue(value: string, mode: 'date' | 'datetime' | 'time'): Date | null {
  if (mode !== 'time') return parseFieldDate(value);
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(match[1]), Number(match[2]));
}

/**
 * Date (and time) field with the platform's native picker:
 * - Android: the system calendar dialog, then the clock dialog for date-time fields;
 * - iOS: the native compact picker;
 * - web: a plain text field ("RRRR-MM-DD").
 * The chosen value is displayed in the phone's date format (system language and region).
 */
export function DateField({ label, value, onChange, mode = 'date', hint, error, minimumDate, maximumDate }: DateFieldProps) {
  const { colors, dark } = useTheme();
  const current = parseValue(value, mode) ?? new Date();

  if (Platform.OS === 'web') {
    return <Field label={label} value={value} onChangeText={onChange} hint={hint} error={error}
      placeholder={mode === 'date' ? 'RRRR-MM-DD' : mode === 'time' ? 'GG:MM' : 'RRRR-MM-DD GG:MM'} />;
  }

  const help = error ? <Text style={[styles.help, { color: colors.danger }]}>{error}</Text>
    : hint ? <Text style={[styles.help, { color: colors.textMuted }]}>{hint}</Text> : null;

  if (Platform.OS === 'ios') {
    return (
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <DateTimePicker accessibilityLabel={label} value={current} mode={mode} display="compact" themeVariant={dark ? 'dark' : 'light'}
          minimumDate={minimumDate} maximumDate={maximumDate}
          onValueChange={(_, date) => onChange(toText(date, mode))} />
        {help}
      </View>
    );
  }

  /** Opens the Android dialogs: the clock for time fields; otherwise the date, then (for date-time) the clock. */
  const open = () => {
    if (mode === 'time') {
      DateTimePickerAndroid.open({ value: current, mode: 'time', onValueChange: (_, time) => onChange(toText(time, 'time')) });
      return;
    }
    DateTimePickerAndroid.open({
      value: current, mode: 'date', minimumDate, maximumDate,
      onValueChange: (_, date) => {
        if (mode === 'date') return onChange(toText(date, 'date'));
        const withDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), current.getHours(), current.getMinutes());
        DateTimePickerAndroid.open({ value: withDay, mode: 'time', onValueChange: (__, time) => onChange(toText(time, 'datetime')) });
      },
    });
  };

  const parsed = parseValue(value, mode);
  const shown = !parsed ? (mode === 'time' ? 'Wybierz godzinę' : 'Wybierz datę')
    : mode === 'date' ? formatDate(value) : mode === 'time' ? value.trim() : formatDateTime(toOffsetIso(parsed));
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: shown }}
        accessibilityHint={mode === 'time' ? 'Otwiera zegar' : 'Otwiera kalendarz'} onPress={open}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}>
        <Text style={{ color: parsed ? colors.text : colors.textMuted, fontSize: 16 }}>{shown}</Text>
        <Ionicons name={mode === 'date' ? 'calendar-outline' : 'time-outline'} size={20} color={colors.textMuted} />
      </Pressable>
      {help}
    </View>
  );
}

/** Same look as the text fields in ui.tsx. */
const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  help: { fontSize: 13 },
});
