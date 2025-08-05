GamifyBoard

![GamifyBoard Social Media Banner](public/gamifyboard-og-image.png)

Eine Open-Source Whiteboard-Plattform zur Erstellung interaktiver, kollaborativer Lernspiele.

Live-Anwendung: [gamifyboard.ndy.onl](https://gamifyboard.ndy.onl) GitHub Repository: [https://github.com/ndy-onl/gamifyboard](https://github.com/ndy-onl/gamifyboard)

Über das Projekt

GamifyBoard kombiniert die Flexibilität eines kollaborativen Online-Whiteboards mit einer intuitiven, visuellen No-Code-Engine. Das Ziel ist es, Trainer, Lehrer und Teams zu befähigen, ansprechende Lern- und Workshop-Erlebnisse zu schaffen, ohne eine einzige Zeile Code schreiben zu müssen.

Basierend auf Excalidraw

Dieses Projekt ist ein Fork des exzellenten Open-Source-Whiteboards Excalidraw. Wir sind der Excalidraw-Community zutiefst dankbar für ihre herausragende Arbeit, die diese Weiterentwicklung erst möglich macht. GamifyBoard steht, genau wie Excalidraw, unter der MIT-Lizenz. Die originale Lizenz ist in der LICENSE-Datei in diesem Repository einsehbar.

Kernfunktionen (Roadmap)

- No-Code Spiel-Editor: Erstellen Sie interaktive Elemente wie "Karten" und "Zonen" per Knopfdruck.

- Regel-Engine: Definieren Sie visuell, welche Karte zu welcher Zone gehört.

- Automatische Auswertung: Erhalten Sie sofortiges visuelles Feedback, wenn eine Aufgabe korrekt gelöst wurde.

- Kollaboration in Echtzeit: Arbeiten Sie gemeinsam mit Ihrem Team an einem Board.

- Vorlagen-Bibliothek: Speichern und laden Sie wiederverwendbare Spiel- und Workshop-Vorlagen.

Getting Started: Lokale Entwicklungsumgebung

Um GamifyBoard lokal zu betreiben und weiterzuentwickeln, folgen Sie diesen Schritten:

Voraussetzungen

- Node.js (Version 16 oder höher)

- Yarn Classic (v1)

Installation & Start

- Repository klonen:

  ```bash
  git clone https://github.com/ndy-onl/gamifyboard.git
  cd gamifyboard
  ```

- Abhängigkeiten installieren:

  ```bash
  yarn install
  ```

- Entwicklungsserver starten:

  ```bash
  yarn start
  ```

  Die Anwendung ist nun unter http://localhost:3000 (oder einem anderen verfügbaren Port) erreichbar.

- Tests ausführen:

  ```bash
  yarn test
  ```

Wichtige Dokumente für Entwickler

Bevor Sie mit der Entwicklung beginnen, machen Sie sich bitte mit den folgenden Dokumenten vertraut:

- [README.md](README.md) (Diese Datei): Ihr erster Anlaufpunkt.

- [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md): Das Projekttagebuch. Pflichtlektüre vor jeder Code-Änderung, um den aktuellen Stand und bekannte Probleme zu erfassen.

- [PROJECT_PLAN.md](PROJECT_PLAN.md): Der strategische Masterplan mit der Übersicht aller Meilensteine.

- [GAMIFYBOARD_MVP.md](GAMIFYBOARD_MVP.md): Die detaillierte technische Spezifikation für die aktuellen Entwicklungsaufgaben.

Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Details finden Sie in der [LICENSE](LICENSE)-Datei.