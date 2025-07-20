# Finaler Implementierungsplan: Vom Fork zum GamifyBoard Prototyp (Version 3.0)

An: Entwicklungsteam GamifyBoard
Von: Projektleitung
Datum: 20. Juli 2025
Betreff: Finaler, korrigierter Masterplan mit klar getrennten Phasen für Stabilisierung und Entwicklung.

## 1. Projektmanagement & Workflow

Wichtiger Hinweis für das gesamte Team: Bevor mit der Arbeit begonnen wird, sind die folgenden Dokumente und Prozesse zu verstehen und anzuwenden. Dies stellt sicher, dass alle Beteiligten (Entwickler und KI-Agenten) auf dem gleichen Stand sind und Fehler vermieden werden.

### 1.1 Fortschritts-Tracking mit GitHub Milestones & Issues

Um den Fortschritt transparent zu verfolgen, wird der Entwicklungsplan direkt in GitHub abgebildet:

- **GitHub Milestones:** Jeder "Meilenstein" in diesem Dokument (z.B. "Meilenstein 1: Minimales Re-Branding & Bereinigung") wird als eigener Meilenstein im GitHub-Repository angelegt.
- **GitHub Issues:** Jede einzelne "Task" (z.B. "Task 1.1: Visuelles Re-Branding") wird als separates Issue in GitHub erstellt und dem entsprechenden Meilenstein zugewiesen.
- **Workflow:** Ein Entwickler (oder ein Agent) "nimmt" sich ein offenes Issue, arbeitet daran und schließt es, wenn die Aufgabe erledigt ist. Der Fortschritt des Meilensteins ist so jederzeit in GitHub ersichtlich.

### 1.2 Das Projekt-Logbuch (IMPLEMENTATION_LOG.md)

Dies ist die zentrale Anlaufstelle für alle projektrelevanten Informationen und Entscheidungen.

- **Zweck:** Das Logbuch dient als Projekttagebuch. Es dokumentiert den Fortschritt, getroffene Entscheidungen und vor allem aufgetretene Probleme und deren Lösungen, um zu verhindern, dass dieselben Fehler wiederholt werden.
- **Pflichtlektüre:** Jeder Entwickler (menschlich oder KI) ist verpflichtet, vor Arbeitsbeginn die neuesten Einträge in `IMPLEMENTATION_LOG.md` zu lesen, um auf dem aktuellen Stand zu sein.

### 1.3 Wichtige Systemanweisungen

- **Stabile Basis:** Das Projekt basiert auf einem "Shallow Fork" von Excalidraw. Interne Paketnamen und Verzeichnisstrukturen (`@excalidraw`, `packages/excalidraw`) bleiben unverändert, um zukünftige Updates zu ermöglichen.
- **Code-Änderungen:** Änderungen werden primär in `excalidraw-app` vorgenommen. Änderungen an den `packages` sollten nur nach sorgfältiger Prüfung und Dokumentation erfolgen.
- **Tests:** Nach jeder signifikanten Änderung müssen die Tests mit `yarn test --watch=false` ausgeführt werden. Dieser Befehl verhindert, dass der Test-Runner im interaktiven Modus hängen bleibt. Bei Snapshot-Änderungen sind diese mit `yarn test -u --watch=false` zu aktualisieren und zu committen.

---

## 2. Meilensteine

### Meilenstein 0: Radikale Bereinigung und Stabilisierung (Abgeschlossen)

- **Ziel:** Eine stabile, lauffähige und saubere Codebasis des ursprünglichen Excalidraw-Forks wiederherzustellen.
- **Ergebnis:** Das Projekt ist in einem sauberen, stabilen und lauffähigen Zustand. Die Grundlage für die Weiterentwicklung ist geschaffen. (Siehe `IMPLEMENTATION_LOG.md` für Details).

### Meilenstein 1: Minimales Re-Branding & Bereinigung

- **Ziel:** Die Anwendung für den Nutzer als "GamifyBoard" erscheinen lassen und Excalidraw-spezifische Links entfernen, damit alle Tests erfolgreich durchlaufen.
- **Task 1.1:** Visuelles Re-Branding (`index.html` anpassen, `new-logo.svg` verwenden).
- **Task 1.2:** UI Bereinigen (`packages/excalidraw/components/main-menu/DefaultItems.tsx` anpassen, um Socials zu entfernen).
- **Task 1.3:** Änderungen committen.
- **Task 1.4:** Test-Snapshots aktualisieren (`yarn test -u --watch=false`).

### Meilenstein 2 & folgende: Feature-Entwicklung

- **Ziel:** Implementierung der Kernfunktionen des GamifyBoards.
- **Details:** Siehe `GAMIFYBOARD_MVP.md` für die technische Umsetzung der Gamify-Toolbar und der Spiellogik.
