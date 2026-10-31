import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { RatePlan, RatePlanRequest, Tariff } from '../api/types';
import { parseDecimal, parseIsoDate } from '../utils/format';
import { componentTemplate, unitLabel, type ComponentDraft } from '../utils/rateTemplates';
import { radius, spacing, useTheme } from '../theme/theme';
import { DateField } from './DateField';
import { Body, Button, Field, Notice } from './ui';

/** Number shown in an input: decimal comma, no trailing zeros. */
const toInput = (value: number) => String(Number(value.toFixed(6))).replace('.', ',');

/**
 * Turns saved components into editable rows (VAT fraction -> percent).
 * @param plan Saved plan.
 */
export function draftsFromPlan(plan: RatePlan): ComponentDraft[] {
  return plan.components.map((c) => ({
    key: c.id, componentType: c.componentType, name: c.name, zoneCode: c.zoneCode, unit: c.unit,
    netRate: toInput(c.netRate), taxRate: toInput(c.taxRate * 100),
  }));
}

/**
 * Editor for the user's own price list. A new plan is pre-filled with the typical structure of the tariff; when
 * `initial` is given the saved plan is loaded for correction. Rates are typed in from an invoice or price list –
 * rows left empty are omitted.
 */
export function RatePlanForm({ tariff, defaultValidFrom, submitLabel, onSubmit, busy, initial }: {
  tariff: Tariff;
  defaultValidFrom: string;
  submitLabel: string;
  onSubmit: (request: RatePlanRequest) => void;
  busy?: boolean;
  /** Saved plan to correct (its end date is kept). */
  initial?: RatePlan;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(initial?.name ?? `Moje stawki ${tariff.code}`);
  const [validFrom, setValidFrom] = useState(initial?.validFrom ?? defaultValidFrom);
  const [source, setSource] = useState(initial?.sourceReference ?? '');
  const [rows, setRows] = useState<ComponentDraft[]>(() => (initial ? draftsFromPlan(initial) : componentTemplate(tariff.zones)));
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<ComponentDraft>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  /** Validates the form and passes a rate plan request (VAT converted from percent to fraction) to onSubmit. */
  function submit() {
    const date = parseIsoDate(validFrom);
    if (!date) return setError('Wybierz datę początku obowiązywania stawek.');
    if (initial?.validTo && date > initial.validTo) return setError('Początek obowiązywania nie może być późniejszy niż jego koniec.');
    if (!source.trim()) return setError('Wskaż źródło stawek, np. numer faktury lub nazwę cennika.');

    const filled = rows.filter((r) => r.netRate.trim() !== '');
    if (filled.length === 0) return setError('Uzupełnij co najmniej jedną stawkę.');

    const components = [];
    for (const row of filled) {
      const net = parseDecimal(row.netRate);
      const vat = parseDecimal(row.taxRate);
      if (net === null || net < 0) return setError(`Nieprawidłowa stawka: ${row.name}.`);
      if (vat === null || vat < 0 || vat > 100) return setError(`Nieprawidłowy VAT: ${row.name}.`);
      components.push({ componentType: row.componentType, name: row.name.trim() || 'Składnik', zoneCode: row.zoneCode, unit: row.unit, netRate: net, taxRate: vat / 100 });
    }

    setError(null);
    onSubmit({ tariffId: tariff.id, name: name.trim(), validFrom: date, validTo: initial?.validTo ?? null, sourceReference: source.trim(), components });
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Field label="Nazwa cennika" value={name} onChangeText={setName} />
      <DateField label="Obowiązuje od" value={validFrom} onChange={setValidFrom}
        hint="Data, od której sprzedawca stosuje te stawki (np. 1 stycznia przy nowych cenach na rok)." />
      <Field label="Źródło stawek" value={source} onChangeText={setSource} placeholder="np. faktura FV/123/2026" hint="Każda stawka musi mieć udokumentowane źródło." />
      <Body muted>Stawki netto. Puste wiersze zostaną pominięte. VAT w procentach.</Body>

      {rows.map((row) => (
        <View key={row.key} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TextInput
              value={row.name}
              onChangeText={(t) => update(row.key, { name: t })}
              accessibilityLabel="Nazwa składnika"
              style={{ flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 }}
            />
            <Pressable accessibilityRole="button" accessibilityLabel={`Usuń ${row.name}`} hitSlop={12} onPress={() => setRows((r) => r.filter((x) => x.key !== row.key))}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 2 }}>
              <Field label={`Stawka netto (${unitLabel[row.unit]})`} value={row.netRate} onChangeText={(t) => update(row.key, { netRate: t })} keyboardType="decimal-pad" placeholder="0,0000" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="VAT %" value={row.taxRate} onChangeText={(t) => update(row.key, { taxRate: t })} keyboardType="decimal-pad" />
            </View>
          </View>
        </View>
      ))}

      <Button
        title="Dodaj składnik (zł/kWh)"
        variant="ghost"
        icon="add"
        onPress={() => setRows((r) => [...r, { key: `custom${Date.now()}`, componentType: 'Other', name: 'Inna opłata', zoneCode: null, unit: 'Kwh', netRate: '', taxRate: '23' }])}
      />
      <Button
        title="Dodaj opłatę miesięczną"
        variant="ghost"
        icon="add"
        onPress={() => setRows((r) => [...r, { key: `custom${Date.now()}`, componentType: 'Other', name: 'Inna opłata stała', zoneCode: null, unit: 'Month', netRate: '', taxRate: '23' }])}
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        Wattly nie zgaduje aktualnych cen – przepisz je z faktury lub oficjalnego cennika.
      </Text>
      <Button title={submitLabel} onPress={submit} loading={busy} />
    </View>
  );
}
