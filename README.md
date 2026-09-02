# 🌆 Cloud Runner — Cyberpunk Jump-and-Run

Ein schnelles, butterweich animiertes Jump-and-Run-Browser-Spiel im Cyberpunk-Stil, entwickelt mit reinem HTML5 Canvas, CSS3 und modernem JavaScript (ES2020+). Komplett ohne externe Frameworks, Bundler oder Audio-Dateien (100% prozedurale Grafik und Web Audio API Sound-Synthese).

---

## 🎮 Gameplay & Steuerung

- **Automatische Bewegung:** Die Spielfigur sprintet automatisch über einen Neon-Highway durch eine futuristische Megacity.
- **Steuerung Desktop:**
  - `Leertaste`, `Pfeiltaste Oben` (▲) oder `W`: **Springen & Doppelsprung**
  - `Pfeiltaste Unten` (▼) oder `S`: **Cyber-Slide** (flach unter Barrieren durchrutschen)
- **Steuerung Mobile / Touch (Quer- & Hochformat):**
  - **Tap / Swipe-Up** oder **JUMP-Button**: Springen & Doppelsprung
  - **Swipe-Down** oder **SLIDE-Button**: Sliden mit Funken-Partikeln
  - Vollwertige **Hochformat-Unterstützung (Portrait Mode)** auf Smartphones und Tablets sowie 16:9 Querformat.
  - Zoom & Scrollen auf Mobilgeräten sind via `touch-action: manipulation` unterbunden.
- **Power-Ups (Cyber-Kapseln):**
  - 🛡️ **Neon-Schild**: Schützt vor genau 1 Treffer, ohne Leben abzuziehen.
  - 🧲 **Disc-Magnet (8s)**: Zieht Discs in der Umgebung magnetisch zum Runner an.
  - ⚡ **Overdrive-Dash (4.5s)**: Hyper-Speed, Unverwundbarkeit, Zerstörung gerammter Hindernisse und doppelter Score.
- **Air-Combos:**
  - Sammle Discs in der Luft ohne Bodenberührung für aufsteigende Multiplikatoren ($1.5\times$ bis $3.0\times$) und Bonus-Punkte bei der Landung.
- **Startmenü & Highscores:**
  - Über den Button **„🏆 RANGLISTE“** im Startmenü kann die Bestenliste jederzeit eingesehen werden.
  - Nach einem Game Over kann der Name genau **einmal** eingetragen werden, woraufhin das Spiel nach Bestätigung automatisch zum Startmenü zurückkehrt.
- **Leben-System:**
  - Startet mit **3 Leben**, erweiterbar auf maximal **5 Leben** durch das Sammeln von Discs.
  - Bei Treffer/Absturz: 1 Leben Abzug, Screen-Shake, roter Flash, Soundeffekt und 1,8s Unverwundbarkeit (sofern kein Schild aktiv ist).
- **Sammelobjekt „Discs“:**
  - Holographisch funkelnde CDs, einzeln oder in Formationen von 2–5 Stück (Reihen, Spalten, Sprungbögen).
  - Jede Disc bringt Punkte; **20 Discs = +1 Extraleben** (bis max. 5 Leben). Der Zähler wird bei 20 und bei jedem Spielneustart auf 0 zurückgesetzt.
  - HUD-Anzeige: `DISCS: 0/20`.
- **Erhöhte Plattformen & Abgründe (Chasms):**
  - Schwebende Cyber-Plattformen und bodenlose Lücken mit Laser-Warnlinien.
  - Breiten und Höhen sind physikbasiert stets fair erreich- und überspringbar.
- **Hindernisse:**
  1. *Cyber-Barrieren (Boden)*: Dreieckige Gefahrenhindernisse auf der Fahrbahn.
  2. *Laser-Gates (Boden)*: Vertikale Laser-Säulen zum Überspringen.
  3. *High-Laser-Gates (Hängend)*: Schwebende Laser-Emitter, unter denen hindurch gerutscht werden muss.
  4. *Cyber-Drohnen (Fliegend)*: Schwebende Überwachungsdrohnen mit Wellenbewegung und Nacht-Glow.

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

Alle 57 Testfälle laufen in wenigen Millisekunden durch.

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
