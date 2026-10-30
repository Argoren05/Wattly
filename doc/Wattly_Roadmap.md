# Wattly – roadmapa projektu

## Etap 0 – analiza i przygotowanie

- [ ] Potwierdzenie zakresu MVP.
- [ ] Doprecyzowanie modelu taryf i składników kosztów.
- [ ] Wybór modelu logowania.
- [ ] Ustalenie układu repozytorium.
- [ ] Przygotowanie środowisk development/test/production.
- [ ] Makiety kluczowych ekranów.
- [ ] Przegląd modelu danych.

**Rezultat:** zatwierdzona specyfikacja i szkielet repozytorium.

## Etap 1 – fundament techniczny

- [ ] Utworzenie aplikacji mobilnej.
- [ ] Utworzenie backendu i warstw.
- [ ] Konfiguracja PostgreSQL i EF Core.
- [ ] Migracje początkowe.
- [ ] Logowanie i autoryzacja.
- [ ] Obsługa błędów i logowanie.
- [ ] CI i podstawowe testy.

**Rezultat:** działający szkielet aplikacji i API.

## Etap 2 – konfiguracja energii

- [ ] Nieruchomości.
- [ ] Liczniki i rejestry.
- [ ] Operatorzy dystrybucyjni.
- [ ] Sprzedawcy energii.
- [ ] Taryfy i wersje cenników.
- [ ] Formularze konfiguracji.

**Rezultat:** możliwość skonfigurowania profilu energetycznego.

## Etap 3 – odczyty i kalkulacje

- [ ] Ręczne odczyty.
- [ ] Walidacja wskazań.
- [ ] Zużycie pomiędzy odczytami.
- [ ] Obsługa stref taryfowych.
- [ ] Kalkulator kosztów.
- [ ] Testy przypadków granicznych i zaokrągleń.
- [ ] Historia kalkulacji.

**Rezultat:** wiarygodne obliczenia na podstawie wprowadzonych danych.

## Etap 4 – dashboard i analityka

- [ ] Dashboard.
- [ ] Wykresy.
- [ ] Agregacje dzienne, miesięczne i roczne.
- [ ] Prognoza zużycia i kosztów.
- [ ] Oznaczanie danych szacunkowych.
- [ ] Porównywanie okresów.

**Rezultat:** użyteczna aplikacja do codziennego monitorowania.

## Etap 5 – faktury i powiadomienia

- [ ] Ręczne dodawanie faktur.
- [ ] Porównanie faktury z prognozą.
- [ ] Limity budżetowe.
- [ ] Przypomnienia o odczytach.
- [ ] Powiadomienia o anomaliach.

**Rezultat:** kompletne MVP.

## Etap 6 – funkcje rozszerzone

- [ ] OCR licznika.
- [ ] OCR faktur.
- [ ] Eksport PDF/CSV.
- [ ] Porównywarka taryf.
- [ ] Wiele nieruchomości i współdzielenie.
- [ ] Fotowoltaika.
- [ ] Integracje z urządzeniami/licznikami, jeśli dostępne.

## Definicja ukończenia zadania

Zadanie uznaje się za ukończone, gdy:
- kod jest zgodny z architekturą i konwencjami;
- walidacja i obsługa błędów są dodane;
- testy odpowiednie do zmiany przechodzą;
- migracje są przygotowane, jeśli zmienia się baza;
- dokumentacja jest zaktualizowana;
- nie ma znanych regresji w powiązanych funkcjach.

## Priorytet

Najpierw poprawność danych i kalkulacji, następnie wygoda interfejsu, a dopiero potem automatyzacje i integracje.
