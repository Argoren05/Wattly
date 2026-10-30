import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import type { RatePlanRequest, Tariff } from '../api/types';
import { parseDecimal, parseIsoDate } from '../utils/format';
import { componentTemplate, unitLabel, type ComponentDraft } from '../utils/rateTemplates';
import { radius, spacing, useTheme } from '../theme/theme';
import { Body, Button, Field, Notice } from './ui';

/**
 * Editor for the user's own price list. The structure is pre-filled from the tariff, the rates are typed in
 * from an invoice or price list – rows left empty are omitted.
 */
export function RatePlanForm({ tariff, defaultValidFrom, submitLabel, onSubmit, busy }: {
  tariff: Tariff;
  defaultValidFrom: string;
  submitLabel: string;
  onSubmit: (request: RatePlanRequest) => void;
  busy?: boolean;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState(`Moje stawki ${tariff.code}`);
  const [validFrom, setValidFrom] = useState(defaultValidFrom);
  const [source, setSource] = useState('');
  const [rows, setRows] = useState<ComponentDraft[]>(() => componentTemplate(tariff.zones));
  const [error, setError] = useState<string | null>(null);

  const update = (key: string, patch: Partial<ComponentDraft>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  function submit() {
    const date = parseIsoDate(validFrom);
    if (!date) return setError('Podaj datę obowiązywania w formacie RRRR-MM-DD.');
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
    onSubmit({ tariffId: tariff.id, name: name.trim(), validFrom: date, sourceReference: source.trim(), components });
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Field label="Nazwa cennika" value={name} onChangeText={setName} />
      <Field label="Obowiązuje od" value={validFrom} onChangeText={setValidFrom} placeholder="RRRR-MM-DD" />
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
