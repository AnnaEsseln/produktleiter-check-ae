# Aufgabe für Claude Code: Produktleiter-Check reparieren

## Ziel
Eine Seite, in die man eine Expertise eintippt. Die Seite schickt sie an eine Vercel-Funktion,
die Claude fragt und eine Produkttreppe mit 5 Stufen zurückgibt:
Freebie (0 €), Mini-Produkt (27 €), Bump (19 €), Upsell (79 €), Hauptprodukt (B2B 350 €, B2C 397 €).
Jede Stufe muss aus der Expertise folgen. Keine festen Vorlagen als Ergebnis.

## Dateien
- `index.html`: Seite. Ruft `POST /api/analyze` auf mit `{type, niche, aud, exp, hasProducts, products}`.
- `api/analyze.js`: Vercel-Funktion. Liest `ANTHROPIC_API_KEY` aus der Umgebung und ruft
  `https://api.anthropic.com/v1/messages` mit Modell `claude-sonnet-5-5` auf.
- `vercel.json`: setzt maxDuration 60 für die Funktion.

## Bekannter Stand
- Die Seite ist live unter https://produktleiter-check-ae.vercel.app/ (Vercel-Projekt "produktleiter-check-ae").
- Der API-Key ist in Vercel gesetzt. Die Anfrage läuft laut Abrechnung an Anthropic.
- Die Seite zeigt beim Fehler: "Die individuelle Treppe konnte nicht erstellt werden. Grund: ...".
- Der letzte bekannte Fehler: HTTP 502 nach ca. 15 s. Die genaue Ursache ist noch nicht bestätigt.
  Die aktuelle Funktion gibt den Grund in `detail` zurück. Er steht in der Seitenmeldung und
  im Netzwerk-Tab unter `analyze`.

## Was zu prüfen ist (in dieser Reihenfolge)
1. Lokal mit `vercel dev` starten, eine echte Anfrage stellen und `detail` lesen.
2. Falls `anthropic_404`: Modellname prüfen. Alternativ `claude-haiku-5-5` testen.
3. Falls `bad_json`: die Antwort ist abgeschnitten oder ungültig. Prefill `{` ist aktiv.
   `max_tokens` erhöhen oder die Anweisung verkürzen.
4. Falls `anthropic_401`: Key falsch oder nicht in der richtigen Umgebung (Production).
5. Falls `anthropic_429` oder `anthropic_529`: zu viele Anfragen oder überlastet. Erneut versuchen.

## Abnahme
- Die Ethik-Expertise "Ich bin ethische Verkäuferin und bringe Fotografen bei, wie sie ethisch verkaufen"
  muss eine Treppe ergeben, die sich auf Ethik und Verkauf bezieht, nicht auf Galerien.
- Jede Stufe enthält im Feld `basis` eine Wendung aus der Expertise.
- Keine Standard-Treppen als Ergebnis, nur die Fehlermeldung mit Grund.
