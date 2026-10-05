# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

## [0.6.0] - 11.09.2026

### Hinzugefügt

- Trainer können Trainings/Anlässe absagen (bleiben durchgestrichen sichtbar) und durch erneutes Speichern automatisch wieder aktivieren.
- Trainer können Trainings/Anlässe endgültig löschen, inkl. aller zugehörigen Anwesend-/Abwesend-Einträge;
- Mehrtägige Anlässe: jeder Tag ist jetzt einzeln bearbeitbar, absagbar und löschbar.
- Bemerkung bei Trainings/Anlässen wird standardmässig angezeigt.

### Behoben

- Beim Eintragen einer Abwesenheit ohne Grund erschien keine Fehlermeldung.
- Landscape-Ansicht: Willkommens-, Anmelde- und weitere Formulare waren teils nicht mehr vollständig sichtbar, ohne zu scrollen.

### Geändert
- Absenz-Dialog (Anwesend/Abwesend eintragen) neu gestaltet.
- Alle Buttons app-weit vereinheitlicht mit klarer Farb-Hierarchie.
- Dark Mode überarbeitet: weicherer Hintergrund statt reinem Schwarz.
- Abwesend-Punkt in der Übersicht neu rot statt grau.

## [0.5.0] - 10.09.2026

### Hinzugefügt
- Trainer können bestehende Trainings/Anlässe nachträglich bearbeiten (einzeln oder als ganze Serie).
- Fehlerseiten ergänzt (404, keine Berechtigung, Server-Fehler, abgelaufene Sitzung).
- App teilweise offline verfügbar: zuletzt geladene Daten werden lokal gespeichert und angezeigt.
- Packliste-Tab implementiert, inkl. Rechte pro Rolle und Live-Sync.
- App-Version wird unten im Profil angezeigt.

### Geändert
- "Profil löschen": Account bleibt in Supabase sichtbar (weiches Löschen), Login wird gesperrt statt den Account zu entfernen.
- Packliste: "Alle zurücksetzen" jetzt als grosser Button unten statt kleinem Icon oben.

## [0.4.1] - 10.09.2026 

### Hinzugefügt
- Bemerkung-Feld für Trainings/Anlässe, in der Übersicht über ein Info-Icon einsehbar.
- Endzeit bei Trainings ist neu ein Pflichtfeld.

### Behoben
- Anmeldeseite: ungewollte Breiten-Begrenzung aus der Landscape-Anpassung wieder entfernt.

### Geändert
- Titel wird jetzt immer in der Übersicht angezeigt, nicht mehr nur bei Anlässen.
- Trainings-/Anlass-Karten: grössere Schrift und Abstände für bessere Lesbarkeit.

## [0.4.0] - 10.09.2026

### Hinzugefügt
- "Passwort vergessen"-Funktion (neue Seiten, E-Mail-Link, Passwort neu setzen).
- Landscape-Anpassungen fürs iPhone (Safe-Area-Abstände, Inhalte nicht mehr über volle Breite gezogen).

### Behoben
- DB-Fix: "Profil löschen" schlug fehl, da fehlende Fremdschlüssel-Regeln die Löschung blockierten.
- "Passwort vergessen"-Link war durch einen CSS-Fehler unklickbar.

### Geändert
- Namensliste im Abwesenheiten-Tab: getrennte Anwesend-/Abwesend-Abschnitte mit  Avataren statt gemischter Liste.
- Trainings-/Anlass-Karten komplett neu, reduzierteres Design.
- Namen werden beim Speichern automatisch korrekt gross-/kleingeschrieben.


## [0.3.1] - 04.09.2026

### Hinzugefügt
- Anwesend-/Abwesend-Anzeige auf Segment-Style umgestellt (wie beim Tab-Selector) statt Grün/Rot, zusätzlich mit Icons für bessere Barrierefreiheit.

### Behoben
- DB-Fix: Volti konnten sich nicht als abwesend eintragen ("ON CONFLICT"-Fehler durch falschen Unique Index).
- DB-Fix: Eigener Abwesenheitsgrund verschwand beim erneuten Öffnen bzw. war für einen selbst nicht sichtbar – die View maskierte fälschlich auch den eigenen Eintrag.

## [0.3.0] - 04.09.2026

### Hinzugefügt
- Absenzen-Logik für Trainings/Anlässe (RLS, Privat-Sichtbarkeit, Realtime).
- "+"-Button für Trainer: neue Trainings/Anlässe erstellen (inkl. Dauerauftrag und mehrtägige Anlässe).
- Trainings-/Anlass-Karten ans Mockup angeglichen (Akkordeon-Ansicht, echte Tages-Instanzen).
- Unabhängige Anwesend-/Abwesend-Chips (getrenntes Auf-/Zuklappen); Badge-Farbe an das gewählte Farbschema gebunden.

### Behoben
- Zähler auf den Trainings-/Anlass-Karten laden jetzt sofort statt erst beim Aufklappen.
- Pipeline-Fix: fehlender SwUpdate-Provider im Test behoben.

## [0.2.1] - 04.09.2026

### Behoben
- Beim Bearbeiten des Profils konnte kein Bild hochgeladen werden ("No content provided"-Fehler).

## [0.2.0] - 04.09.2026

### Hinzugefügt
- Supabase-Projekt eingerichtet (CLI, Client, `.env`-Werte).
- Datenbank-Schema erstellt: Tabellen für Gruppen, Profile, Kind-Profile, Trainings/Anlässe, Abwesenheiten, Packliste.
- Row-Level-Security (RLS) für alle Rollen (Trainer/Volti/Eltern) auf allen Tabellen eingerichtet.
- Registrierung & Login an echtes Supabase-Backend angebunden.
- Live-Prüfung "E-Mail bereits registriert" bei der Registrierung.
- Profil löschen über eine sichere Edge Function (inkl. CORS-Fix).
- Willkommens-Seite mit Guard: prüft aktive Session sowie ob die Seite bereits gesehen wurde.
- Profil bearbeiten (Modal): Name ändern, Avatar-Upload zu Supabase Storage.

### Geändert
- Passwort-Mindestlänge bei der Registrierung auf 6 Zeichen angepasst.

## [0.1.0] - 03.09.2026

### Hinzugefügt
- Grundstruktur des Ionic-Projekts mit Tab-Navigation. Tabs: Abwesenheiten, Packliste, Profil.
- Eigenes App-Icon.
- UI-Grundgerüst nach Mockup gestaltet, mit Platzhalterdaten für Trainings und Anlässe.
- Login: Anmeldung und Registrierung mit Validierung.
- Autorisierung: Einladungscode bei der Registrierung erforderlich – separater Code für Trainer sowie für Volti und Eltern. Im nächsten Schritt wird zwischen Volti und Eltern unterschieden.
- Profil-Tab: Name, Gruppe und zwei Buttons (Abmelden und Profil löschen).
- Dark-/Lightmode.
- Farbschema: Gelb oder Rot.

### Geändert
- Allgemeines Design überarbeitet.