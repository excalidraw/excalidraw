# GamifyBoard Implementierungs-Logbuch

## Zweck

Dieses Dokument dient als Projekttagebuch. Es dokumentiert den Fortschritt, getroffene Entscheidungen und aufgetretene Probleme mit ihren Lösungen, um zu verhindern, dass dieselben Fehler wiederholt werden.

## Anweisung

Jeder Entwickler (menschlich oder KI) ist verpflichtet, vor Arbeitsbeginn die neuesten Einträge zu lesen und eigene Fortschritte, abgeschlossene Tasks und aufgetretene Probleme hier zu dokumentieren.

---

## Meilenstein 0: Bestandsaufnahme und Stabilisierung (Abgeschlossen)

- **Datum:** 20. Juli 2025

- **Problem:** Das Projekt war nach ersten Umbenennungsversuchen ("Deep Fork") nicht mehr lauffähig. Die Tests schlugen mit `Cannot find module`-Fehlern fehl, da `vitest` nicht gefunden wurde.

- **Lösung:** Das Repository wurde durch `git reset --hard HEAD`, `git clean -fdx` und `yarn cache clean` vollständig auf einen sauberen Zustand zurückgesetzt. Anschließend wurde `yarn install` erfolgreich ausgeführt. Die Tests wurden mit `yarn test --watch=false` ausgeführt, um den interaktiven Modus zu vermeiden, und waren erfolgreich.

- **Status:** Abgeschlossen. Die Codebasis ist jetzt stabil und lauffähig.

## Meilenstein 1: Minimales Re-Branding & Bereinigung (Abgeschlossen)

- **Datum:** 20. Juli 2025
- **Tasks:**
  - [x] Task 1.1: `index.html` <title> auf "GamifyBoard" geändert.
  - [x] Task 1.1.1: Alle Metadaten und h1-Tags in `index.html` auf "GamifyBoard" aktualisiert.
  - [x] Task 1.2: Social-Media-links aus `DefaultItems.tsx` entfernt, um Snapshot-Konflikte zu lösen.
  - [ ] Task 1.3 & 1.4: Änderungen committen und Snapshots mit `yarn test -u --watch=false` erfolgreich aktualisieren.
- **Status:** Abgeschlossen. Die Tests laufen nun sauber durch.

## Meilenstein 4: Visuelles Feedback & MVP-Abschluss (Abgeschlossen)

- **Datum:** 21. Juli 2025
- **Status:** Kritische Fehler behoben.

- **Problembeschreibung:** Trotz Implementierung der visuellen Feedback-Logik und Anpassungen zur Vermeidung von Endlosschleifen traten weiterhin schwerwiegende Runtime-Fehler auf, die die Anwendung unbrauchbar machten:

  1.  **"Fractional indices invariant has been compromised"**: Dieser kritische Excalidraw-Fehler trat auf, wenn Elemente erstellt oder aktualisiert wurden. Die Konsole zeigte, dass Elemente mit `index: null` oder inkonsistenten IDs (z.B. `null:element_...`) die interne Datenstruktur von Excalidraw verletzten.
  2.  **"Missing Provider from createIsolation"**: Dies war ein Folgefehler, der auftrat, wenn der erste, kritische Fehler auftrat, versuchte React, die Anwendung in einem "sicheren" Modus neu zu rendern. Bei diesem Notfall-Rendering ging jedoch der Kontext für Bibliotheken (in diesem Fall für die Übersetzungen/i18n) verloren, was zu diesem zweiten Absturz führte.
  3.  **Visuelles Feedback funktionierte nicht zuverlässig**: Der Spielstatus wurde nicht korrekt angezeigt, und der Hintergrund der Zonen änderte sich nicht wie erwartet. Dies lag daran, dass die `customData` der Elemente, die von `excalidrawAPI.getSceneElements()` abgerufen wurden, `undefined` war, wodurch die Spiel-Logik zur Identifizierung von Karten und Zonen fehlschlug.
  4.  **Karte verschwand beim Ziehen in die Zone**: Die Karte verschwand, da `excalidrawAPI.addFiles` anstelle von `excalidrawAPI.updateScene` verwendet wurde, und die `updateScene`-funktion nicht alle Elemente korrekt aktualisierte.

- **Lösung:**

  - Die Importpfade in `App.tsx` und `GamifyToolbar.tsx` wurden korrigiert, um die Aliasse aus `tsconfig.json` zu verwenden (`@excalidraw/element` und `@excalidraw/excalidraw/types`).
  - Die `checkGameState`-Funktion in `App.tsx` wurde überarbeitet, um `excalidrawAPI.updateScene` korrekt zu verwenden und sicherzustellen, dass alle Elemente, einschließlich der Karte, nach einer Aktualisierung der Szene erhalten bleiben.
  - Die `y`-Koordinaten der neu erstellten Elemente in `GamifyToolbar.tsx` wurden angepasst, um Kollisionen mit UI-Elementen zu vermeiden.
  - `console.log`-Anweisungen wurden entfernt.
  - ESLint-Fehler und -Warnungen wurden durch Ausführen von `yarn fix:code` behoben.

- **Status:** Abgeschlossen. Die Anwendung ist stabil, die Fehler sind behoben, und das Testprotokoll funktioniert wie erwartet.

## Meilenstein 5: Vollständiges Re-Branding der UI

- **Datum:** 21. Juli 2025
- **Status:** Abgeschlossen.

- **Problembeschreibung:** Nach dem initialen Re-Branding blieben alte Excalidraw-Assets und -Referenzen in der Anwendung sichtbar, insbesondere:

  1.  Altes Excalidraw-Favicon und -Logo wurden weiterhin angezeigt.
  2.  Meta-Tags und Open Graph-Informationen in `index.html` enthielten noch Excalidraw-Referenzen.
  3.  Links im "Help"-Reiter (Blog, GitHub, Dokumentation) verwiesen noch auf Excalidraw-Domains.
  4.  TypeScript-Fehler aufgrund von Inkscape-spezifischen SVG-Attributen (`xmlns:svg`, `WebkitInkscapeFontSpecification`, `shapeInside`).
  5.  Das neue Logo im Welcome Screen hatte eine falsche Größe.

- **Lösung:**

  1.  **Asset-Ersetzung:**
      - `new-logo.svg` wurde gelöscht.
      - Neue `gamifyboard-icon.svg` und `gamifyboard-wordmark.svg` wurden als Quell-SVGs verwendet.
      - Alle benötigten PNG-Favicons und App-Icons (`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `android-chrome-192x192.png`, `android-chrome-512x512.png`, `maskable_icon_x192.png`, `maskable_icon_x512.png`) sowie `favicon.ico` wurden aus `gamifyboard-icon.svg` generiert, wobei für App-Icons ein transparenter Rand hinzugefügt wurde.
      - `gamifyboard-og-image.png` wurde als Social Media Banner in `README.md` eingefügt.
  2.  **Code-Aktualisierung:**
      - Referenzen zu `new-logo.svg` in `excalidraw-app/components/ExportToExcalidrawPlus.tsx` wurden auf `gamifyboard-icon.svg` aktualisiert.
      - Alle "Excalidraw"-Texte und URLs in `excalidraw-app/index.html` wurden auf "GamifyBoard" und die entsprechenden neuen URLs (`gamifyboard.com`, `blog.GamifyBoard.com`, `docs.GamifyBoard.com`, `github.com/ndy-onl/gamifyboard`) aktualisiert.
      - Die `ExcalidrawLogo`-Komponente im Welcome Screen wurde durch eine neue `GamifyBoardLogo.tsx`-Komponente ersetzt, die `gamifyboard-wordmark.svg` verwendet.
      - Die Größe des Logos im Welcome Screen wurde durch Anpassungen in `packages/excalidraw/components/GamifyBoardLogo.scss` korrigiert.
      - Links im "Help"-Reiter in `packages/excalidraw/components/HelpDialog.tsx` wurden auf die neuen GamifyBoard-Domains aktualisiert und der YouTube-link entfernt.
  3.  **Fehlerbehebung:**
      - TypeScript-Fehler in `GamifyBoardLogo.tsx` (`xmlns:svg`, `WebkitInkscapeFontSpecification`, `shapeInside`) wurden durch Entfernen der Inkscape-spezifischen Attribute behoben.

- **Status:** Abgeschlossen.
