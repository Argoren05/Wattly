import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Platform } from 'react-native';

import { errorMessage } from '../../../api/errors';
import { invoiceApi } from '../../../api/endpoints';
import { DateField } from '../../../components/DateField';
import { Body, Button, Card, Field, Notice, Screen } from '../../../components/ui';
import { useInvalidateEnergyData } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { parseDecimal, parseIsoDate, toIsoDate } from '../../../utils/format';

/** File selected with the document picker. */
type PickedFile = DocumentPicker.DocumentPickerAsset;

/** Builds multipart data for both native (uri object) and web (File) uploads. */
/** Builds multipart data for native (uri object) and web (File) uploads. */
async function toFormData(file: PickedFile): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web' && file.file) {
    form.append('file', file.file, file.name);
  } else {
    form.append('file', { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
  return form;
}

/** Form adding an invoice with an optional PDF/JPEG/PNG attachment. */
export default function NewInvoice() {
  const property = useRequiredProperty();
  const invalidate = useInvalidateEnergyData();
  const [number, setNumber] = useState('');
  const [issueDate, setIssueDate] = useState(toIsoDate(new Date()));
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [gross, setGross] = useState('');
  const [consumption, setConsumption] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Opens the document picker limited to allowed file types. */
  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (!result.canceled) setFile(result.assets[0] ?? null);
  }

  /** Validates the form, saves the invoice, uploads the attachment and opens the details. */
  async function submit() {
    const start = parseIsoDate(periodStart);
    const end = parseIsoDate(periodEnd);
    const issue = parseIsoDate(issueDate);
    const total = parseDecimal(gross);
    const kwh = consumption.trim() ? parseDecimal(consumption) : null;
    if (!number.trim()) return setError('Podaj numer faktury.');
    if (!issue || !start || !end) return setError('Wybierz datę wystawienia i okres faktury.');
    if (end < start) return setError('Koniec okresu nie może być przed początkiem.');
    if (total === null) return setError('Podaj kwotę brutto.');
    if (consumption.trim() && (kwh === null || kwh < 0)) return setError('Nieprawidłowe zużycie.');
    if (file?.size && file.size > 10 * 1024 * 1024) return setError('Załącznik może mieć maksymalnie 10 MB.');

    setBusy(true);
    setError(null);
    try {
      const invoice = await invoiceApi.create(property.id, {
        invoiceNumber: number.trim(), issueDate: issue, periodStart: start, periodEnd: end, totalGross: total, consumptionKwh: kwh, notes: notes.trim() || null,
      });
      if (file) await invoiceApi.attach(invoice.id, await toFormData(file));
      await invalidate(property.id);
      router.replace({ pathname: '/invoice/[id]', params: { id: invoice.id } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Field label="Numer faktury" value={number} onChangeText={setNumber} />
        <DateField label="Data wystawienia" value={issueDate} onChange={setIssueDate} />
        <DateField label="Okres od" value={periodStart} onChange={setPeriodStart} />
        <DateField label="Okres do (włącznie)" value={periodEnd} onChange={setPeriodEnd} />
        <Field label={`Kwota brutto (${property.currencyCode})`} value={gross} onChangeText={setGross} keyboardType="decimal-pad" />
        <Field label="Zużycie kWh (opcjonalnie)" value={consumption} onChangeText={setConsumption} keyboardType="decimal-pad" />
        <Field label="Notatki (opcjonalnie)" value={notes} onChangeText={setNotes} multiline />
        <Button title={file ? `Załącznik: ${file.name}` : 'Dodaj PDF lub zdjęcie'} variant="secondary" icon="attach-outline" onPress={pick} />
        <Body muted>Dozwolone: PDF, JPEG, PNG do 10 MB.</Body>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button title="Zapisz fakturę" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
