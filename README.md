# Wattly

**Monitoruj zużycie. Kontroluj koszty. Przewiduj rachunki.**

Wattly to aplikacja mobilna (Android, iOS) do monitorowania zużycia energii elektrycznej, analizy kosztów i prognozowania rachunków. Pozwala:
- zapisywać odczyty licznika,
- skonfigurować operatora dystrybucyjnego, sprzedawcę i taryfę (G11, G12, G12w, G13),
- przeliczać koszty na podstawie stawek z faktury,
- przeglądać wykresy, statystyki i prognozę rachunku,
- porównywać prognozę z rzeczywistymi fakturami,
- logować się e-mailem i hasłem albo kontem Google, Microsoft, Facebook lub Apple.

> Wattly jest narzędziem informacyjnym i szacunkowym – prognoza nie jest fakturą sprzedawcy.

## Zasady produktu

1. Prognoza nie może być przedstawiana jako oficjalna faktura.
2. Dane rzeczywiste, szacunkowe i zaimportowane są wyraźnie rozróżnione.
3. Każdy cennik ma datę obowiązywania i udokumentowane źródło.
4. Zmiana cennika nie zmienia zapisanych rozliczeń (kalkulacje przechowują kopię stawek).
5. Przy rzadkich odczytach aplikacja nie udaje, że zna zużycie każdego dnia – oznacza estymację.
6. Kwoty liczone są z jawnych składników rachunku, a nie z jednej ceny za kWh.
7. Dane użytkowników i załączniki są odseparowane i chronione.

## Stan projektu

Działa: konto (e-mail i hasło, opcjonalnie Google / Microsoft / Facebook / Apple), wiele nieruchomości z numerem PPE, umowy (operator, sprzedawca, taryfa) z historią, własne cenniki z okresami obowiązywania, liczniki wielostrefowe, odczyty z walidacją i historią korekt, kalkulacja kosztów z rozbiciem i założeniami, prognoza, statystyki, faktury z porównaniem i załącznikami, motyw jasny/ciemny z kolorami.

Kolejne etapy: powiadomienia, odczyt ze zdjęcia (OCR), eksport, import odczytów, porównywarka taryf, fotowoltaika w kalkulacji, tryb offline – szczegóły w [roadmapie](doc/Wattly_Roadmap.md).

## Instalacja na telefonie

Instalator dla Androida (plik APK) budowany jest w chmurze Expo:
1. **Actions → Mobile build → Run workflow** (profil `preview`, platforma `android`).
2. Po zakończeniu buildu link i kod QR do pobrania pojawią się na [expo.dev](https://expo.dev) w projekcie Wattly → **Builds**.
3. Otwórz link na telefonie i zainstaluj aplikację.

Aplikacja **aktualizuje się automatycznie**: zmiany w kodzie trafiają do telefonów jako aktualizacje w tle (przycisk „Uruchom ponownie”), a o nowej wersji instalatora aplikacja informuje sama.

## Technologie

| Obszar | Technologia |
|---|---|
| Aplikacja mobilna | React Native, Expo SDK 58, TypeScript, Expo Router, TanStack Query |
| Backend | ASP.NET Core Web API (.NET 10), modularny monolit |
| Baza danych | PostgreSQL 16, Entity Framework Core |
| Uwierzytelnianie | ASP.NET Core Identity (tokeny bearer), logowanie Google / Microsoft / Facebook / Apple |
| Budowanie i aktualizacje | EAS Build, EAS Update (expo-updates) |
| Testy | xUnit (backend), Jest + Testing Library (mobile) |
| CI | GitHub Actions |

## Struktura repozytorium

```
Wattly/
├── doc/                      # dokumentacja projektu
├── src/
│   ├── backend/              # ASP.NET Core (.NET 10) – modularny monolit
│   │   ├── Wattly.Domain/          # encje, reguły domenowe, silnik kalkulacji
│   │   ├── Wattly.Application/     # przypadki użycia, DTO, walidacja
│   │   ├── Wattly.Infrastructure/  # EF Core + PostgreSQL, Identity, storage
│   │   ├── Wattly.Api/             # Minimal API, uwierzytelnianie, ProblemDetails
│   │   ├── tests/                  # testy jednostkowe i integracyjne
│   │   ├── Dockerfile, cloudbuild.yaml  # obraz i wdrożenie na Cloud Run
│   ├── mobile/               # React Native + Expo + TypeScript (Expo Router)
│   ├── docker-compose.yml    # PostgreSQL + API lokalnie
│   └── .env.example
└── .github/workflows/        # CI, build instalatora, aktualizacje OTA
```

## Szybki start (development)

```bash
# Backend: baza danych + API (http://localhost:5103)
cp src/.env.example src/.env          # ustaw POSTGRES_PASSWORD
docker compose -f src/docker-compose.yml up --build

# Aplikacja mobilna
cd src/mobile
npm install
npx expo start
```

Testy:

```bash
cd src/backend && dotnet test                                     # backend (testy integracyjne wymagają PostgreSQL)
cd src/mobile && npm run typecheck && npm run lint && npm test    # mobile
```

Szczegóły – konfiguracja, migracje, sekrety CI, wydawanie wersji – są w [instrukcji dla deweloperów](doc/Wattly_Development.md). Serwer produkcyjny działa na Google Cloud Run z bazą Neon – [jak to działa](doc/Wattly_Deployment_CloudRun.md) i [konfiguracja krok po kroku](doc/Wattly_Konfiguracja_Neon_GoogleCloud.md).

## Dokumentacja

Pełny spis z opisem każdego dokumentu: **[doc/README.md](doc/README.md)**. Najczęściej potrzebne:

- [Uruchomienie i development](doc/Wattly_Development.md)
- [Konfiguracja serwera: Neon + Google Cloud krok po kroku](doc/Wattly_Konfiguracja_Neon_GoogleCloud.md)
- [Kontrakt API](doc/Wattly_API.md)
- [Rejestr decyzji](doc/Wattly_Decisions.md)
- [Roadmapa](doc/Wattly_Roadmap.md)

Dokumenty wymagań, architektury i UI/UX opisują zamierzone zachowanie produktu; co jest już zrobione, pokazuje roadmapa. Każda zmiana w kodzie jest opisywana w odpowiednim pliku w `doc/` ([zasady pracy](doc/AI_WORKING_GUIDELINES.md)).
