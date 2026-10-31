# Wattly – wytyczne UI/UX

## 1. Charakter produktu

Wattly ma być nowoczesną, spokojną i czytelną aplikacją użytkową. Najważniejsza informacja – zużycie i szacowany koszt – powinna być widoczna bez przeszukiwania menu.

## 2. Zasady projektowe

- Mobile-first.
- Prosta nawigacja i krótkie formularze.
- Czytelne wartości liczbowe i jednostki.
- Spójne formatowanie dat, kWh i walut.
- Dostępność: kontrast, skalowanie tekstu, opisy ikon.
- Jasny i ciemny motyw: tryb „Jak w telefonie” (domyślny), „Jasny” albo „Ciemny” oraz kolor motywu (zielony, niebieski, fioletowy, pomarańczowy) – Ustawienia → Wygląd (DEC-029). Każdy kolor ma kontrast WCAG AA (tekst przycisku ≥ 4,5:1, elementy interfejsu ≥ 3:1) sprawdzany testem.
- Daty wybierane z kalendarza systemowego i wyświetlane w formacie z ustawień telefonu (DEC-028).
- Kolor nie może być jedynym sposobem przekazywania informacji.
- Każdy wykres powinien mieć opis, jednostkę, zakres i możliwość odczytania wartości.

## 3. Główna nawigacja

Proponowane zakładki:
1. Start
2. Odczyty
3. Statystyki
4. Faktury
5. Ustawienia

## 4. Ekrany

### Logowanie i rejestracja
- E-mail i hasło z podpowiedziami dla menedżerów haseł (Bitwarden, Google) – DEC-028.
- Hasło domyślnie ukryte; przycisk z ikoną oka („Pokaż hasło” / „Ukryj hasło”) przy każdym polu hasła.
- Logowanie kontami Google, Microsoft, Facebook i Apple, gdy są skonfigurowane (DEC-024).

### Dashboard
- Wybrana nieruchomość.
- Koszt w bieżącym okresie.
- Zużycie kWh.
- Średnia dzienna.
- Prognoza rachunku.
- Data ostatniego odczytu.
- Wykres zużycia.
- Przycisk „Dodaj odczyt”.

### Dodawanie odczytu
- Wybór licznika i rejestru.
- Data i godzina.
- Wartość wskazania.
- Zdjęcie (opcjonalnie).
- Notatka (opcjonalnie).
- Podgląd różnicy względem poprzedniego odczytu.
- Ostrzeżenie o anomalii.
- Potwierdzenie zapisu.

### Historia odczytów
- Lista chronologiczna.
- Filtry zakresu dat i licznika.
- Wartość i różnica od poprzedniego odczytu.
- Oznaczenie źródła i danych skorygowanych.
- Szczegóły i historia zmian.

### Statystyki
- Dziennie, tygodniowo, miesięcznie, rocznie.
- Zużycie i koszt jako oddzielne serie.
- Porównanie okresów.
- Oznaczenie estymacji przy rzadkich odczytach.

### Faktury
- Lista faktur.
- Dodawanie kwoty i okresu.
- Załącznik.
- Porównanie prognozy z rzeczywistą kwotą.

### Ustawienia
- Nieruchomości: wybór, dodawanie (kreator konfiguracji), edycja z numerem PPE (wpisywanym lub skanowanym), usuwanie z potwierdzeniem.
- Wygląd: tryb jasny/ciemny/systemowy i kolor motywu – zapisywane na telefonie.
- Liczniki i rejestry.
- Operator i sprzedawca.
- Taryfa i stawki.
- Okres rozliczeniowy.
- Budżet i powiadomienia.
- Konto, prywatność i eksport.

## 5. Onboarding

Kreator konfiguracji powinien być podzielony na krótkie kroki:
1. Dodanie nieruchomości.
2. Wybór operatora dystrybucyjnego.
3. Wybór sprzedawcy.
4. Wybór taryfy.
5. Konfiguracja licznika i rejestrów.
6. Wprowadzenie pierwszego odczytu.
7. Podsumowanie i wyjaśnienie, że prognoza będzie dokładniejsza po kolejnych odczytach.

Użytkownik powinien móc pominąć dane, których nie zna, i uzupełnić je później.

## 6. Stany interfejsu

Każdy ekran powinien obsługiwać:
- ładowanie;
- brak danych;
- błąd i ponowienie;
- brak internetu;
- dane nieaktualne;
- dane szacunkowe;
- częściową konfigurację;
- brak uprawnień.

## 7. Mikrocopy

Używać prostych określeń:
- „Ostatni odczyt”
- „Zużycie od poprzedniego odczytu”
- „Szacowany koszt”
- „Prognoza rachunku”
- „Rzeczywista kwota faktury”
- „Dane szacunkowe”

Nie używać określenia „aktualny koszt faktury”, jeśli wynik jest tylko prognozą.
