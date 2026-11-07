# Wattly – gniazdka Tapo i „Na co schodzi prąd”

Instrukcja dla użytkownika: jak podłączyć gniazdka TP-Link Tapo P110/P115 i urządzenia z własną aplikacją (np. lodówkę Samsung w SmartThings), żeby zobaczyć, ile prądu zużywa każdy sprzęt i jaką część rachunku stanowi. Decyzja i uzasadnienie: DEC-034 w [Wattly_Decisions.md](Wattly_Decisions.md).

## Jak to działa

- **Gniazdka Tapo** są odczytywane **bezpośrednio przez telefon** w domowej sieci Wi-Fi (protokół lokalny KLAP). Nie potrzeba Home Assistanta, chmury TP-Link ani dodatkowego serwera. Serwer Wattly działa w chmurze i nie widzi domowej sieci, dlatego telefon jest pośrednikiem.
- Gniazdko samo zapamiętuje **dzienne zużycie z bieżącego i poprzedniego kwartału**. Telefon pobiera tę historię i wysyła ją do Wattly jako dzienne wpisy. Gdy przez kilka tygodni nie będzie Cię w domu, nic nie przepadnie, bo przy następnej synchronizacji dni się uzupełnią.
- Synchronizacja włącza się **sama po otwarciu aplikacji** (najczęściej co 6 godzin), gdy telefon jest w domowej sieci. Można ją też uruchomić przyciskiem *Synchronizuj teraz*.
- **Urządzenia z własną aplikacją** (lodówka w SmartThings, pralka w Home Connect itp.) wpisujesz ręcznie, np. raz w miesiącu: okres i liczbę kWh odczytaną z ich aplikacji.
- Ekran **„Na co schodzi prąd”** (zakładka *Statystyki*) zestawia zużycie urządzeń z licznikiem. Pokazuje kWh, szacowany koszt i udział w zużyciu każdego urządzenia oraz pozycję „Pozostałe”, czyli różnicę między licznikiem a zmierzonymi urządzeniami.

## Bezpieczeństwo

- E-mail i hasło konta Tapo są zapisane **tylko na telefonie**, w bezpiecznym magazynie systemu (SecureStore / Keychain). Nigdy nie trafiają na serwer Wattly.
- Adresy IP gniazdek są zapisane tylko na telefonie.
- Na serwer trafia nazwa urządzenia, model, identyfikator gniazdka i dzienne kWh.
- Połączenie z gniazdkiem idzie przez lokalne HTTP, bo gniazdka nie obsługują HTTPS. Treść jest jednak szyfrowana przez sam protokół KLAP (AES-128), a hasło nie jest przesyłane, tylko jego skrót w procedurze uzgadniania.

## Konfiguracja krok po kroku

1. **Stały adres IP gniazdek.** W routerze ustaw rezerwację DHCP (*DHCP reservation* / *static lease*) dla każdego gniazdka. Bez tego adres może się zmienić po restarcie routera i telefon straci połączenie.
   - Adres i MAC znajdziesz w aplikacji Tapo: gniazdko → ⚙ → *Informacje o urządzeniu*.
2. **Zgodność z usługami innych firm.** W aplikacji Tapo: *Ja → Usługi innych firm → Zgodność z usługami innych firm* – włącz. Jest wymagana od oprogramowania gniazdek 1.4.
3. **Konto Tapo w Wattly.** *Ustawienia → Urządzenia → Podaj konto Tapo* – e-mail i hasło konta, na które gniazdka są zarejestrowane w aplikacji Tapo. E-mail musi być identyczny jak w aplikacji Tapo, znak w znak.
4. **Dodanie gniazdka.** *Dodaj gniazdko Tapo* → wpisz adres IP → *Połącz i dodaj*.
   - Wattly odczyta nazwę i model gniazdka, utworzy urządzenie i od razu pobierze historię.
   - Nazwę możesz zmienić w szczegółach urządzenia.
5. **Lodówka i inne urządzenia.** *Dodaj urządzenie ręcznie* → nazwa (np. „Lodówka”).
   - W szczegółach urządzenia wpisz okres (od–do, włącznie) i zużycie w kWh.
   - Wpis za ten sam okres zastępuje poprzedni. Okresy nie mogą na siebie nachodzić.
6. **Zestawienie.** *Statystyki → Na co schodzi prąd → Pokaż urządzenia*. Do wyboru są okresy: 30 dni, poprzedni miesiąc, 90 dni.

## Jak liczony jest koszt i udział

- Zużycie urządzenia w okresie to suma jego wpisów. Wpis, który tylko częściowo pokrywa okres (np. miesięczny wpis lodówki), jest liczony proporcjonalnie do liczby dni.
- Zużycie z licznika i cena pochodzą z tej samej kalkulacji co rozbicie kosztów. **Średnia cena brutto 1 kWh** to suma składników liczonych od kWh (energia i dystrybucja zmienna, z VAT) podzielona przez zużycie z licznika. Opłaty stałe nie są przypisywane urządzeniom.
- Koszt urządzenia to jego kWh pomnożone przez tę cenę. Jest to szacunek, a nie część faktury.
- Gdy urządzenia mają dane tylko z części okresu, ekran pokazuje „Dane z X z Y dni”.
- Gdy suma urządzeń przekracza licznik (np. brakuje odczytów albo wpis ręczny jest błędny), pojawia się ostrzeżenie, a „Pozostałe” wynosi 0.
- Urządzenie ukryte (przełącznik w szczegółach) nie jest wliczane do zestawienia, ale jego dane zostają.

## Ograniczenia i rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| „Brak połączenia z gniazdkiem” | Telefon nie jest w domowym Wi-Fi albo adres IP się zmienił. Ustaw rezerwację DHCP i popraw adres w szczegółach urządzenia. |
| „Gniazdko nie przyjęło danych konta Tapo” | Błędny e-mail lub hasło. Popraw je w *Ustawienia → Urządzenia → Konto Tapo → Zmień*. Hasło musi być hasłem konta, na które zarejestrowano gniazdko. |
| „Gniazdko odrzuciło połączenie lokalne…” | Oprogramowanie gniazdek **1.4 i nowsze** przyjmuje połączenie lokalne (KLAP) tylko wtedy, gdy w aplikacji Tapo włączona jest zgodność z usługami innych firm. Bez niej gniazdko odpowiada „403” i oczekuje nowego protokołu TPAP. Włącz: *Ja → Usługi innych firm (Third-Party Services) → Zgodność z usługami innych firm (Third-Party Compatibility)*. Odczekaj minutę i spróbuj ponownie. Jeśli opcja już była włączona, wyłącz ją, wyjdź z ekranu i włącz ponownie. W ostateczności zresetuj gniazdko, dodaj je w aplikacji Tapo od nowa i ponownie włącz zgodność. |
| „Gniazdko odpowiada w nieobsługiwany sposób… (TPAP)” | Nowsze oprogramowanie gniazdek (2025+) może używać protokołu TPAP zamiast KLAP. Wattly obsługuje tylko KLAP. Sprawdź, czy w aplikacji Tapo nie ma opcji zgodności lub aktualizacji; w razie potrzeby wpisuj zużycie ręcznie. |
| „… nie mierzy zużycia prądu” | Gniazdka P100/P105 nie mają pomiaru energii. Potrzebne są P110, P110M lub P115. |
| Brak danych z dzisiejszego dnia w zestawieniu | Okresy kończą się wczoraj, bo dzisiejsze dane są niepełne. |
| Lodówka Samsung (SmartThings) nie łączy się automatycznie | Tokeny SmartThings dla aplikacji prywatnych wygasają po 24 h, a pełna integracja wymagałaby rejestracji aplikacji OAuth w Samsungu. Na razie zużycie lodówki wpisuj ręcznie. |

Wymagany instalator: **1.3.0 lub nowszy**. Zawiera zgodę na lokalne HTTP (Android `usesCleartextTraffic`, iOS `NSAllowsLocalNetworking`) i opis dostępu do sieci lokalnej na iOS.
