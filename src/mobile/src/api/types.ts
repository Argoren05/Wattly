// Contract types mirroring the Wattly REST API (/api/v1). Decimal values arrive as JSON numbers.

/** Origin of a reading. */
export type ReadingSource = 'Manual' | 'Ocr' | 'Import' | 'Integration';
/** Lifecycle state of a reading (readings are never physically changed). */
export type ReadingStatus = 'Active' | 'Superseded' | 'Voided';
/** Import (consumption) or export (e.g. photovoltaics) register. */
export type RegisterType = 'Import' | 'Export';
/** Meter technology. */
export type MeterType = 'Conventional' | 'Smart';
/** Whether a meter also measures energy fed into the grid. */
export type MeterDirectionality = 'ImportOnly' | 'Bidirectional';
/** Kind of a price component on the bill. */
export type RateComponentType = 'Energy' | 'VariableDistribution' | 'FixedDistribution' | 'Subscription' | 'Capacity' | 'Other';
/** Unit of a rate. */
export type RateUnit = 'Kwh' | 'Month' | 'Day' | 'Kw';
/** Summary category of costs. */
export type CostCategory = 'Energy' | 'Distribution' | 'Other';
/** Bucket size of statistics. */
export type Granularity = 'Day' | 'Week' | 'Month' | 'Year';
/** How a register value was obtained: reading, interpolation or extrapolation. */
export type ValueKind = 'Actual' | 'Interpolated' | 'Extrapolated';

/** Tokens returned by sign-in and refresh. */
export interface TokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

/** Signed-in user. */
export interface User {
  id: string;
  email: string | null;
  roles: string[];
}

/** One page of a list. */
export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

/** Property (flat, house) with billing settings. */
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

/** Create/update request of a property. */
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

/** Operator or supplier from the catalog. */
export interface CatalogEntry {
  id: string;
  name: string;
  code: string;
  countryCode: string;
  isActive: boolean;
}

/** Time zone of a multi-zone tariff. */
export interface TariffZone {
  code: string;
  name: string;
  scheduleDescription: string | null;
}

/** Tariff group (G11, G12…). */
export interface Tariff {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  zones: TariffZone[];
}

/** Contract of a property: supplier, operator, tariff and validity. */
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

/** Request setting the contract. */
export interface EnergyContractRequest {
  supplierId: string | null;
  operatorId: string | null;
  tariffId: string;
  contractedPowerKw: number | null;
  validFrom: string;
  validTo: string | null;
}

/** Price component of a rate plan (net rate, VAT as fraction). */
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

/** Versioned price list with its source. */
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

/** Component in a create request. */
export interface RateComponentRequest {
  componentType: RateComponentType;
  name: string;
  zoneCode: string | null;
  unit: RateUnit;
  netRate: number;
  taxRate: number;
}

/** Request creating a rate plan. */
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

/** Meter register. */
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

/** Meter with registers. */
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

/** Register in a create request. */
export interface RegisterRequest {
  name: string;
  registerType: RegisterType;
  zoneCode: string | null;
  code?: string | null;
  decimalPlaces?: number | null;
}

/** Create/update request of a meter. */
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

/** Meter reading with consumption since the previous active reading. */
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

/** New reading or correction. */
export interface ReadingRequest {
  readingAt: string;
  value: number;
  source?: ReadingSource;
  note?: string | null;
  confirmAnomaly?: boolean;
}

/** Saved reading with confirmed warnings. */
export interface ReadingSaved {
  reading: Reading;
  warnings: { code: string; message: string }[];
}

/** Calculated component of a cost calculation. */
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

/** Explainable calculation: consumption, components, VAT, flags and assumptions. */
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

/** One bucket of a series. */
export interface SeriesPoint {
  periodStart: string;
  periodEnd: string;
  consumptionKwh: number | null;
  costGross: number | null;
  isEstimate: boolean;
  isPartial: boolean;
}

/** Consumption or cost series. */
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

/** Dashboard figures and forecast for the current billing period. */
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

/** Attachment metadata. */
export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

/** Invoice with comparison against the estimate. */
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

/** Create/update request of an invoice. */
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

/** Native installer status returned by GET /app/release. */
export interface MobileRelease {
  platform: 'android' | 'ios';
  currentVersion: string;
  latestVersion: string | null;
  minimumVersion: string | null;
  downloadUrl: string | null;
  releaseNotes: string | null;
  updateAvailable: boolean;
  updateRequired: boolean;
}
