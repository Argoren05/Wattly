import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { invoiceApi } from '../../../api/endpoints';
import { syncInvoicePayments } from '../../../reminders/center';
import { Button, Card, EmptyState, ErrorState, Loading, Screen } from '../../../components/ui';
import { keys } from '../../../hooks/queries';
import { useRequiredProperty } from '../../../state/PropertyContext';
import { spacing, useTheme } from '../../../theme/theme';
import { formatDate, formatMoney, formatPercent } from '../../../utils/format';

/** Invoices tab: list with comparison against Wattly's estimate. */
export default function Invoices() {
  const property = useRequiredProperty();
  const { colors } = useTheme();
  const invoices = useQuery({ queryKey: keys.invoices(property.id), queryFn: () => invoiceApi.list(property.id) });
  // Keep payment reminders in step with the invoices (deadlines added, changed or deleted).
  useEffect(() => {
    if (invoices.data) void syncInvoicePayments(property.id, invoices.data);
  }, [invoices.data, property.id]);
  const add = <Button title="Dodaj fakturę" icon="add-circle-outline" onPress={() => router.push('/invoice/new')} />;

  if (invoices.isLoading) return <Loading />;
  if (invoices.error) return <Screen><ErrorState error={invoices.error} onRetry={() => invoices.refetch()} /></Screen>;
  if (!invoices.data?.length) {
    return <Screen><EmptyState icon="document-text-outline" title="Brak faktur" description="Dodaj fakturę, aby porównać rzeczywistą kwotę z szacunkiem Wattly." action={add} /></Screen>;
  }

  return (
    <Screen refreshing={invoices.isRefetching} onRefresh={() => invoices.refetch()}>
      {add}
      {invoices.data.map((invoice) => (
        <Pressable key={invoice.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/invoice/[id]', params: { id: invoice.id } })}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
              <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }}>{invoice.invoiceNumber}</Text>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{formatMoney(invoice.totalGross, invoice.currencyCode)}</Text>
            </View>
            <Text style={{ color: colors.textMuted }}>{formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}</Text>
            {invoice.dueDate ? (
              <Text style={{ color: colors.textMuted }}>
                Termin płatności: {formatDate(invoice.dueDate)}{invoice.amountDue !== null ? ` · do zapłaty ${formatMoney(invoice.amountDue, invoice.currencyCode)}` : ''}
              </Text>
            ) : null}
            {invoice.comparison ? (
              <Text style={{ color: colors.textMuted }}>
                Szacunek Wattly: {formatMoney(invoice.comparison.estimatedGross, invoice.currencyCode)} · różnica {formatMoney(invoice.comparison.differenceGross, invoice.currencyCode)}
                {invoice.comparison.differencePercent !== null ? ` (${formatPercent(invoice.comparison.differencePercent)})` : ''}
              </Text>
            ) : <Text style={{ color: colors.textMuted }}>Brak danych do porównania</Text>}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
