# 🌆 Cloud Runner — Cyberpunk Jump-and-Run

Ein schnelles, butterweich animiertes Jump-and-Run-Browser-Spiel im Cyberpunk-Stil, entwickelt mit reinem HTML5 Canvas, CSS3 und modernem JavaScript (ES2020+). Komplett ohne externe Frameworks, Bundler oder Audio-Dateien (100% prozedurale Grafik und Web Audio API Sound-Synthese).

---

## 🎮 Gameplay & Steuerung

- **Automatische Bewegung:** Die Spielfigur sprintet automatisch über einen Neon-Highway durch eine futuristische Megacity.
- **Steuerung Desktop:**
  - `Leertaste`, `Pfeiltaste Oben` (▲) oder `W`: **Springen**
  - Erneutes Drücken in der Luft: **Doppelsprung**
- **Startmenü & Highscores:**
  - Über den Button **„🏆 RANGLISTE“** im Startmenü kann die Bestenliste jederzeit eingesehen werden.
  - Nach einem Game Over kann der Name genau **einmal** eingetragen werden, woraufhin das Spiel nach Bestätigung automatisch zum Startmenü zurückkehrt.
- **Steuerung Mobile / Touch (Quer- & Hochformat):**
  - **Tap irgendwo auf den Bildschirm** oder den sichtbaren **Touch-Button (JUMP)** unten rechts.
  - Vollwertige **Hochformat-Unterstützung (Portrait Mode)** auf Smartphones und Tablets sowie klassisches 16:9 Querformat auf Desktops.
  - Zoom & Scrollen auf Mobilgeräten sind via `touch-action: manipulation` unterbunden.
- **Leben-System:**
  - Startet mit **3 Leben**, erweiterbar auf maximal **5 Leben** durch das Sammeln von Discs.
  - Bei Kollision oder Sturz in einen Abgrund: 1 Leben Abzug, Screen-Shake, roter Flash, Soundeffekt und 1,8s Unverwundbarkeit.
- **Sammelobjekt „Discs“:**
  - Holographisch funkelnde CDs, einzeln oder in Formationen von 2–5 Stück (Reihen, Spalten, Sprungbögen).
  - Jede Disc bringt Punkte; **20 Discs = +1 Extraleben** (bis max. 5 Leben). Der Zähler wird bei 20 und bei jedem Spielneustart auf 0 zurückgesetzt.
  - HUD-Anzeige: `DISCS: 0/20`.
- **Erhöhte Plattformen:**
  - Schwebende Cyber-Plattformen, auf die der Spieler von oben landen, laufen und abspringen kann.
  - Höhen und Distanzen sind exakt aus den Sprungparametern abgeleitet und bei jedem Tempo erreichbar.
- **Abgründe (Chasms):**
  - Lücken im Highway mit Laser-/Warnmarkierungen.
  - Breiten sind physikbasiert so begrenzt, dass sie stets fair überspringbar oder über Plattformen passierbar sind.
  - Ein Hineinfallen kostet 1 Leben und setzt den Spieler sicher auf die Fahrbahn zurück.
- **Hindernisse:**
  1. *Cyber-Barrieren (Boden)*: Dreieckige Gefahrenhindernisse auf der Fahrbahn.
  2. *Laser-Gates (Hoch)*: Holographische, vertikal pulsierende Laserbarrieren.
  3. *Cyber-Drohnen (Fliegend)*: Schwebende Überwachungsdrohnen mit Wellenbewegung.

---

## 🌆 Cyberpunk-Design & Dynamischer Tag-Nacht-Zyklus

- **Dynamischer 90-Sekunden-Zyklus:**
  - Startet zur **Mittagszeit** (heller blauer Himmel, warme Beleuchtung, Tag-Cityscape).
  - Wandelt sich kontinuierlich über **Nachmittag** und **Dämmerung** (flammendes Orange, Magenta, Violett).
  - Erreicht nach ca. **90 Sekunden** die tiefe **Cyberpunk-Nacht** (Mitternachtsblau/Dunkelviolett).
  - In der Nacht leuchten **Fenster**, **holographische Werbetafeln**, **Antennen-Beacons**, **Boden-Gitterlinien** und **Cyber-Moon** in leuchtenden Neonfarben (Cyan `#00f0ff`, Pink `#ff007f`, Gelb `#ffe600`).
- **Offscreen-Parallaxe (100% Ruckelfrei & Nahtlos):**
  - Texturen der Skyline werden auf Offscreen-Canvases vorberechnet und per exaktem Modulo nahtlos gekachelt.
  - Garantiert stabile 60+ FPS ohne Ruckler oder sichtbares Nachladen.

---

## 🔊 Audio-Engine (Web Audio API)

- **Soundeffekte:**
  - Sprung (Frequenz-Chirp), Doppelsprung (Oktave-Gleiten), Disc-Pickup (Glitzer-Chime), Extraleben-Fanfare, Schaden/Impact (Noise-Burst + Sawtooth-Drop), Meilenstein (Glocken-Arpeggio) und Game-Over-Drohne.
- **Hintergrundmusik:**
  - Ein treibender Synthwave-Loop (124 BPM) mit 16tel-Bassline, Arpeggio-Melodie, Kick und Snare.
- **Audio-Steuerung:**
  - Startet nach der ersten Nutzerinteraktion (konform zu Browser-Autoplay-Richtlinien).
  - Mute-Button oben rechts schaltet Audio stumm (wird in `localStorage` gemerkt).

---

## 📁 Projektstruktur

```
/
├── index.html           # HTML5-Struktur, HUD (Leben, Discs, Score), Overlays & Canvas
├── css/
│   └── style.css        # Cyberpunk-Styling, Discs-HUD-Animation, responsive Touch-Layouts
├── js/
│   ├── logic.js         # Reine, DOM-freie Spiellogik (Kollisionen, Discs, Plattformen, Abgründe, Highscores)
│   ├── audio.js         # Web Audio API Synthesizer (SFX inkl. Discs + Synthwave-Musikloop)
│   └── game.js          # Canvas-Rendering, Plattformen, Discs, Abgründe, Parallaxe, Input & Game Loop
├── tests/
│   └── logic.test.js    # Unit-Tests mit Node.js "node:test" & "node:assert"
├── package.json         # ES-Modul-Konfiguration & Test-Script
└── README.md            # Dokumentation & Deployment-Anleitung
```

---

## 🧪 Unit Tests ausführen

Die Spiellogik in `js/logic.js` ist vollständig vom DOM entkoppelt und wird über den in Node.js integrierten Test-Runner getestet:

```bash
# Tests ausführen
npm test
# oder direkt:
node --test
```

Alle 46 Testfälle laufen in wenigen Millisekunden durch.

---

## 🚀 Lokales Testen

```bash
# Mit Node.js (z. B. npx serve oder http-server):
npx serve .

# Oder mit Python 3:
python3 -m http.server 8080
```

Anschließend im Browser `http://localhost:8080` aufrufen.

---

## ☁️ Deployment auf Cloudflare Pages

Das Spiel ist als rein statische Website konzipiert und benötigt keinen Build-Schritt.

### Option A: Per Git-Repository (Empfohlen)
1. Repository zu GitHub / GitLab pushen.
2. Im **Cloudflare Dashboard** auf **Workers & Pages** $\to$ **Create application** $\to$ **Pages** $\to$ **Connect to Git** gehen.
3. Projekt auswählen.
4. **Build-Einstellungen:**
   - **Framework preset:** `None`
   - **Build command:** *(leer lassen)*
   - **Build output directory:** `.` (Wurzelverzeichnis)
5. Auf **Save and Deploy** klicken.

### Option B: Direktes Hochladen (Direct Upload)
1. Im Cloudflare Dashboard unter **Pages** $\to$ **Upload assets** wählen.
2. Alle Dateien des Projektordners (`index.html`, `css/`, `js/`, etc.) per Drag & Drop hochladen.
3. Bereitstellung bestätigen.
