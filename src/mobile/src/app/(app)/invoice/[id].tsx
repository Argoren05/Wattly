import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform } from 'react-native';

import { errorMessage } from '../../../api/errors';
import { invoiceApi } from '../../../api/endpoints';
import { Body, Button, Card, EstimateBadge, ErrorState, KeyValue, Loading, Notice, Screen, SectionTitle } from '../../../components/ui';
import { keys, useInvalidateEnergyData } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { formatDate, formatKwh, formatMoney, formatPercent } from '../../../utils/format';

export default function InvoiceDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const property = useRequiredProperty();
  const invalidate = useInvalidateEnergyData();
  const invoice = useQuery({ queryKey: keys.invoice(id), queryFn: () => invoiceApi.get(id) });
  const remove = useMutation({
    mutationFn: () => invoiceApi.remove(id),
    onSuccess: async () => {
      await invalidate(property.id);
      router.back();
    },
  });

  const confirmRemove = () => {
    const message = 'Faktura i jej załącznik zostaną trwale usunięte.';
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) remove.mutate();
      return;
    }
    Alert.alert('Usunąć fakturę?', message, [{ text: 'Anuluj', style: 'cancel' }, { text: 'Usuń', style: 'destructive', onPress: () => remove.mutate() }]);
  };

  if (invoice.isLoading) return <Loading />;
  if (invoice.error || !invoice.data) return <Screen><ErrorState error={invoice.error} onRetry={() => invoice.refetch()} /></Screen>;
  const i = invoice.data;
  const c = i.comparison;

  return (
    <Screen>
      <Card>
        <SectionTitle>{i.invoiceNumber}</SectionTitle>
        <KeyValue label="Okres" value={`${formatDate(i.periodStart)} – ${formatDate(i.periodEnd)}`} />
        <KeyValue label="Data wystawienia" value={formatDate(i.issueDate)} />
        <KeyValue label="Rzeczywista kwota faktury" value={formatMoney(i.totalGross, i.currencyCode)} />
        {i.consumptionKwh !== null ? <KeyValue label="Zużycie z faktury" value={formatKwh(i.consumptionKwh)} /> : null}
        {i.attachment ? <KeyValue label="Załącznik" value={i.attachment.fileName} /> : null}
        {i.notes ? <Body muted>{i.notes}</Body> : null}
      </Card>

      <Card>
        <SectionTitle>Porównanie z szacunkiem</SectionTitle>
        {c ? (
          <>
            <KeyValue label="Szacowany koszt (Wattly)" value={formatMoney(c.estimatedGross, i.currencyCode)} />
            <KeyValue label="Szacowane zużycie" value={formatKwh(c.estimatedConsumptionKwh)} />
            <KeyValue label="Różnica" value={`${formatMoney(c.differenceGross, i.currencyCode)}${c.differencePercent !== null ? ` (${formatPercent(c.differencePercent)})` : ''}`} />
            {c.isEstimate ? <EstimateBadge /> : null}
            {!c.isComplete ? <Notice tone="warning">Brakuje odczytów lub stawek dla części okresu – porównanie jest niepełne.</Notice> : null}
          </>
        ) : <Body muted>Brak stawek lub odczytów dla okresu faktury.</Body>}
      </Card>

      {remove.error ? <Notice tone="danger">{errorMessage(remove.error)}</Notice> : null}
      <Button title="Usuń fakturę" variant="danger" icon="trash-outline" onPress={confirmRemove} loading={remove.isPending} />
    </Screen>
  );
}
