# Wattly – roadmapa projektu

## Etap 0 – analiza i przygotowanie

- [ ] Potwierdzenie zakresu MVP.
- [ ] Doprecyzowanie modelu taryf i składników kosztów.
- [ ] Wybór modelu logowania.
- [x] Ustalenie układu repozytorium.
- [ ] Przygotowanie środowisk development/test/production.
- [ ] Makiety kluczowych ekranów.
- [x] Przegląd modelu danych.

**Rezultat:** zatwierdzona specyfikacja i szkielet repozytorium.

## Etap 1 – fundament techniczny

- [x] Utworzenie aplikacji mobilnej.
- [x] Utworzenie backendu i warstw.
- [x] Konfiguracja PostgreSQL i EF Core.
- [x] Migracje początkowe.
- [x] Logowanie i autoryzacja.
- [x] Obsługa błędów i logowanie.
- [x] CI i podstawowe testy.

**Rezultat:** działający szkielet aplikacji i API.

## Etap 2 – konfiguracja energii

- [x] Nieruchomości.
- [x] Liczniki i rejestry.
- [x] Operatorzy dystrybucyjni.
- [x] Sprzedawcy energii.
- [x] Taryfy i wersje cenników.
- [x] Formularze konfiguracji.

**Rezultat:** możliwość skonfigurowania profilu energetycznego.

## Etap 3 – odczyty i kalkulacje

- [x] Ręczne odczyty.
- [x] Walidacja wskazań.
- [x] Zużycie pomiędzy odczytami.
- [x] Obsługa stref taryfowych.
- [x] Kalkulator kosztów.
- [x] Testy przypadków granicznych i zaokrągleń.
- [x] Historia kalkulacji.

**Rezultat:** wiarygodne obliczenia na podstawie wprowadzonych danych.

## Etap 4 – dashboard i analityka

- [x] Dashboard.
- [x] Wykresy.
- [x] Agregacje dzienne, miesięczne i roczne.
- [x] Prognoza zużycia i kosztów.
- [x] Oznaczanie danych szacunkowych.
- [x] Porównywanie okresów.

**Rezultat:** użyteczna aplikacja do codziennego monitorowania.

## Etap 5 – faktury i powiadomienia

- [x] Ręczne dodawanie faktur.
- [x] Porównanie faktury z prognozą.
- [x] Limity budżetowe (budżet i jego wykorzystanie na dashboardzie; powiadomienia – do zrobienia).
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

## Etap 7 – dystrybucja i utrzymanie

- [x] Konfiguracja instalatora (EAS Build: APK, AAB, iOS).
- [x] Automatyczne aktualizacje OTA i wykrywanie nowych instalatorów.
- [x] Wymuszona dokumentacja kodu i testy jednostkowe wszystkich warstw.
- [x] Założenie projektu EAS i połączenie z GitHubem.
- [x] Token robota Expo w sekrecie CI `EXPO_TOKEN`.
- [x] Logowanie kontami Google, Microsoft, Facebook i Apple (kod).
- [ ] Rejestracja aplikacji u dostawców logowania i ustawienie identyfikatorów (EAS + API).
- [x] Przygotowanie serwera do wdrożenia na Railway (DEC-026).
- [x] Przygotowanie wdrożenia na Google Cloud Run + Neon (DEC-027).
- [x] Uruchomienie serwera na Cloud Run i ustawienie `EXPO_PUBLIC_API_URL` na expo.dev.
- [x] Poprawki po pierwszych testach (DEC-028): kalendarz i format dat z telefonu, autouzupełnianie haseł, numer PPE ze skanerem, poprawianie i usuwanie umów oraz cenników, dodawanie i usuwanie nieruchomości.
- [x] Wygląd: tryb jasny/ciemny/systemowy i kolor motywu (DEC-029).
- [x] Instrukcja konfiguracji Neon + Google Cloud krok po kroku.
- [x] Przycisk pokazywania hasła na ekranach logowania i rejestracji.
- [x] Podgląd odczytu wpisanego wstecz: porównanie z odczytami przed i po jego dacie.
- [ ] Instalator 1.1.0 (nowe moduły natywne: kalendarz, aparat).
- [ ] Publikacja w Google Play / App Store.

## Definicja ukończenia zadania

Zadanie uznaje się za ukończone, gdy:
- kod jest zgodny z architekturą i konwencjami oraz udokumentowany (XML docs / JSDoc);
- walidacja i obsługa błędów są dodane;
- testy odpowiednie do zmiany przechodzą;
- migracje są przygotowane, jeśli zmienia się baza;
- dokumentacja jest zaktualizowana;
- nie ma znanych regresji w powiązanych funkcjach.

## Priorytet

Najpierw poprawność danych i kalkulacji, następnie wygoda interfejsu, a dopiero potem automatyzacje i integracje.
