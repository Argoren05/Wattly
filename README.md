# Wattly

**Monitoruj zużycie. Kontroluj koszty. Przewiduj rachunki.**

Wattly to aplikacja mobilna do monitorowania zużycia energii elektrycznej, analizowania kosztów oraz prognozowania rachunków. Użytkownik może wprowadzać odczyty licznika ręcznie lub ze zdjęcia, konfigurować sprzedawcę, operatora dystrybucyjnego i taryfę, a następnie przeglądać zużycie, koszty, statystyki i prognozy.

> Status: dokumentacja projektowa – punkt wyjścia do implementacji. Elementy wymagające potwierdzenia są oznaczone jako **Do decyzji**.

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

- [Wymagania funkcjonalne](docs/Wattly_Requirements.md)
- [Architektura](docs/Wattly_Architecture.md)
- [Model danych](docs/Wattly_Database.md)
- [Kontrakt API](docs/Wattly_API.md)
- [UI/UX](docs/Wattly_UI_UX.md)
- [Roadmapa](docs/Wattly_Roadmap.md)
- [Rejestr decyzji](docs/Wattly_Decisions.md)
- [Instrukcje dla asystenta AI](docs/AI_WORKING_GUIDELINES.md)

## Najważniejsze zasady produktu

1. Prognoza nie może być przedstawiana jako oficjalna faktura.
2. Należy rozróżniać dane rzeczywiste, szacunkowe i zaimportowane.
3. Każdy cennik musi mieć datę obowiązywania.
4. Zmiana cennika nie może zmieniać historycznych rozliczeń.
5. Przy rzadkich odczytach aplikacja nie może udawać, że zna zużycie każdego dnia.
6. Kwoty należy obliczać na podstawie jawnych składników rachunku, a nie jednej uniwersalnej ceny za kWh.
7. Dane użytkowników i załączniki muszą być odseparowane i chronione.

## Status projektu

Projekt rozpoczyna się od MVP: konfiguracji profilu energetycznego, ręcznych odczytów, taryf, kalkulacji, dashboardu, wykresów i prognozy. OCR, automatyczne pobieranie taryf, fotowoltaika i integracje z licznikami są planowane na kolejne etapy.

## Jak pracować z dokumentacją

Dokumenty opisują zamierzone zachowanie produktu, a nie potwierdzają, że dana funkcja jest już zaimplementowana. Przed wdrożeniem należy:
- zweryfikować aktualne przepisy i cenniki;
- potwierdzić model taryf i sposób rozliczeń;
- doprecyzować decyzje oznaczone jako „Do decyzji”;
- aktualizować rejestr decyzji po każdej istotnej zmianie.
