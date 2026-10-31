# Wattly – model danych PostgreSQL

## 1. Zasady modelowania

- Klucze główne: UUID.
- Daty zdarzeń przechowywać jako `timestamptz`, jeśli opisują konkretny moment.
- Okresy obowiązywania cenników modelować jawnie (`ValidFrom`, `ValidTo`).
- Kwoty przechowywać jako `numeric`, nie `float`/`double`.
- Wskazania i zużycie przechowywać z precyzją odpowiednią dla licznika.
- Wszystkie zasoby użytkownika muszą mieć sprawdzane uprawnienia.
- Nie przechowywać wyłącznie gotowych agregatów bez zachowania źródłowych odczytów.

## 2. Proponowane encje

### User
Konto użytkownika. Tożsamość i dane uwierzytelniające najlepiej oprzeć na ASP.NET Core Identity.

### Household
- Id
- OwnerUserId
- Name
- CreatedAt
- UpdatedAt

### Property
- Id
- HouseholdId
- Name
- Address fields (opcjonalnie)
- TimeZoneId
- CurrencyCode
- CreatedAt

### EnergyOperator
Operator dystrybucyjny, np. katalog OSD.

- Id
- Name
- Code
- CountryCode
- IsActive

### EnergySupplier
Sprzedawca energii.

- Id
- Name
- Code
- CountryCode
- IsActive

### Meter
- Id
- PropertyId
- Identifier (opcjonalnie)
- MeterType
- Directionality
- Unit
- InstalledAt
- RemovedAt
- IsActive

### MeterRegister
Rejestr licznika, np. pobór w określonej strefie lub oddawanie energii.
- Id
- MeterId
- RegisterCode (np. kod OBIS, jeśli znany)
- Name
- RegisterType
- TariffZone
- Unit
- DecimalPlaces

### MeterReading
- Id
- MeterRegisterId
- ReadingAt
- Value
- Source (Manual/Ocr/Import/Integration)
- Confidence (opcjonalnie)
- ImageAttachmentId (opcjonalnie)
- Note
- CreatedByUserId
- CreatedAt
- SupersedesReadingId (opcjonalnie)

### Tariff
- Id
- SupplierId (opcjonalnie, zależnie od modelu)
- Code
- Name
- TariffType
- Description

### TariffRatePlan
Wersja cennika:
- Id
- TariffId
- OperatorId (opcjonalnie)
- Name
- ValidFrom
- ValidTo
- CurrencyCode
- TaxMode
- SourceReference
- PublishedAt
- CreatedAt

### TariffRateComponent
Składnik stawki:
- Id
- TariffRatePlanId
- ComponentType (energy, variable_distribution, fixed_distribution, subscription, capacity, other)
- ZoneCode (opcjonalnie)
- Unit (kWh, month, day, kW, other)
- NetRate
- TaxRate
- CalculationMethod
- ConditionsJson

### BillingPeriod
- Id
- PropertyId
- StartAt
- EndAt
- BillingCycleType
- Status

### CostCalculation
- Id
- BillingPeriodId
- CalculatedAt
- CalculationVersion
- ConsumptionKwh
- EnergyCostNet
- DistributionCostNet
- OtherCostNet
- TaxAmount
- TotalGross
- IsEstimate
- AssumptionsJson
- TariffRatePlanId

### Invoice
- Id
- PropertyId
- SupplierId
- InvoiceNumber
- IssueDate
- PeriodStart
- PeriodEnd
- ConsumptionKwh
- TotalGross
- CurrencyCode
- AttachmentId
- Notes

### Attachment
- Id
- OwnerUserId
- StorageKey
- FileName
- ContentType
- SizeBytes
- CreatedAt

### NotificationPreference
- Id
- UserId
- NotificationType
- IsEnabled
- ConfigurationJson

### AuditEvent
- Id
- ActorUserId
- EntityType
- EntityId
- Action
- OccurredAt
- ChangesJson

## 2a. Stan implementacji (migracja `InitialCreate`)

Model został zaimplementowany w EF Core z następującymi uzupełnieniami i odstępstwami od propozycji:

- **EnergyContract** (nowa encja) – umowa nieruchomości: `SupplierId`, `OperatorId`, `TariffId`, `ContractedPowerKw`, `ValidFrom`, `ValidTo` (włącznie). Unikalny indeks (`PropertyId`, `ValidFrom`).
- **Property** – dodatkowo `BillingPeriodMonths`, `BillingAnchorDate`, `MonthlyBudget`; okresy rozliczeniowe są wyliczane z tych pól (encja `BillingPeriod` nie została utworzona).
- **Tariff** – strefy przechowywane jako JSON (`Zones`: kod, nazwa, opis harmonogramu); seed: G11, G12, G12W, G13 bez stawek.
- **TariffRatePlan** – `SupplierId`, `OperatorId`, `PropertyId` (cennik własny użytkownika), `ValidTo` włącznie. Pola `TaxMode`, `CalculationMethod`, `ConditionsJson` pominięto – stawki są netto, a warunki niestandardowe nie są jeszcze obsługiwane.
- **TariffRateComponent** – `Name`, `ComponentType` (Energy, VariableDistribution, FixedDistribution, Subscription, Capacity, Other), `Unit` (Kwh, Month, Day, Kw), `NetRate numeric(18,6)`, `TaxRate numeric(5,4)` jako ułamek.
- **MeterReading** – `Status` (Active, Superseded, Voided), `SupersedesReadingId`, `VoidReason`, `StatusChangedAt`. Częściowy unikalny indeks: jeden aktywny odczyt na rejestr i chwilę.
- **CostCalculation** – powiązana z `PropertyId` i okresem (`PeriodStart`, `PeriodEnd`), `TotalNet`, `IsComplete`, `Assumptions text[]`; **CostCalculationLine** przechowuje migawkę użytych stawek.
- **Invoice** – dodatkowo `TotalNet`, `CreatedAt`, `UpdatedAt`.
- **AuditEvent** – zapisywany automatycznie dla umów, cenników, odczytów i faktur (`ChangesJson jsonb`).
- **NotificationPreference** – jeszcze niezaimplementowana.
- Enumy zapisywane jako tekst; wszystkie znaczniki czasu jako `timestamptz` (UTC).
- Usunięcie użytkownika kaskadowo usuwa gospodarstwa, nieruchomości i powiązane dane.
- Logowania przez Google, Microsoft, Apple i Facebook są zapisywane w tabeli Identity `AspNetUserLogins` (dostawca + identyfikator użytkownika u dostawcy); konto może mieć wiele powiązanych logowań i nie musi mieć hasła.

## 3. Relacje w skrócie

- User 1..N Household
- Household 1..N Property
- Property 1..N Meter
- Meter 1..N MeterRegister
- MeterRegister 1..N MeterReading
- Tariff 1..N TariffRatePlan
- TariffRatePlan 1..N TariffRateComponent
- Property 1..N EnergyContract
- Property 1..N CostCalculation
- CostCalculation 1..N CostCalculationLine
- Property 1..N Invoice

## 4. Ważne ograniczenia

- Odczyt musi wskazywać istniejący rejestr.
- Wartość odczytu nie może być ujemna.
- Dla tego samego rejestru nie należy dopuszczać nieuzasadnionych duplikatów czasu.
- `ValidTo` musi być późniejsze niż `ValidFrom`.
- Cenniki tego samego zakresu nie powinny mieć nakładających się okresów obowiązywania, chyba że jawnie dopuszcza to model.
- Kwoty muszą używać typu dziesiętnego.
- Usuwanie danych finansowych i odczytów powinno być kontrolowane i audytowane.

## 5. Istotne kwestie do doprecyzowania

1. Czy użytkownik może współdzielić nieruchomość z innymi kontami?
2. Czy jedna nieruchomość może mieć wielu sprzedawców lub umowy w kolejnych okresach?
3. Jak dokładnie modelować opłaty zależne od mocy i liczby dni?
4. Czy dane fotowoltaiczne wchodzą do MVP?
5. Jakie dokładnie kody rejestrów i warianty liczników będą obsługiwane w pierwszej wersji?

Model jest propozycją logiczną; przed migracjami należy przeprowadzić przegląd domenowy i ustalić szczegóły taryf.
