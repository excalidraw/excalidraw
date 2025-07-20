# Detaillierte Entwickler-Dokumentation: GamifyBoard MVP Kernfunktionen

An: Entwicklungsteam
Referenz: Finaler Implementierungsplan, Meilenstein 2 & 3
Ziel: Detaillierte technische Anleitung zur Implementierung der Gamify-Toolbar und der Kern-Spiellogik auf Basis des wiederhergestellten, lauffähigen Projektzustands.

## 1. Einleitung & Zielsetzung

Die Projektbasis ist nun stabil. Wir können mit der Implementierung der Kernfunktionen unseres MVP beginnen. Dieses Dokument beschreibt die technischen Details zur Entwicklung der "Gamify-Toolbar" und der dahinterliegenden Auswertungslogik.

**Wichtiger Hinweis:** Bevor Sie mit dem Schreiben von neuem Code beginnen, machen Sie sich mit den relevanten Dateien des wiederhergestellten Zustands vertraut.

## 2. Analyse des Ist-Zustands (Vorbereitender Schritt)

**Ziel:** Verstehen, wo und wie die neuen Features in die bestehende Codebasis integriert werden.

- **Task 2.0: Analyse der Integrationspunkte**
    - **Zu analysierende Datei 1:** `/var/www/gamifyboard/excalidraw-app/App.tsx`
        - **Fokus:** Identifizieren Sie die `<Excalidraw />`-Komponente. Machen Sie sich mit den Props `renderCustomUI` und `onChange` vertraut. Laut unserer Systemdoku sind dies unsere primären Schnittstellen, um die Benutzeroberfläche zu erweitern und auf Änderungen auf dem Canvas zu reagieren.
    - **Zu analysierendes Verzeichnis 2:** `/var/www/gamifyboard/excalidraw-app/components/`
        - **Fokus:** Sehen Sie sich die Struktur der bestehenden Komponenten an. Unsere neue `GamifyToolbar.tsx` wird hier als neue Datei angelegt und sollte sich stilistisch an den vorhandenen Komponenten orientieren.

## 3. Meilenstein 2: Implementierung der Gamify-Toolbar

**Ziel:** Eine UI-Komponente erstellen, mit der ein "Ersteller" die Bausteine für ein Lernspiel generieren kann.

- **Task 2.1: Erstellung der `GamifyToolbar.tsx` Komponente**
    - **Aktion:** Erstellen Sie die Datei `/var/www/gamifyboard/excalidraw-app/components/GamifyToolbar.tsx`.
    - **Technische Details:**
        - Die Komponente muss die `excalidrawAPI` als Prop empfangen, um mit dem Canvas interagieren zu können.
        - Sie enthält einen Button "Neues Spiel-Set erstellen".
        - Die `onClick`-Funktion dieses Buttons implementiert die Logik aus Task 2.2.

- **Task 2.2: Implementierung der Element-Erstellungslogik**
    - **Aktion:** Schreiben Sie die Logik innerhalb von `GamifyToolbar.tsx`.
    - **Technische Details:**
        - **Die Verbindung (Die Regel):** Der Kern der Spiellogik wird hier definiert. Bei jedem Klick wird ein Paar aus "Karte" und "Zone" erstellt, die über eine einzigartige ID miteinander verbunden sind.
        - **Das "Karten"-Element:** Dies ist das bewegliche Objekt. Es ist ein Standard-Excalidraw-Element (z.B. ein Rechteck), das durch `customData` zu einem Spielobjekt wird.
            - `customData` der Karte: `{ isCard: true, id: 'card_xyz' }`
        - **Das "Zonen"-Element:** Dies ist der Zielbereich.
            - `customData` der Zone: `{ isZone: true, accepts: 'card_xyz' }`

- **Task 2.3: Integration der Toolbar**
    - **Aktion:** Öffnen Sie `excalidraw-app/App.tsx` und binden Sie die Toolbar ein.
    - **Technische Details:**
        - Importieren Sie die `GamifyToolbar`.
        - Nutzen Sie die `renderCustomUI`-Prop der `<Excalidraw />`-Komponente, um die Toolbar zu rendern und ihr die `excalidrawAPI` zu übergeben.

## 4. Meilenstein 3: Implementierung der Kern-Spiel-Logik

**Ziel:** Die Anwendung soll die Aktionen des Spielers in Echtzeit auswerten.

- **Task 3.1 & 3.2: Spielzustand und Auswertungs-Engine**
    - **Aktion:** Erweitern Sie `excalidraw-app/App.tsx`.
    - **Technische Details:**
        - **State für Spielzustand:** Führen Sie einen `useState`-Hook ein, um den Lösungsstatus der Zonen zu speichern: `const [gameState, setGameState] = useState<Record<string, boolean>>({});`
        - **Auswertungsfunktion (`handleCanvasChange`):** Diese Funktion wird bei jeder Änderung auf dem Canvas aufgerufen.
            - Sie filtert alle Elemente, um eine Liste aller `zonen` und eine Liste aller `karten` zu erhalten.
            - Sie iteriert über jede `zone`.
            - Für jede `zone` sucht sie die passende `karte` (deren ID im `accepts`-Feld der Zone steht).
            - Sie führt eine Kollisionsprüfung durch, um festzustellen, ob die Karte vollständig innerhalb der Zone liegt.
            - Das Ergebnis (`true` oder `false`) wird in einem neuen `gameState`-Objekt gespeichert.
            - Am Ende wird `setGameState` mit dem neuen Objekt aufgerufen.

- **Task 3.3: Logik aktivieren**
    - **Aktion:** Übergeben Sie Ihre `handleCanvasChange`-Funktion an die `onChange`-Prop der `<Excalidraw />`-Komponente.

**Ergebnis:** Der Prototyp verfügt nun über eine funktionierende, wenn auch noch unsichtbare, Spiel-Engine. Die Interaktionen des Spielers werden korrekt ausgewertet und der Zustand der Anwendung wird entsprechend aktualisiert. Dies ist die Grundlage für das visuelle Feedback in Meilenstein 4.
