/** Sample API data shared by tests. Every factory accepts overrides for the fields a test cares about. */
import type {
  CalculationResult, EnergyContract, Forecast, Invoice, Meter, Property, RatePlan, Reading, Series, Tariff, TokenResponse,
} from '../api/types';

export const tokens: TokenResponse = { tokenType: 'Bearer', accessToken: 'access-1', expiresIn: 1800, refreshToken: 'refresh-1' };

export const property = (o: Partial<Property> = {}): Property => ({
  id: 'p1', name: 'Mieszkanie', addressLine: null, postalCode: null, city: null, countryCode: 'PL', timeZoneId: 'Europe/Warsaw',
  currencyCode: 'PLN', billingPeriodMonths: 2, billingAnchorDate: '2026-09-01', monthlyBudget: null, ppeCode: null,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', ...o,
});

export const tariffG12 = (o: Partial<Tariff> = {}): Tariff => ({
  id: 't12', code: 'G12', name: 'G12 – dwustrefowa', description: 'Dzień i noc', isActive: true,
  zones: [{ code: 'DAY', name: 'Dzienna', scheduleDescription: null }, { code: 'NIGHT', name: 'Nocna', scheduleDescription: null }], ...o,
});

export const tariffG11 = (): Tariff => ({ id: 't11', code: 'G11', name: 'G11', description: null, isActive: true, zones: [] });

export const catalog = () => ({
  operators: [{ id: 'o1', name: 'Enea Operator', code: 'ENEA-OPERATOR', countryCode: 'PL', isActive: true }],
  suppliers: [{ id: 's1', name: 'Enea S.A.', code: 'ENEA', countryCode: 'PL', isActive: true }],
  tariffs: [tariffG11(), tariffG12()],
});

export const contract = (o: Partial<EnergyContract> = {}): EnergyContract => ({
  id: 'c1', propertyId: 'p1', supplierId: 's1', supplierName: 'Enea S.A.', operatorId: 'o1', operatorName: 'Enea Operator',
  tariffId: 't12', tariffCode: 'G12', contractedPowerKw: 7, validFrom: '2026-01-01', validTo: null, ...o,
});

export const meter = (o: Partial<Meter> = {}): Meter => ({
  id: 'm1', propertyId: 'p1', name: 'Licznik główny', serialNumber: '123', meterType: 'Conventional', directionality: 'ImportOnly',
  installedAt: null, removedAt: null, isActive: true,
  registers: [
    { id: 'rDay', meterId: 'm1', code: '1.8.1', name: 'Dzień', registerType: 'Import', zoneCode: 'DAY', unit: 'kWh', decimalPlaces: 1 },
    { id: 'rNight', meterId: 'm1', code: '1.8.2', name: 'Noc', registerType: 'Import', zoneCode: 'NIGHT', unit: 'kWh', decimalPlaces: 1 },
  ],
  ...o,
});

export const reading = (o: Partial<Reading> = {}): Reading => ({
  id: 'read1', registerId: 'rDay', readingAt: '2026-10-20T06:00:00Z', value: 1250, unit: 'kWh', source: 'Manual', confidence: null,
  note: null, status: 'Active', supersedesReadingId: null, voidReason: null, createdAt: '2026-10-20T06:00:00Z',
  consumptionSincePrevious: 100, daysSincePrevious: 19, ...o,
});

export const forecast = (o: Partial<Forecast> = {}): Forecast => ({
  propertyId: 'p1', periodStart: '2026-09-01', periodEnd: '2026-10-31', periodStartAt: '2026-08-31T22:00:00Z', periodEndAt: '2026-10-31T23:00:00Z',
  daysTotal: 61, daysElapsed: 60, lastReadingAt: '2026-10-20T06:00:00Z', consumptionToDateKwh: 410, costToDateGross: 343.4,
  forecastConsumptionKwh: 510.8, forecastCostNet: 347.67, forecastCostGross: 427.63, averageDailyKwh: 8.37, averageDailyCostGross: 7.01,
  budgetForPeriod: 400, budgetUsagePercent: 106.9, currencyCode: 'PLN', hasContract: true, hasRatePlans: true, readingsCount: 6,
  isEstimate: true, isComplete: true, assumptions: ['Kalkulacja ma charakter informacyjny.', 'Prognoza zakłada średnie zużycie.'], ...o,
});

export const series = (o: Partial<Series> = {}): Series => ({
  propertyId: 'p1', granularity: 'Day', from: '2026-10-01', to: '2026-10-03', currencyCode: 'PLN', totalConsumptionKwh: 20, totalCostGross: 15,
  isEstimate: true,
  points: [
    { periodStart: '2026-10-01', periodEnd: '2026-10-01', consumptionKwh: 8, costGross: 6, isEstimate: false, isPartial: false },
    { periodStart: '2026-10-02', periodEnd: '2026-10-02', consumptionKwh: 12, costGross: 9, isEstimate: true, isPartial: false },
  ],
  assumptions: ['Wartości pomiędzy odczytami są estymacją liniową.'], ...o,
});

export const calculation = (o: Partial<CalculationResult> = {}): CalculationResult => ({
  id: null, propertyId: 'p1', periodStart: '2026-08-31T22:00:00Z', periodEnd: '2026-10-31T23:00:00Z', calculatedAt: '2026-10-30T12:00:00Z',
  calculationVersion: 1, consumptionKwh: 250, consumptionByZone: [{ zoneCode: 'DAY', consumptionKwh: 150 }, { zoneCode: 'NIGHT', consumptionKwh: 100 }],
  sourceValues: [], ratePlans: [{ id: 'rp1', name: 'Moje stawki', validFrom: '2026-01-01', validTo: null, sourceReference: 'Faktura 1' }],
  lines: [
    { ratePlanId: 'rp1', ratePlanName: 'Moje stawki', componentType: 'Energy', category: 'Energy', componentName: 'Energia dzień', zoneCode: 'DAY', unit: 'Kwh', quantity: 150, netRate: 0.5, taxRate: 0.23, netAmount: 75, segmentStart: '', segmentEnd: '' },
    { ratePlanId: 'rp1', ratePlanName: 'Moje stawki', componentType: 'FixedDistribution', category: 'Distribution', componentName: 'Opłata stała', zoneCode: null, unit: 'Month', quantity: 1, netRate: 10, taxRate: 0.23, netAmount: 10, segmentStart: '', segmentEnd: '' },
  ],
  taxes: [{ taxRate: 0.23, netAmount: 85, taxAmount: 19.55 }], energyCostNet: 75, distributionCostNet: 10, otherCostNet: 0, totalNet: 85,
  taxAmount: 19.55, totalGross: 104.55, currencyCode: 'PLN', isEstimate: true, isComplete: true, assumptions: ['Prognoza – nie faktura.'], ...o,
});

export const ratePlan = (o: Partial<RatePlan> = {}): RatePlan => ({
  id: 'rp1', tariffId: 't12', tariffCode: 'G12', supplierId: null, operatorId: null, propertyId: 'p1', name: 'Moje stawki', validFrom: '2026-01-01',
  validTo: null, currencyCode: 'PLN', sourceReference: 'Faktura 1', publishedAt: null, createdAt: '2026-01-01T00:00:00Z',
  components: [{ id: 'k1', componentType: 'Energy', category: 'Energy', name: 'Energia dzień', zoneCode: 'DAY', unit: 'Kwh', netRate: 0.5, taxRate: 0.23 }], ...o,
});

export const invoice = (o: Partial<Invoice> = {}): Invoice => ({
  id: 'i1', propertyId: 'p1', supplierId: null, invoiceNumber: 'FV/1/2026', issueDate: '2026-10-05', periodStart: '2026-09-01', periodEnd: '2026-09-30',
  consumptionKwh: 250, totalNet: null, totalGross: 150, currencyCode: 'PLN', notes: 'Uwagi', attachment: null,
  comparison: { estimatedGross: 141.45, estimatedConsumptionKwh: 250, differenceGross: 8.55, differencePercent: 6, isEstimate: false, isComplete: true },
  createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', ...o,
});
