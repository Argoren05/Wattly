// Contract types mirroring the Wattly REST API (/api/v1). Decimal values arrive as JSON numbers.

export type ReadingSource = 'Manual' | 'Ocr' | 'Import' | 'Integration';
export type ReadingStatus = 'Active' | 'Superseded' | 'Voided';
export type RegisterType = 'Import' | 'Export';
export type MeterType = 'Conventional' | 'Smart';
export type MeterDirectionality = 'ImportOnly' | 'Bidirectional';
export type RateComponentType = 'Energy' | 'VariableDistribution' | 'FixedDistribution' | 'Subscription' | 'Capacity' | 'Other';
export type RateUnit = 'Kwh' | 'Month' | 'Day' | 'Kw';
export type CostCategory = 'Energy' | 'Distribution' | 'Other';
export type Granularity = 'Day' | 'Week' | 'Month' | 'Year';
export type ValueKind = 'Actual' | 'Interpolated' | 'Extrapolated';

export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string | null;
  roles: string[];
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface Property {
  id: string;
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  timeZoneId: string;
  currencyCode: string;
  billingPeriodMonths: number;
  billingAnchorDate: string;
  monthlyBudget: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyRequest {
  name: string;
  addressLine?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string | null;
  timeZoneId?: string | null;
  currencyCode?: string | null;
  billingPeriodMonths?: number | null;
  billingAnchorDate?: string | null;
  monthlyBudget?: number | null;
}

export interface CatalogEntry {
  id: string;
  name: string;
  code: string;
  countryCode: string;
  isActive: boolean;
}

export interface TariffZone {
  code: string;
  name: string;
  scheduleDescription: string | null;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  zones: TariffZone[];
}

export interface EnergyContract {
  id: string;
  propertyId: string;
  supplierId: string | null;
  supplierName: string | null;
  operatorId: string | null;
  operatorName: string | null;
  tariffId: string;
  tariffCode: string;
  contractedPowerKw: number | null;
  validFrom: string;
  validTo: string | null;
}

export interface EnergyContractRequest {
  supplierId: string | null;
  operatorId: string | null;
  tariffId: string;
  contractedPowerKw: number | null;
  validFrom: string;
  validTo: string | null;
}

export interface RateComponent {
  id: string;
  componentType: RateComponentType;
  category: CostCategory;
  name: string;
  zoneCode: string | null;
  unit: RateUnit;
  netRate: number;
  taxRate: number;
}

export interface RatePlan {
  id: string;
  tariffId: string;
  tariffCode: string;
  supplierId: string | null;
  operatorId: string | null;
  propertyId: string | null;
  name: string;
  validFrom: string;
  validTo: string | null;
  currencyCode: string;
  sourceReference: string;
  publishedAt: string | null;
  createdAt: string;
  components: RateComponent[];
}

export interface RateComponentRequest {
  componentType: RateComponentType;
  name: string;
  zoneCode: string | null;
  unit: RateUnit;
  netRate: number;
  taxRate: number;
}

export interface RatePlanRequest {
  tariffId: string;
  supplierId?: string | null;
  operatorId?: string | null;
  name: string;
  validFrom: string;
  validTo?: string | null;
  currencyCode?: string | null;
  sourceReference: string;
  publishedAt?: string | null;
  components: RateComponentRequest[];
}

export interface Register {
  id: string;
  meterId: string;
  code: string | null;
  name: string;
  registerType: RegisterType;
  zoneCode: string | null;
  unit: string;
  decimalPlaces: number;
}

export interface Meter {
  id: string;
  propertyId: string;
  name: string;
  serialNumber: string | null;
  meterType: MeterType;
  directionality: MeterDirectionality;
  installedAt: string | null;
  removedAt: string | null;
  isActive: boolean;
  registers: Register[];
}

export interface RegisterRequest {
  name: string;
  registerType: RegisterType;
  zoneCode: string | null;
  code?: string | null;
  decimalPlaces?: number | null;
}

export interface MeterRequest {
  name: string;
  serialNumber?: string | null;
  meterType: MeterType;
  directionality: MeterDirectionality;
  installedAt?: string | null;
  removedAt?: string | null;
  isActive?: boolean | null;
  registers?: RegisterRequest[];
}

export interface Reading {
  id: string;
  registerId: string;
  readingAt: string;
  value: number;
  unit: string;
  source: ReadingSource;
  confidence: number | null;
  note: string | null;
  status: ReadingStatus;
  supersedesReadingId: string | null;
  voidReason: string | null;
  createdAt: string;
  consumptionSincePrevious: number | null;
  daysSincePrevious: number | null;
}

export interface ReadingRequest {
  readingAt: string;
  value: number;
  source?: ReadingSource;
  note?: string | null;
  confirmAnomaly?: boolean;
}

export interface ReadingSaved {
  reading: Reading;
  warnings: { code: string; message: string }[];
}

export interface CostLine {
  ratePlanId: string;
  ratePlanName: string;
  componentType: RateComponentType;
  category: CostCategory;
  componentName: string;
  zoneCode: string | null;
  unit: RateUnit;
  quantity: number;
  netRate: number;
  taxRate: number;
  netAmount: number;
  segmentStart: string;
  segmentEnd: string;
}

export interface CalculationResult {
  id: string | null;
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  calculatedAt: string;
  calculationVersion: number;
  consumptionKwh: number;
  consumptionByZone: { zoneCode: string | null; consumptionKwh: number }[];
  sourceValues: { registerId: string; registerName: string; zoneCode: string | null; at: string; value: number | null; kind: ValueKind | null }[];
  ratePlans: { id: string; name: string; validFrom: string | null; validTo: string | null; sourceReference: string | null }[];
  lines: CostLine[];
  taxes: { taxRate: number; netAmount: number; taxAmount: number }[];
  energyCostNet: number;
  distributionCostNet: number;
  otherCostNet: number;
  totalNet: number;
  taxAmount: number;
  totalGross: number;
  currencyCode: string;
  isEstimate: boolean;
  isComplete: boolean;
  assumptions: string[];
}

export interface SeriesPoint {
  periodStart: string;
  periodEnd: string;
  consumptionKwh: number | null;
  costGross: number | null;
  isEstimate: boolean;
  isPartial: boolean;
}

export interface Series {
  propertyId: string;
  granularity: Granularity;
  from: string;
  to: string;
  currencyCode: string;
  totalConsumptionKwh: number;
  totalCostGross: number | null;
  isEstimate: boolean;
  points: SeriesPoint[];
  assumptions: string[];
}

export interface Forecast {
  propertyId: string;
  periodStart: string;
  periodEnd: string;
  /** Exact instants of the billing period in the property time zone (end exclusive). */
  periodStartAt: string;
  periodEndAt: string;
  daysTotal: number;
  daysElapsed: number;
  lastReadingAt: string | null;
  consumptionToDateKwh: number;
  costToDateGross: number;
  forecastConsumptionKwh: number;
  forecastCostNet: number;
  forecastCostGross: number;
  averageDailyKwh: number | null;
  averageDailyCostGross: number | null;
  budgetForPeriod: number | null;
  budgetUsagePercent: number | null;
  currencyCode: string;
  hasContract: boolean;
  hasRatePlans: boolean;
  readingsCount: number;
  isEstimate: boolean;
  isComplete: boolean;
  assumptions: string[];
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Invoice {
  id: string;
  propertyId: string;
  supplierId: string | null;
  invoiceNumber: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  consumptionKwh: number | null;
  totalNet: number | null;
  totalGross: number;
  currencyCode: string;
  notes: string | null;
  attachment: Attachment | null;
  comparison: {
    estimatedGross: number;
    estimatedConsumptionKwh: number;
    differenceGross: number;
    differencePercent: number | null;
    isEstimate: boolean;
    isComplete: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRequest {
  supplierId?: string | null;
  invoiceNumber: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  consumptionKwh?: number | null;
  totalNet?: number | null;
  totalGross: number;
  notes?: string | null;
}
