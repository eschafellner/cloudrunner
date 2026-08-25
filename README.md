# 🌆 Cloud Runner — Cyberpunk Jump-and-Run

Ein schnelles, atmosphärisches Jump-and-Run-Browser-Spiel im Cyberpunk-Stil, entwickelt mit reinem HTML5 Canvas, CSS3 und modernem JavaScript (ES2020+). Komplett ohne externe Frameworks, Bundler oder Audio-Dateien (100% prozedurale Grafik und Web Audio API Sound-Synthese).

---

## 🎮 Gameplay & Steuerung

- **Automatische Bewegung:** Die Spielfigur sprintet automatisch über einen Neon-Highway durch eine futuristische Megacity.
- **Steuerung Desktop:**
  - `Leertaste`, `Pfeiltaste Oben` (▲) oder `W`: **Springen**
  - Erneutes Drücken in der Luft: **Doppelsprung**
- **Steuerung Mobile / Touch:**
  - **Tap irgendwo auf den Bildschirm** oder den sichtbaren **Touch-Button (JUMP)** unten rechts.
  - Zoom & Scrollen auf Mobilgeräten sind via `touch-action: manipulation` unterbunden.
- **Leben-System:** 3 Leben. Bei Kollisionen gibt es visuellen Screen-Shake, Soundeffekt und eine 1,8-sekündige Unverwundbarkeitsphase.
- **Hindernisse:**
  1. *Cyber-Barrieren (Boden)*: Dreieckige Gefahrenhindernisse auf der Fahrbahn.
  2. *Laser-Gates (Hoch)*: Holographische, vertikal pulsierende Laserbarrieren.
  3. *Cyber-Drohnen (Fliegend)*: Schwebende Überwachungsdrohnen mit Wellenbewegung.
- **Punkte:** Laufende Punkte für Überlebenszeit sowie Bonus-Punkte für jedes erfolgreich überwundene Hindernis (+25 Pkt., Streak-Meldungen bei je 10 Hindernissen).

---

## 🌆 Cyberpunk-Design & Dynamischer Tag-Nacht-Zyklus

- **Dynamischer 90-Sekunden-Zyklus:**
  - Startet zur **Mittagszeit** (heller blauer Himmel, warme Beleuchtung, Tag-Cityscape).
  - Wandelt sich kontinuierlich über **Nachmittag** und **Dämmerung** (flammendes Orange, Magenta, Violett).
  - Erreicht nach ca. **90 Sekunden** die tiefe **Cyberpunk-Nacht** (Mitternachtsblau/Dunkelviolett).
  - In der Nacht leuchten **Fenster**, **holographische Werbetafeln**, **Antennen-Beacons**, **Boden-Gitterlinien** und **Cyber-Moon** in leuchtenden Neonfarben (Cyan `#00f0ff`, Pink `#ff007f`, Gelb `#ffe600`).
- **Mehrschichtige Parallaxe:**
  - Schicht 0: Dynamischer Himmel, funkelnde Sterne, Sonne & Cyber-Mond.
  - Schicht 1: Weit entfernte Wolkenkratzer-Silhouetten und fliegende Cyber-Autos mit Lichtspuren.
  - Schicht 2: Mittlere Hochhäuser mit zufälligen Fenster-Mustern und blinkenden Hologrammen.
  - Schicht 3: Perspektivisch bewegtes Neon-Raster auf der Fahrbahn.

---

## 🔊 Audio-Engine (Web Audio API)

- **Soundeffekte:**
  - Sprung (Frequenz-Chirp), Doppelsprung (Oktave-Gleiten), Schaden/Impact (Noise-Burst + Sawtooth-Drop), Meilenstein (Glocken-Arpeggio) und Game-Over-Drohne.
- **Hintergrundmusik:**
  - Ein treibender, prozedural generierter Synthwave-Loop (124 BPM) mit 16tel-Bassline, Arpeggio-Melodie, Kick und Snare.
- **Audio-Steuerung:**
  - Startet nach der ersten Nutzerinteraktion (konform zu Browser-Autoplay-Richtlinien).
  - Mute-Button oben rechts schaltet Audio stumm (wird in `localStorage` gemerkt).

---

## 📁 Projektstruktur

```
/
├── index.html           # HTML5-Struktur, HUD, Overlays & Canvas-Container
├── css/
│   └── style.css        # Cyberpunk-Styling, CRT-Filter, responsive Touch-Layouts
├── js/
│   ├── logic.js         # Reine, DOM-freie Spiellogik (Kollisionen, Tag-Nacht, Highscores)
│   ├── audio.js         # Web Audio API Synthesizer (SFX + Synthwave-Musikloop)
│   └── game.js          # Canvas-Rendering, Parallaxe, Input, Partikelsystem & Game Loop
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

Alle 33 Testfälle für Kollisionserkennung, Geschwindigkeitskurve, Spawn-Intervalle, Highscore-Verwaltung, Namensvalidierung, Tag-Nacht-Farbinterpolation und Spieler-Physik laufen in wenigen Millisekunden durch.

---

## 🚀 Lokales Testen

Da Standard-ES-Module (`<script type="module">`) verwendet werden, empfiehlt sich ein lokaler Webserver:

```bash
# Mit Node.js (z. B. npx serve oder http-server):
npx serve .

# Oder mit Python 3:
python3 -m http.server 8080
```

Anschließend im Browser `http://localhost:8080` (oder die angezeigte URL) aufrufen.

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

---

## 💾 Persistenz

- Highscores und Mute-Status werden clientseitig im `localStorage` des Browsers gespeichert:
  - `cloudrunner_highscores`: Top-Highscore-Liste mit Spielername, Punkten und Datum.
  - `cloudrunner_muted`: Stummschaltungs-Status.
# cloudrunner
