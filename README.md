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
│   ├── backend/              # API (.NET 10) + testy
│   ├── mobile/               # aplikacja mobilna (Expo)
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

Szczegóły – konfiguracja, migracje, sekrety CI, wydawanie wersji – są w [instrukcji dla deweloperów](doc/Wattly_Development.md). Serwer produkcyjny działa na Google Cloud Run z bazą Neon – [instrukcja wdrożenia](doc/Wattly_Deployment_CloudRun.md).

## Dokumentacja

- [Opis projektu i zasady produktu](doc/README.md)
- [Wymagania](doc/Wattly_Requirements.md)
- [Architektura](doc/Wattly_Architecture.md)
- [Model danych](doc/Wattly_Database.md)
- [Kontrakt API](doc/Wattly_API.md)
- [UI/UX](doc/Wattly_UI_UX.md)
- [Roadmapa](doc/Wattly_Roadmap.md)
- [Rejestr decyzji](doc/Wattly_Decisions.md)
- [Uruchomienie i development](doc/Wattly_Development.md)
- [Wdrożenie serwera na Google Cloud Run + Neon](doc/Wattly_Deployment_CloudRun.md)
- [Wdrożenie na Railway (alternatywa, nieaktualne)](doc/Wattly_Deployment_Railway.md)
