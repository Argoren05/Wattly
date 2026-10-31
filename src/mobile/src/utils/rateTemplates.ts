import type { RateComponentType, RateUnit, TariffZone } from '../api/types';

/** Editable row of the rate plan form (values kept as typed text). */
export interface ComponentDraft {
  key: string;
  componentType: RateComponentType;
  name: string;
  zoneCode: string | null;
  unit: RateUnit;
  netRate: string;
  taxRate: string;
}

/** Default VAT for electricity in Poland, in percent. */
const DEFAULT_VAT = '23';

/** Counter for unique row keys. */
let counter = 0;
/** Creates a unique row key. */
const key = () => `c${++counter}`;

/**
 * Typical components of a Polish household bill. Only the structure is suggested –
 * the user enters rates from their own price list or invoice (no rates are guessed).
 */
export function componentTemplate(zones: TariffZone[]): ComponentDraft[] {
  const energy: ComponentDraft[] = zones.length === 0
    ? [{ key: key(), componentType: 'Energy', name: 'Energia czynna', zoneCode: null, unit: 'Kwh', netRate: '', taxRate: DEFAULT_VAT }]
    : zones.map((z) => ({ key: key(), componentType: 'Energy' as const, name: `Energia czynna – ${z.name.toLowerCase()}`, zoneCode: z.code, unit: 'Kwh' as const, netRate: '', taxRate: DEFAULT_VAT }));

  const variable: ComponentDraft[] = zones.length === 0
    ? [{ key: key(), componentType: 'VariableDistribution', name: 'Opłata sieciowa zmienna', zoneCode: null, unit: 'Kwh', netRate: '', taxRate: DEFAULT_VAT }]
    : zones.map((z) => ({ key: key(), componentType: 'VariableDistribution' as const, name: `Opłata sieciowa zmienna – ${z.name.toLowerCase()}`, zoneCode: z.code, unit: 'Kwh' as const, netRate: '', taxRate: DEFAULT_VAT }));

  return [
    ...energy,
    ...variable,
    { key: key(), componentType: 'VariableDistribution', name: 'Opłata jakościowa', zoneCode: null, unit: 'Kwh', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'Other', name: 'Opłata OZE i kogeneracyjna', zoneCode: null, unit: 'Kwh', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'FixedDistribution', name: 'Opłata sieciowa stała', zoneCode: null, unit: 'Month', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'FixedDistribution', name: 'Opłata przejściowa', zoneCode: null, unit: 'Month', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'Capacity', name: 'Opłata mocowa', zoneCode: null, unit: 'Month', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'FixedDistribution', name: 'Opłata abonamentowa', zoneCode: null, unit: 'Month', netRate: '', taxRate: DEFAULT_VAT },
    { key: key(), componentType: 'Subscription', name: 'Opłata handlowa', zoneCode: null, unit: 'Month', netRate: '', taxRate: DEFAULT_VAT },
  ];
}

/** Units shown next to rate inputs. */
export const unitLabel: Record<RateUnit, string> = {
  Kwh: 'zł/kWh',
  Month: 'zł/mies.',
  Day: 'zł/dzień',
  Kw: 'zł/kW/mies.',
};
