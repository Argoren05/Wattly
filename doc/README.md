# Wattly

**Monitoruj zużycie. Kontroluj koszty. Przewiduj rachunki.**

Wattly to aplikacja mobilna do monitorowania zużycia energii elektrycznej, analizowania kosztów oraz prognozowania rachunków. Użytkownik może wprowadzać odczyty licznika ręcznie lub ze zdjęcia, konfigurować sprzedawcę, operatora dystrybucyjnego i taryfę, a następnie przeglądać zużycie, koszty, statystyki i prognozy.

> Status: zaimplementowany szkielet MVP (backend + aplikacja mobilna). Elementy wymagające potwierdzenia są oznaczone jako **Do decyzji**.

## Główne możliwości

- Ręczne odczyty licznika: codzienne, miesięczne lub nieregularne.
- Przygotowanie pod odczyt ze zdjęcia (OCR).
- Obsługa taryf jedno- i wielostrefowych.
- Rozdzielenie sprzedawcy energii od operatora dystrybucyjnego.
- Kalkulacja energii, dystrybucji, opłat stałych i podatków.
- Prognozowanie kosztów i porównywanie ich z fakturami.
- Wykresy dzienne, tygodniowe, miesięczne i roczne.
- Historia odczytów, faktur i zmian cenników.
- Obsługa wielu nieruchomości i liczników w przyszłych etapach.

## Proponowany stos technologiczny

| Obszar | Technologia |
|---|---|
| Aplikacja mobilna | React Native, Expo, TypeScript |
| Backend | ASP.NET Core Web API, .NET 10 |
| Baza danych | PostgreSQL |
| Dostęp do danych | Entity Framework Core |
| API | REST/JSON |
| Uwierzytelnianie | ASP.NET Core Identity lub równoważne rozwiązanie |
| OCR | Do wyboru po prototypie |
| Pliki | Prywatny storage obiektowy lub lokalny dostawca zgodny z interfejsem storage |

Wersje bibliotek i pakietów należy ustalać podczas tworzenia repozytorium i zapisywać w plikach projektu. Nie należy zakładać dostępności API operatorów energetycznych.

## Dokumentacja

- [Wymagania funkcjonalne](Wattly_Requirements.md)
- [Architektura](Wattly_Architecture.md)
- [Model danych](Wattly_Database.md)
- [Kontrakt API](Wattly_API.md)
- [UI/UX](Wattly_UI_UX.md)
- [Roadmapa](Wattly_Roadmap.md)
- [Rejestr decyzji](Wattly_Decisions.md)
- [Instrukcje dla asystenta AI](AI_WORKING_GUIDELINES.md)
- [Uruchomienie i development](Wattly_Development.md)
- [Wdrożenie serwera na Google Cloud Run + Neon](Wattly_Deployment_CloudRun.md)
- [Konfiguracja Neon + Google Cloud krok po kroku](Wattly_Konfiguracja_Neon_GoogleCloud.md)
- [Wdrożenie na Railway (alternatywa, nieaktualne)](Wattly_Deployment_Railway.md)

## Najważniejsze zasady produktu

1. Prognoza nie może być przedstawiana jako oficjalna faktura.
2. Należy rozróżniać dane rzeczywiste, szacunkowe i zaimportowane.
3. Każdy cennik musi mieć datę obowiązywania.
4. Zmiana cennika nie może zmieniać historycznych rozliczeń.
5. Przy rzadkich odczytach aplikacja nie może udawać, że zna zużycie każdego dnia.
6. Kwoty należy obliczać na podstawie jawnych składników rachunku, a nie jednej uniwersalnej ceny za kWh.
7. Dane użytkowników i załączniki muszą być odseparowane i chronione.

## Struktura repozytorium

```
Wattly/
├── doc/                      # cała dokumentacja (.md)
├── src/
│   ├── backend/              # ASP.NET Core (.NET 10) – modularny monolit
│   │   ├── Wattly.Domain/          # encje, reguły domenowe, silnik kalkulacji
│   │   ├── Wattly.Application/     # przypadki użycia, DTO, walidacja
│   │   ├── Wattly.Infrastructure/  # EF Core + PostgreSQL, Identity, storage
│   │   ├── Wattly.Api/             # Minimal API, auth, ProblemDetails
│   │   └── tests/                  # testy jednostkowe i integracyjne
│   ├── mobile/               # React Native + Expo + TypeScript (Expo Router)
│   ├── docker-compose.yml    # PostgreSQL + API lokalnie
│   └── .env.example
└── .github/workflows/ci.yml  # CI (GitHub wymaga tej lokalizacji)
```

## Status projektu

Aplikację mobilną instaluje się z pliku APK (EAS Build) lub ze sklepów; aktualizuje się automatycznie (szczegóły w [instrukcji](Wattly_Development.md)). Zaimplementowane MVP: konto i logowanie, konfiguracja nieruchomości, umowy (operator/sprzedawca/taryfa), własne cenniki z okresami obowiązywania, liczniki wielostrefowe, odczyty z walidacją i historią korekt, kalkulacja kosztów z rozbiciem i założeniami, dashboard z prognozą, statystyki, faktury z porównaniem i załącznikami. Poza zakresem (kolejne etapy): powiadomienia, OCR, eksport, porównywarka taryf, fotowoltaika w kalkulacji, tryb offline. Szczegóły w [roadmapie](Wattly_Roadmap.md).

## Jak pracować z dokumentacją

Dokumenty opisują zamierzone zachowanie produktu, a nie potwierdzają, że dana funkcja jest już zaimplementowana. Przed wdrożeniem należy:
- zweryfikować aktualne przepisy i cenniki;
- potwierdzić model taryf i sposób rozliczeń;
- doprecyzować decyzje oznaczone jako „Do decyzji”;
- aktualizować rejestr decyzji po każdej istotnej zmianie.
