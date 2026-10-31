# Wattly – wymagania funkcjonalne i niefunkcjonalne

## 1. Cel

Dostarczenie aplikacji mobilnej, która pomaga monitorować zużycie energii elektrycznej, szacować koszty i przewidywać wysokość rachunków na podstawie odczytów licznika oraz skonfigurowanych warunków umowy i taryfy.

## 2. Role

- **Użytkownik** – zarządza własnymi nieruchomościami, licznikami, odczytami i fakturami.
- **Administrator** – zarządza katalogiem operatorów, sprzedawców, taryf i cenników.
- **Wsparcie/obsługa** – rola opcjonalna, z ograniczonym dostępem i audytem.

Dostęp administratora nie może oznaczać automatycznego dostępu do prywatnych odczytów i faktur użytkowników.

## 3. Zakres MVP

### 3.1 Konto i konfiguracja
- Rejestracja, logowanie, wylogowanie i odzyskiwanie dostępu.
- Utworzenie co najmniej jednej nieruchomości.
- Ustawienie kraju, waluty i strefy czasowej.
- Wybór operatora dystrybucyjnego i sprzedawcy jako odrębnych danych.
- Wybór grupy taryfowej i okresu obowiązywania umowy.
- Wybór rodzaju licznika oraz liczby rejestrów/stref.
- Wprowadzenie początkowego stanu licznika i daty bazowej.

### 3.2 Liczniki i odczyty
- Ręczne dodawanie, edycja i anulowanie odczytu.
- Odczyt może być codzienny, miesięczny lub nieregularny.
- Odczyt zawiera datę i godzinę, rejestr licznika, wartość, jednostkę i źródło.
- Źródła: ręczny, OCR, import, integracja (przyszłość).
- Opcjonalne zdjęcie i notatka.
- Walidacja: brak ujemnych wartości, kontrola kolejności, duplikatów i nietypowych skoków.
- Korekta odczytu musi pozostawić ślad audytowy.
- Liczniki wielostrefowe wymagają oddzielnych wartości dla odpowiednich rejestrów.
- Liczniki dwukierunkowe mogą mieć osobne rejestry poboru i oddawania energii.

### 3.3 Taryfy i cenniki
- Model musi umożliwiać G11, G12, G12w, G13 i przyszłe warianty.
- Godziny i dni przypisania do stref muszą być konfigurowalne zgodnie z właściwą taryfą.
- Cennik zawiera daty obowiązywania i składniki cenowe.
- Należy odróżnić cenę energii od stawek dystrybucyjnych.
- Należy obsłużyć stawki zmienne, stałe, zależne od czasu, mocy lub innych parametrów, jeśli dotyczą danego cennika.
- Cennik może pochodzić z katalogu administracyjnego albo zostać wprowadzony ręcznie przez użytkownika.
- Każda zmiana cennika jest wersjonowana.

### 3.4 Kalkulacja kosztów
- Obliczanie różnicy wskazań licznika.
- Przypisanie zużycia do stref, jeżeli dostępne są odpowiednie odczyty.
- Kalkulacja składników kosztu na podstawie właściwego cennika i daty.
- Uwzględnienie okresu rozliczeniowego, opłat stałych, podatków i VAT zgodnie z konfiguracją.
- Pokazywanie rozbicia kosztów oraz założeń kalkulacji.
- Przechowywanie wersji kalkulacji i użytych stawek.
- Obsługa korekt i ponownego przeliczenia z zachowaniem historii.

### 3.5 Dashboard i analityka
- Aktualne zużycie w wybranym okresie.
- Koszt naliczony do daty ostatniego odczytu.
- Prognoza zużycia i kosztu do końca okresu.
- Średnie dzienne zużycie i koszt.
- Wykresy dzienne, tygodniowe, miesięczne i roczne.
- Porównanie okresów.
- Informacja o dacie ostatniego odczytu i kompletności danych.
- Wyraźne oznaczenie wartości szacunkowych.

### 3.6 Faktury
- Ręczne dodanie faktury i jej okresu.
- Wprowadzenie kwoty brutto, zużycia i opcjonalnego rozbicia.
- Załącznik PDF lub zdjęcie.
- Porównanie faktury z prognozą.
- OCR faktur – poza MVP, chyba że zostanie wybrany jako priorytet.

### 3.7 Powiadomienia
- Przypomnienie o odczycie.
- Przekroczenie skonfigurowanego budżetu.
- Nietypowe zużycie.
- Zbliżający się koniec okresu rozliczeniowego.
- Użytkownik może wyłączyć i konfigurować powiadomienia.

## 4. Funkcje po MVP

- OCR odczytów licznika i faktur.
- Porównywarka taryf na podstawie profilu zużycia.
- Wiele nieruchomości i liczników.
- Fotowoltaika i bilans poboru/oddawania.
- Szacowanie zużycia urządzeń.
- Import danych i integracje z licznikami, jeśli istnieją wspierane interfejsy.
- Eksport PDF/CSV.
- Obsługa innych mediów, np. gazu i wody.

## 5. Wymagania niefunkcjonalne

- Bezpieczeństwo: autoryzacja, autentykacja, kontrola dostępu i szyfrowanie transmisji.
- Prywatność: minimalizacja danych i jasne zasady przechowywania załączników.
- Niezawodność: kopie zapasowe i obsługa błędów.
- Wydajność: paginacja historii i indeksy bazy danych.
- Dostępność: czytelny interfejs, skalowanie tekstu i odpowiedni kontrast.
- Offline: możliwość lokalnego zapisania odczytu i późniejszej synchronizacji – zakres do decyzji dla MVP.
- Testowalność: testy jednostkowe kalkulatora oraz testy integracyjne API.
- Lokalizacja: polski jako język startowy; waluta i strefa czasowa konfigurowalne.

## 6. Kryteria akceptacji MVP

1. Użytkownik może skonfigurować nieruchomość, licznik, sprzedawcę, operatora i taryfę.
2. Użytkownik może dodać dwa lub więcej odczytów.
3. System prawidłowo oblicza różnicę wskazań i sygnalizuje nieprawidłowe dane.
4. Kalkulacja uwzględnia właściwy cennik obowiązujący w danym czasie.
5. System pokazuje rozbicie kosztów i jawne założenia.
6. Dashboard prezentuje zużycie, koszt i prognozę.
7. Przy rzadkich odczytach system oznacza rozkład dzienny jako estymację.
8. Użytkownik może dodać fakturę i porównać jej kwotę z prognozą.
9. Użytkownik nie ma dostępu do danych innego użytkownika.
10. Kluczowe obliczenia są pokryte testami.

## 7. Ograniczenia i zastrzeżenia

Wattly jest narzędziem informacyjnym i szacunkowym. Nie zastępuje oficjalnego rozliczenia sprzedawcy. Dokładność zależy od kompletności odczytów, poprawności cennika, parametrów umowy i sposobu rozliczania. Cenniki i reguły taryfowe muszą być weryfikowane na podstawie aktualnych, wiarygodnych dokumentów.
