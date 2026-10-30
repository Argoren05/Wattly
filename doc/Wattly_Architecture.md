# Wattly – architektura techniczna

## 1. Założenia

Architektura klient-serwer:
- aplikacja mobilna React Native/Expo;
- backend ASP.NET Core Web API;
- PostgreSQL;
- prywatne przechowywanie załączników;
- opcjonalne usługi OCR i powiadomień.

Należy unikać przedwczesnego dzielenia systemu na mikroserwisy. Na start zalecany jest modularny monolit backendowy.

## 2. Proponowany podział backendu

Przykładowe moduły:
- Identity – konta i sesje.
- Households – gospodarstwa i nieruchomości.
- Metering – liczniki i odczyty.
- Tariffs – operatorzy, sprzedawcy, taryfy i cenniki.
- Billing – kalkulacje kosztów i okresy rozliczeniowe.
- Analytics – agregacje i prognozy.
- Invoices – faktury i załączniki.
- Notifications – preferencje i wysyłka powiadomień.
- Administration – zarządzanie katalogami i audyt.

## 3. Struktura repozytorium (zaimplementowana)

Wattly/
- doc/ – dokumentacja
- src/
  - backend/
    - Wattly.Domain/
    - Wattly.Application/
    - Wattly.Infrastructure/
    - Wattly.Api/
    - tests/Wattly.UnitTests/, tests/Wattly.IntegrationTests/
    - Dockerfile, Wattly.slnx, dotnet-tools.json (dotnet-ef)
  - mobile/ – Expo Router, kod w `src/` (app, api, components, hooks, state, theme, utils)
  - docker-compose.yml, .env.example
- .github/workflows/ci.yml

Testy i infrastruktura lokalna zostały umieszczone w `src/`, zgodnie z decyzją DEC-018 (cała zawartość projektu w `src`, dokumentacja w `doc`). Wyjątkiem jest `.github/`, którego położenia wymaga GitHub.

### Moduły backendu w kodzie

Moduły są wydzielone przestrzeniami nazw w warstwach (`Properties`, `Catalog`, `Metering`, `Calculations`, `Analytics`, `Invoices`). Identity jest realizowane przez ASP.NET Core Identity. Moduły Notifications i Administration (poza katalogiem) nie są jeszcze zaimplementowane.

### Silnik kalkulacji

- `RegisterSeries` (Domain) – szereg odczytów jednego rejestru; wartość w dowolnej chwili: odczyt (Actual), interpolacja liniowa (Interpolated) lub ekstrapolacja średnią z ostatnich 90 dni (Extrapolated).
- `CostEngine` (Application) – dzieli okres na segmenty o stałej umowie i cenniku, szacuje zużycie per strefa, zbiera założenia.
- `CostCalculator` (Domain) – czysta funkcja: składniki × ilości, proporcjonalne opłaty miesięczne, VAT i zaokrąglenia (DEC-013).
- Prognoza = kalkulacja okresu rozliczeniowego, którego koniec leży w przyszłości (ekstrapolacja), zawsze oznaczona jako szacunkowa.

## 4. Warstwy backendu

- **Domain** – encje, obiekty wartości, reguły domenowe i interfejsy.
- **Application** – przypadki użycia, walidacja, DTO, orkiestracja.
- **Infrastructure** – EF Core, PostgreSQL, storage, OCR i integracje.
- **Api** – endpointy, uwierzytelnianie, autoryzacja, middleware i dokumentacja OpenAPI.

Logika kalkulacji nie powinna być zaszyta w kontrolerach ani komponentach UI.

## 5. Aplikacja mobilna

Moduły:
- Auth
- Onboarding
- Dashboard
- Properties
- Meters
- Readings
- Tariffs
- Costs
- Analytics
- Invoices
- Settings

Wymagane elementy:
- obsługa stanów ładowania, pustych danych i błędów;
- walidacja formularzy;
- bezpieczne przechowywanie tokenów;
- wersjonowanie kontraktów API;
- mechanizm synchronizacji, jeśli zostanie wdrożony tryb offline.

## 6. Przepływ dodawania odczytu

1. Użytkownik wybiera licznik i rejestr.
2. Wprowadza wartość oraz datę/godzinę lub robi zdjęcie.
3. OCR (jeżeli używany) zwraca propozycję wartości i poziom pewności.
4. Użytkownik zatwierdza wartość.
5. API waliduje odczyt i zapisuje źródło danych.
6. Moduł kalkulacji wyznacza zużycie w przedziale między odczytami.
7. Analityka aktualizuje agregaty i prognozę.
8. Aplikacja odświeża dashboard.

## 7. Bezpieczeństwo

- HTTPS w każdym środowisku poza lokalnym developmentem.
- Autoryzacja zasobów na poziomie użytkownika/gospodarstwa.
- Sekrety poza repozytorium.
- Ograniczenie rozmiaru i typów plików.
- Skanowanie załączników, jeśli dostępne w środowisku.
- Ograniczenia prób logowania i ochrona endpointów.
- Logi bez haseł, tokenów i zbędnych danych osobowych.
- Audyt zmian cenników, odczytów i faktur.
- Polityka retencji i usuwania danych.

## 8. Obserwowalność i utrzymanie

- Logi strukturalne.
- Identyfikator korelacji żądania.
- Health checks API i bazy.
- Metryki błędów i czasu odpowiedzi.
- Kopie zapasowe PostgreSQL i testy odtwarzania.
- Migracje uruchamiane kontrolowanie w procesie wdrożenia.

## 9. Środowiska

- Development – lokalna baza i testowe dane.
- Test/Staging – środowisko przedprodukcyjne.
- Production – dane rzeczywistych użytkowników.

Konfiguracje i sekrety muszą być odrębne dla każdego środowiska.
