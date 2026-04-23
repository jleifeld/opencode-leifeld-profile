# OpenCode Self-Learning System V2

> Zweck dieses Dokuments: korrigierter, lokal verifizierter Implementierungsplan fuer ein projekt-scoped Self-Learning-System in OpenCode.
> Dieser Plan ersetzt die fehlerhaften Annahmen aus der ersten Version und verwendet nur Mechaniken, die mit der hier vorhandenen OpenCode-Version belastbar umsetzbar sind.

---

## 1. Zielsetzung

Baue ein projekt-scoped Memory-System fuer OpenCode, das:

1. am Ende einer Session per `/learn` wiederverwendbare Learnings aus der aktuellen Session extrahiert
2. den User jeden Kandidaten einzeln reviewen laesst
3. angenommene Learnings als einzelne Markdown-Dateien unter `.opencode/learnings/items/` speichert
4. einen kompakten `INDEX.md` pflegt, der bei jedem Session-Start deterministisch geladen wird
5. Detail-Learnings nur bei Bedarf lazy nachlaedt
6. zaehlt, welche Detail-Learnings tatsaechlich gelesen wurden

---

## 2. Korrigierte Kernentscheidungen

Diese Punkte sind die entscheidenden Korrekturen gegenueber V1.

### 2.1 Index-Autoload nicht ueber `AGENTS.md`, sondern ueber `opencode.jsonc`

`AGENTS.md` parst `@file`-Referenzen nicht automatisch.

Darum wird `.opencode/learnings/INDEX.md` in `opencode.jsonc` unter `instructions` aufgenommen. Das ist der deterministische Mechanismus fuer Autoload.

`AGENTS.md` bleibt trotzdem wichtig, aber nur fuer Verhaltensregeln.

### 2.2 Lazy-Load der Detaildateien ueber `read`, nicht ueber `@`

Der urspruengliche Plan wollte Detaildateien ueber `@.opencode/learnings/<slug>.md` laden und dieselbe Nutzung ueber `tool.execute.after` auf `read` tracken.

Das ist nicht konsistent, weil `@file` keine normalen `read`-Tool-Calls erzeugt.

V2 verwendet daher fuer Detail-Learnings bewusst den `read`-Tool-Call. Dadurch gelten gleichzeitig:

- Lazy-Loading bleibt erhalten
- Nutzung ist pluginseitig beobachtbar
- `INDEX.md` bleibt klein im Default-Kontext

### 2.3 Session-Export nicht ueber `opencode export --format markdown`

Lokal verifiziert:

- `opencode export` exportiert JSON
- `--format markdown` ist hier nicht vorhanden
- `opencode export` ohne Session-ID ist interaktiv und damit fuer einen Command-Template-Include ungeeignet

V2 loest den Session-Export ueber ein Projekt-Plugin mit einem Custom Tool, das die OpenCode-SDK-Session-APIs verwendet.

### 2.4 Pfadschutz ueber native `permission.edit`

OpenCode kann pfadgenaue `edit`-Permissions bereits nativ.

V2 verwendet daher keine zusaetzliche Path-Guard-Hardening-Logik als Pflichtbestandteil, sondern native Permission-Regeln.

---

## 3. End-to-End-Flow

```text
Session N
  -> normale Arbeit
  -> User ruft /learn auf
  -> Command startet Subagent learning-extractor mit subtask: true
  -> Subagent ruft learning_export_session auf
  -> Plugin exportiert die aktuelle Session via SDK nach .opencode/learnings/exports/
  -> Subagent liest Export + INDEX.md
  -> Subagent erzeugt 0-5 Kandidaten
  -> Subagent praesentiert Kandidaten einzeln und wartet jeweils auf y/e/n/m
  -> akzeptierte Learnings werden unter .opencode/learnings/items/ gespeichert
  -> INDEX.md wird aus allen items/*.md neu erzeugt

Spaetere Session
  -> OpenCode laedt INDEX.md ueber opencode.jsonc instructions automatisch
  -> Agent liest zunaechst nur den Index
  -> bei passendem Match liest der Agent gezielt die Detaildatei via read
  -> Plugin zaehlt diesen read als Learning-Hit
```

---

## 4. Zielstruktur

```text
<project-root>/
.opencode/
  agents/
    learning-extractor.md
  commands/
    learn.md
    learnings-stats.md
  learnings/
    INDEX.md
    .stats.json                (vom Plugin erzeugt)
    exports/
      <date>_<session-id>.md
    items/
      <learning-file>.md
  plugins/
    learning-system.ts
AGENTS.md
opencode.jsonc
.gitignore
```

---

## 5. Komponenten

## 5.1 Plugin: `.opencode/plugins/learning-system.ts`

Dieses Plugin uebernimmt zwei Aufgaben:

1. Custom Tool `learning_export_session`
2. Hit-Counter fuer Detail-Learnings ueber `tool.execute.after`

Es ist bewusst klein gehalten und verwendet nur:

- `@opencode-ai/plugin`
- Node-Builtins
- OpenCode-SDK-Client aus dem Plugin-Context

### Warum ein Plugin hier sinnvoll ist

Nur das Plugin bekommt verifiziert Zugriff auf:

- `client`
- `directory`
- `worktree`

Damit kann der Session-Export robust ueber die SDK-Session-APIs erfolgen, statt ueber fragile Shell-Includes.

## 5.2 Command: `.opencode/commands/learn.md`

Der Command startet den Lernprozess.

Vorgaben:

- `agent: learning-extractor`
- `subtask: true`

Der Command selbst injiziert **keinen** Session-Export per `!`.
Stattdessen weist er den Subagenten an, zuerst `learning_export_session` aufzurufen.

## 5.3 Agent: `.opencode/agents/learning-extractor.md`

Der Agent ist fuer die eigentliche Extraktion, Review-Schleife und Speicherung verantwortlich.

Empfohlene Eigenschaften:

- `mode: subagent`
- `temperature: 0.1` bis `0.2`
- `bash: deny`
- `webfetch: deny`
- `edit` nur auf `.opencode/learnings/**` erlauben

Der Agent arbeitet mit:

- `learning_export_session`
- `read`
- `glob`
- `grep`
- `edit`

## 5.4 Command: `.opencode/commands/learnings-stats.md`

Read-only Command.

Er liest:

- `.opencode/learnings/.stats.json`
- `.opencode/learnings/INDEX.md`

und erzeugt eine kurze Tabelle mit:

- Top 5 nach Hits
- ungenutzten Learnings
- Totals

## 5.5 Starter-Index: `.opencode/learnings/INDEX.md`

Der Index muss direkt existieren, bevor er in `opencode.jsonc` als Instruction referenziert wird.

## 5.6 `opencode.jsonc`

Die bestehende `instructions`-Liste wird erweitert.

Wichtig: existierende Eintraege bleiben erhalten. Es wird nur `.opencode/learnings/INDEX.md` zusaetzlich aufgenommen.

## 5.7 `AGENTS.md`

`AGENTS.md` bekommt keinen `@.opencode/learnings/INDEX.md`-Autoload-Block.

Stattdessen bekommt es eine klare Verhaltensregel:

- der Index ist bereits ueber `instructions` geladen
- Detaildateien nur bei Match lesen
- niemals alle Learning-Dateien pauschal laden
- niemals `exports/` fuer normales Retrieval verwenden

---

## 6. Plugin-Tool `learning_export_session`

## 6.1 Zweck

Exportiert die aktuelle Session in eine lokale Markdown-Datei, die der `learning-extractor` anschliessend analysiert.

## 6.2 Implementationsbasis

Der Export erfolgt ueber die verifizierten SDK-Methoden:

- `client.session.get({ sessionID, directory })`
- `client.session.messages({ sessionID, directory, ... })`

## 6.3 Eingabe

Minimal:

- optional `sessionID`

Wenn keine `sessionID` uebergeben wird, verwendet das Tool `context.sessionID`.

## 6.4 Ausgabe

Das Tool gibt als Text mindestens zurueck:

- Exportpfad
- Session-ID
- Anzahl Messages

Beispiel:

```text
Saved session export to .opencode/learnings/exports/2026-04-23_P1YOwEtD.md (18 messages)
```

## 6.5 Zielpfad

```text
.opencode/learnings/exports/YYYY-MM-DD_<session-id>.md
```

## 6.6 Export-Semantik

V2 exportiert den **aktuellen effektiven Session-Zustand**.

V2 verspricht nicht, jede fruehe historische Rohphase vollstaendig zu rekonstruieren, weil Sessions kompaktifiziert oder Tool-Outputs gekuerzt sein koennen.

## 6.7 Exportformat

Beispielstruktur:

```md
# Session Export

- Session ID: <id>
- Title: <title>
- Exported At: <iso timestamp>
- Export Type: current-effective-session-state

## Messages

### User
...

### Assistant
...

### Tool: read
Input: ...
Output: ...
```

## 6.8 Filterregeln fuer Parts

Aufnehmen:

- `text`
- `tool` in kompakter Form
- `subtask` in kompakter Form
- `agent` optional und knapp

Nicht voll exportieren:

- `reasoning`
- `snapshot`
- `patch`
- `step-start`
- `step-finish`
- `compaction`

## 6.9 Tool-Output-Regeln

Tool-Outputs werden nicht roh und ungekuezt gespeichert.

Pflichtregeln:

- offensichtliche Secrets redigieren
- ueberlange Outputs kuerzen
- nur relevante Ausschnitte behalten
- Trunkierung klar markieren

Beispiele:

- `Authorization: Bearer abc...` -> `Authorization: [redacted]`
- sehr lange Logs -> `[output truncated]`

---

## 7. Learning-Extraktion und Review

## 7.1 Was als Learning zaehlt

Ja:

- nicht offensichtliche Root Causes
- projektspezifische Konfigurations- oder Tooling-Gotchas
- wiederverwendbare Workarounds
- Erkenntnisse nach mehreren Fehlversuchen
- wichtige User-Klarstellungen mit Wiederverwendungswert

Nein:

- generische Best Practices
- offensichtliche Standardnutzung von Sprache oder Framework
- reine Einzelfall-Fixes ohne Wiederverwendungswert
- Tippfehler und sonstiges Session-Rauschen

## 7.2 Kandidatenzahl

Zielwert: `0-5` Kandidaten pro `/learn`-Durchlauf.

Weniger ist besser als schwache Eintraege.

## 7.3 Review-Flow

Jeder Kandidat wird einzeln praesentiert und erst dann aufgeloest, bevor der naechste Kandidat gezeigt wird.

Format:

```text
-----------------------------------------------
Candidate [N/M]: <Title>
Category: <category>   Tags: [a, b, c]

Problem:   <1-3 saetze>
Cause:     <1-3 saetze>
Solution:  <konkrete Loesung>
-----------------------------------------------
[y] accept   [e] edit   [n] reject   [m <slug>] merge
```

Verhalten:

- `y` -> in Save-Queue
- `e` -> User sagt, was geaendert werden soll; Kandidat wird neu praesentiert
- `n` -> Kandidat verwerfen
- `m <slug>` -> in existierende Datei mergen

## 7.4 Deduplication

Vor dem Finalisieren eines Kandidaten soll der Agent `INDEX.md` auf starke Ueberschneidungen pruefen.

Bei starker Naehe:

```text
This resembles <slug>.
[m <slug>] merge   [y] save as new   [n] reject
```

---

## 8. Dateiformat der Learnings

Pfad:

```text
.opencode/learnings/items/<slug>.md
```

Vorschlag:

```md
---
title: <human-readable title>
slug: <kebab-case slug>
category: auth | build | framework | tooling | data | infra | ui | testing | other
tags: [kebab-case, keywords]
discovered: YYYY-MM-DD
source_session: <session-id>
source_export: exports/YYYY-MM-DD_<session-id>.md
---

## Problem
...

## Root Cause
...

## Solution
...

## Related
- <optional related slug>
```

## 8.1 Slug-Regeln

- lowercase
- kebab-case
- max 50 Zeichen
- keine Datumsangaben im Slug

Beispiele:

- `tooling-corepack-before-pnpm`
- `framework-react-strict-mode-double-effect`
- `build-module-resolution-bundler-vs-node`

---

## 9. INDEX.md-Format

Der Index ist kompakt, stabil und fuer Autoload geeignet.

```md
# Project Learnings Index

> This file is loaded automatically via opencode.jsonc instructions.
> Read a detailed learning file only when the current task clearly matches it.

<!-- Auto-generated by /learn. Manual edits may be overwritten. -->

## Tooling & CLI
- `items/tooling-corepack-before-pnpm.md` - Enable corepack before pnpm setup to avoid bootstrap failures.

## Framework Quirks
- `items/framework-react-strict-mode-double-effect.md` - React Strict Mode can double-run effects in development.
```

## 9.1 Kategorien

Mapping:

| category | Header |
|---|---|
| `auth` | `## Auth & Security` |
| `build` | `## Build & Deploy` |
| `framework` | `## Framework Quirks` |
| `tooling` | `## Tooling & CLI` |
| `data` | `## Data & Persistence` |
| `infra` | `## Infrastructure & Deploy` |
| `ui` | `## UI & Styling` |
| `testing` | `## Testing` |
| `other` | `## Other` |

## 9.2 Regenerierungsregel

`INDEX.md` wird nach jedem erfolgreichen Save aus allen `items/*.md` neu erzeugt.

Nicht einbeziehen:

- `INDEX.md`
- `.stats.json`
- `exports/`
- versteckte Dateien

---

## 10. Stats-Semantik

V2 trackt **nicht** "jede semantische Nutzung eines Learnings", sondern konkret:

> Wie oft eine Detail-Learning-Datei explizit ueber das `read`-Tool gelesen wurde.

Das ist absichtlich eng und technisch eindeutig.

## 10.1 Was gezaehlt wird

- `read` auf `.opencode/learnings/items/*.md`

## 10.2 Was nicht gezaehlt wird

- `INDEX.md`
- `exports/*.md`
- `.stats.json`
- alles ausserhalb von `.opencode/learnings/items/`
- implizites Vorhandensein ueber `instructions`

## 10.3 Stats-Format

Pfad:

```text
.opencode/learnings/.stats.json
```

Beispiel:

```json
{
  "tooling-corepack-before-pnpm": {
    "hits": 3,
    "first_used": "2026-04-23T12:00:00.000Z",
    "last_used": "2026-04-24T08:15:10.000Z"
  }
}
```

---

## 11. `opencode.jsonc`-Aenderung

Die bestehende `instructions`-Liste wird erweitert.

Beispiel:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    "/existing/path/to/AGENTS.md",
    ".opencode/learnings/INDEX.md"
  ]
}
```

Wichtig:

- bestehende Instructions nicht entfernen
- nur den Index zusaetzlich eintragen
- erst den Starter-Index anlegen, dann den Eintrag setzen

---

## 12. `AGENTS.md`-Block

Einzufuegen als Verhaltensregel, nicht als Autoload-Mechanik:

```md
## Project Learnings

The project learning index is loaded via `opencode.jsonc` instructions.

When the current task clearly resembles an entry from the learning index, read the matching file under `.opencode/learnings/items/` before proceeding.

Do not read all learning files by default.
Do not use `.opencode/learnings/exports/` for routine retrieval.

After solving a new non-obvious problem, suggest running `/learn` at the end of the session.
```

---

## 13. Git-Policy

## 13.1 Sollte ignoriert werden

Pflicht:

```gitignore
.opencode/learnings/exports/
```

Begruendung:

- rohe Session-Artefakte
- potentiell sensible Inhalte
- kein normaler Retrieval-Bereich

## 13.2 User-Entscheidung erforderlich

Fuer `.opencode/learnings/.stats.json` soll nach der Installation bewusst entschieden werden:

1. committen
2. ignorieren

Die Implementierung soll diese Entscheidung nicht stillschweigend treffen.

---

## 14. Implementierungsreihenfolge

1. `.opencode/learnings/INDEX.md` anlegen
2. `.opencode/learnings/items/` und `.opencode/learnings/exports/` anlegen
3. `opencode.jsonc` um `.opencode/learnings/INDEX.md` unter `instructions` erweitern
4. `AGENTS.md` um den Retrieval-Block erweitern
5. Plugin `.opencode/plugins/learning-system.ts` anlegen
6. Custom Tool `learning_export_session` implementieren
7. Stats-Hook fuer `read` auf `items/*.md` implementieren
8. Subagent `.opencode/agents/learning-extractor.md` anlegen
9. Command `.opencode/commands/learn.md` anlegen
10. Command `.opencode/commands/learnings-stats.md` anlegen
11. `.gitignore` fuer `exports/` anpassen
12. User nach `.stats.json`-Git-Policy fragen
13. Smoke-Tests durchlaufen

---

## 15. Smoke-Tests

## 15.1 Dateien vorhanden

```bash
test -f .opencode/commands/learn.md && \
test -f .opencode/commands/learnings-stats.md && \
test -f .opencode/agents/learning-extractor.md && \
test -f .opencode/plugins/learning-system.ts && \
test -f .opencode/learnings/INDEX.md && \
echo "ok"
```

## 15.2 Index ist deterministisch eingebunden

Manuelle oder textuelle Pruefung:

- `opencode.jsonc` enthaelt `.opencode/learnings/INDEX.md` unter `instructions`

## 15.3 Plugin laedt ohne offensichtlichen Syntaxfehler

Da lokale Plugins hier als TypeScript-Dateien geplant sind, sollte der Test auf die OpenCode-Laufzeit ausgerichtet sein:

- OpenCode starten
- pruefen, ob keine Plugin-Ladefehler erscheinen
- `/learn` ausfuehren und bestaetigen, dass `learning_export_session` verfuegbar ist

## 15.4 Command-Registrierung

Im TUI mit `/` pruefen:

- `/learn` sichtbar
- `/learnings-stats` sichtbar

## 15.5 Subagent-Registrierung

Im TUI mit `@` pruefen:

- `learning-extractor` sichtbar, falls nicht `hidden: true`

Falls `hidden: true` verwendet wird, stattdessen pruefen:

- `/learn` startet erfolgreich eine Child-Session mit dem Agenten

## 15.6 End-to-End ohne brauchbares Learning

Kurze unauffaellige Session fahren, dann `/learn`.

Erwartung:

- der Export wird erzeugt
- der Agent sagt sinngemaess, dass nichts Wertvolles gefunden wurde
- keine neue Datei unter `items/`

## 15.7 End-to-End mit brauchbarem Learning

Kurze Session mit bewusst eingebautem nicht offensichtlichem Problem fahren, dann `/learn`.

Erwartung:

- mindestens ein Kandidat
- `y` akzeptiert einen Kandidaten
- Datei unter `items/` wird geschrieben
- `INDEX.md` wird aktualisiert

## 15.8 Hit-Counter

Eine vorhandene Datei unter `items/` explizit mit `read` lesen lassen.

Erwartung:

- `.stats.json` enthaelt einen Eintrag fuer den Slug
- `hits` steigt um 1

---

## 16. Nicht-Ziele

Nicht Teil von V2 ohne neue User-Freigabe:

- automatisches Triggern von `/learn`
- globale Learnings ausserhalb des Projekts
- Vektorindex oder semantische Suche
- Dashboard oder Web-UI
- Tracking von `@file`-Referenzen als Stats-Basis
- Vollgarantie auf ungekuerzte historische Roh-Session-Rekonstruktion
- automatische Bereinigung ungenutzter Learnings

---

## 17. Abnahmekriterien

Das System gilt als funktionsfaehig, wenn:

1. alle geplanten Dateien existieren
2. `INDEX.md` ueber `opencode.jsonc` deterministisch eingebunden ist
3. `/learn` einen Subtask mit `learning-extractor` startet
4. `learning_export_session` eine lesbare Exportdatei erzeugt
5. der Agent Kandidaten einzeln reviewen laesst
6. akzeptierte Learnings unter `.opencode/learnings/items/` gespeichert werden
7. `INDEX.md` aus den Detaildateien neu erzeugt wird
8. spaetere Detail-Nachladungen bewusst ueber `read` passieren
9. der Stats-Hook diese `read`-Zugriffe auf `items/*.md` zaehlt
10. `/learnings-stats` die Daten lesbar zusammenfasst

---

## 18. Kurzbegruendung der V2-Architektur

Warum diese Version die richtige ist:

- sie ersetzt die unhaltbare `opencode export --format markdown`-Annahme durch einen SDK-basierten Export
- sie loest das Index-Autoload-Problem korrekt ueber `instructions`
- sie trennt sauber zwischen Autoload, Lazy-Load und Stats
- sie benutzt beobachtbare `read`-Aufrufe fuer Detail-Learnings
- sie haelt den Hauptkontext klein
- sie bleibt manuell, kontrolliert und projekt-spezifisch

Das ist eine belastbare, umsetzbare V2.
