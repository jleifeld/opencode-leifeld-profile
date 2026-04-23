# Design Plan V1 Improved: Self-Learning System fuer OpenCode

## Ziel

Wir bauen eine erste, kleine und belastbare Version eines Self-Learning-Systems fuer OpenCode.

Der Fokus in V1 bleibt bewusst eng:

- `/learn` startet den Lernprozess manuell am Ende einer Session
- die aktuelle Session wird als effektiver aktueller Session-Export gespeichert
- ein dedizierter Subagent analysiert den Export auf wiederverwendbare Learnings
- der User reviewt und bestaetigt Kandidaten selektiv
- nur bestaetigte Learnings werden als einzelne Dateien gespeichert
- spaetere Sessions lesen standardmaessig nur einen kleinen Index
- Detaildateien werden nur best effort bei passenden Triggern geladen

V1 soll nuetzlich, nachvollziehbar und wenig invasiv sein.

## Leitprinzipien

1. Manuell statt automatisch

Der Lernprozess startet nur durch `/learn` und speichert nie ungefragt Learnings.

2. Kuratierte Learnings statt Rohkontext

Wir speichern nicht die ganze Session als Dauer-Kontext, sondern kleine projektbezogene Learnings.

3. Kleiner Default-Kontext

Neue Sessions lesen nur den Index. Detaildateien werden nur bei klar passendem Trigger geladen.

4. Ehrliche Semantik beim Session-Export

V1 exportiert den aktuellen effektiven Session-Zustand. V1 garantiert keine vollstaendige Originalhistorie aller fruehen Zwischenschritte, weil OpenCode Sessions kompaktifizieren und Tool-Outputs prunen kann.

5. Plugins nur fuer SDK-Zugriff, nicht fuer Hintergrundautomatisierung

V1 nutzt ein Projekt-Plugin nur, um SDK-backed Tools bereitzustellen. Es gibt keine automatische Hintergrundverarbeitung ueber Plugin-Events.

## Scope von V1

### Enthalten

1. Ein projektlokaler Slash-Command `/learn`
2. Ein versteckter Subagent `learning-reviewer`
3. Ein Plugin `learning-tools.ts`, das zwei Tools registriert:
   - `learning_export_session`
   - `learning_save`
4. Eine Ordnerstruktur unter `.opencode/learnings/`
5. Ein kompakter, stabiler Index
6. Ein manueller Review-Schritt ueber User-Bestaetigung
7. Eine kleine Retrieval-Regel in `AGENTS.md`

### Nicht enthalten

1. automatische Learnings ohne User-Review
2. automatische Ausloesung ueber `session.idle`, `command.executed` oder andere Plugin-Events
3. semantische Suche oder Vektorindex
4. automatische Umwandlung in Skills
5. komplexes Scoring, Ranking oder Quality-Gating
6. aggressives Autoloading aller Learnings in jede Session
7. Garantie auf vollstaendige historische Roh-Session-Rekonstruktion

## Kernidee

Ein Learning in V1 ist eine kurze, projektbezogene Notiz mit:

- Problem
- Beobachtung oder Ursache
- Empfehlung
- Triggern, wann das Learning relevant ist
- Referenz auf die Quell-Session

Die Session selbst wird nur als internes Arbeitsartefakt exportiert. Dauerhaft wiederverwendet werden nur die bestaetigten Learning-Dateien plus der kompakte Index.

## Korrigierte Architektur

```text
User
  -> /learn
  -> learning-reviewer (subagent)
  -> plugin-backed tool: learning_export_session
  -> export to .opencode/learnings/sessions/
  -> analyze export and propose candidates C1..Cn
  -> user approves selected candidates
  -> plugin-backed tool: learning_save
  -> save approved learnings to .opencode/learnings/items/
  -> update .opencode/learnings/index.md
```

## Warum Plugin-basierte Tools

Die Export-Logik wird bewusst nicht als normales Tool unter `.opencode/tools/` umgesetzt.

Grund:

- ein normales Tool bekommt zwar `sessionID`, aber keinen OpenCode-SDK-Client
- fuer einen robusten Session-Export brauchen wir Zugriff auf die offiziellen Session-APIs
- ein Projekt-Plugin unter `.opencode/plugins/` bekommt `client` und `serverUrl`

Deshalb registriert V1 die Learning-Tools ueber ein Projekt-Plugin.

## Dateistruktur

```text
.opencode/
  commands/
    learn.md
  agents/
    learning-reviewer.md
  plugins/
    learning-tools.ts
  learnings/
    index.md
    sessions/
      2026-04-23_<session-id>.md
    items/
      l-20260423-153210-check-module-boundaries.md
AGENTS.md
opencode.json
```

## Session-Archiv-Policy

Die Dateien unter `.opencode/learnings/sessions/` sind rohe interne Arbeitsartefakte.

Regeln fuer V1:

1. `sessions/` wird nicht standardmaessig fuer spaetere Retrievals gelesen.
2. `sessions/` wird nicht als normaler Commit-Bereich behandelt.
3. Session-Exporte sollen nicht unkontrolliert komplette Tool-Outputs speichern.
4. Potenziell sensible Inhalte werden nach einfachen Regeln gekuerzt oder redigiert.

Empfehlung fuer Git:

```gitignore
.opencode/learnings/sessions/
```

`index.md` und `items/` koennen projektentscheidungsabhaengig versioniert werden. `sessions/` sollte es nicht.

## User Flow in V1

### 1. Session beenden

Der User fuehrt `/learn` aus.

### 2. Session exportieren

`learning_export_session` liest ueber den Plugin-SDK-Client den aktuellen effektiven Inhalt der laufenden Session anhand der aktuellen `sessionID` und speichert ihn als Markdown unter:

```text
.opencode/learnings/sessions/
```

### 3. Analyse

`learning-reviewer` liest die exportierte Datei und erzeugt 2 bis 5 Learning-Kandidaten.

Nur wiederverwendbare projektbezogene Erkenntnisse werden vorgeschlagen.

### 4. Review

Jeder Kandidat erhaelt eine temporaere Candidate-ID wie `C1`, `C2`, `C3`.

Der User bestaetigt ueber den eingebauten `question`-Mechanismus, welche Kandidaten gespeichert werden sollen.

### 5. Speichern

Fuer jeden bestaetigten Kandidaten wird `learning_save` aufgerufen.

Das Tool:

- erzeugt eine stabile Learning-ID
- schreibt die Learning-Datei unter `.opencode/learnings/items/`
- aktualisiert `index.md`

### 6. Spaetere Sessions

OpenCode liest standardmaessig nur `.opencode/learnings/index.md`, falls die Datei existiert.

Erst wenn ein Task klar zu einem Trigger passt, wird die passende Learning-Datei geladen.

Dieses Verhalten ist in V1 best effort und modellgesteuert, nicht hart deterministisch.

## Komponenten

## 1. Command `/learn`

Der Command ist der Einstiegspunkt fuer den Lernprozess.

Beispiel:

```md
---
description: Review the current session and propose reusable learnings
agent: learning-reviewer
subtask: true
---

Analyze the current session and propose a short list of reusable project learnings.

Rules:
- Export the current session first using `learning_export_session`.
- Treat the export as the current effective session state, not as a guaranteed full historical transcript.
- Only suggest reusable project learnings.
- Ignore one-off noise and generic advice.
- Present candidates with candidate IDs for review.
- Use the question tool for approval.
- Do not save anything without user approval.
```

Hinweis:

- `subtask: true` ist fuer V1 bewusst gesetzt, um die Kontextrisiken klein zu halten.
- Auch wenn ein Subagent-Command oft ohnehin als Subtask laeuft, macht diese Flag die Absicht explizit.

## 2. Subagent `learning-reviewer`

Der Subagent ist ausschliesslich fuer den Lernprozess zustaendig.

Ziele:

- Export lesen
- wiederverwendbare Muster erkennen
- Kandidaten kompakt formulieren
- Kandidaten zur User-Review praesentieren
- nur bestaetigte Kandidaten speichern lassen

Beispiel als projektlokaler Agent:

```md
---
description: Reviews a session export and proposes reusable project learnings
mode: subagent
hidden: true
temperature: 0.1
---

You analyze a session export and extract only reusable, project-specific learnings.

Rules:
- Prefer 2 to 5 strong candidates over many weak ones.
- Ignore generic engineering advice.
- Ignore one-off typos, dead ends, and session-local noise.
- Prefer learnings that explain repeated friction, failed attempts, hidden project rules, or reliable workarounds.
- Assign temporary candidate IDs like C1, C2, C3.
- Ask the user which candidates to keep before calling `learning_save`.
- Never save candidates without explicit approval.
```

## 3. Plugin `learning-tools.ts`

Das Projekt-Plugin registriert die zwei Learning-Tools.

Es wird nur fuer diese Aufgaben verwendet:

- Zugriff auf den OpenCode-SDK-Client
- robuster Session-Export
- Datei- und Index-Schreiblogik

Es fuehrt keine automatische Hintergrundverarbeitung aus.

Pseudostruktur:

```ts
export const LearningToolsPlugin = async ({ client, serverUrl }) => {
  return {
    tool: {
      learning_export_session: ...,
      learning_save: ...,
    },
  }
}
```

## 4. Tool `learning_export_session`

Dieses Tool exportiert die laufende Session als Markdown.

### Eingabe

- keine userseitigen Pflichtargumente
- `sessionID` kommt aus dem Tool-Context

### Interne Quelle

- OpenCode Session-API ueber den Plugin-Client

### Ausgabe

- Pfad zur erzeugten Exportdatei
- optional kurze Metadaten wie Anzahl Messages oder Kandidatenbasis

### Ziel-Datei

```text
.opencode/learnings/sessions/<date>_<session-id>.md
```

### Semantik

Das Tool exportiert den aktuellen effektiven Session-Zustand.

Es exportiert nicht mit Produktgarantie jede historische Rohphase, die eventuell schon kompaktifiziert oder gepruned wurde.

### Exportstruktur

```md
# Session Export

- Session ID: ...
- Exported At: ...
- Export Type: current-effective-session-state

## Messages

### User
...

### Assistant
...

### Tool Call
...
```

### Filterregeln fuer V1

Diese Part-Typen werden sinnvoll behandelt:

- `text`: aufnehmen
- `tool`: aufnehmen, aber nur kompakt
- `subtask`: aufnehmen, knapp
- `agent`: optional, knapp

Diese Part-Typen werden nicht voll exportiert:

- `reasoning`
- `snapshot`
- `patch`
- `step-start`
- `step-finish`
- `compaction`

### Tool-Output-Regeln

Tool-Outputs werden nicht ungekuezt gespeichert.

V1-Regeln:

- nur relevante Kurzfassung oder gekuerzter Auszug
- Status, Tool-Name und kurzer Zweck bleiben erhalten
- offensichtliche Geheimnisse oder Header werden redigiert
- sehr lange Outputs werden abgeschnitten und als gekuerzt markiert

Beispiele fuer Redaction in V1:

- `Authorization: ...` -> `Authorization: [redacted]`
- offensichtliche Token-Strings -> `[redacted]`
- ueberlange Logs -> `[output truncated]`

## 5. Tool `learning_save`

Dieses Tool speichert bestaetigte Learnings als einzelne Markdown-Dateien und aktualisiert den Index.

### Eingabe

- `title`
- `summary`
- `triggers`
- `content`
- `sourceSession`
- `sourcePath`

### Ausgabe

- Pfad zur erzeugten Learning-Datei
- erzeugte Learning-ID
- aktualisierter Index-Eintrag

### ID-Strategie

V1 verwendet keine globale fragile Zaehlnummer wie `L-001` als Primarmechanik.

Stattdessen nutzen wir eine timestamp-basierte ID:

```text
L-YYYYMMDD-HHMMSS
```

Falls innerhalb derselben Sekunde mehrere Learnings entstehen, kann ein kurzer Slug angehaengt werden.

Beispiel:

```text
L-20260423-153210
L-20260423-153210-checkout
```

### Dateiname

```text
.opencode/learnings/items/l-20260423-153210-check-module-boundaries.md
```

## Analyse-Logik in V1

V1 nutzt einfache, erklaerbare Signale statt komplexer Heuristiken.

### Gute Signale

- mehrere fehlgeschlagene Kommandos vor der Loesung
- mehrere alternative Loesungsversuche
- wiederholte Suche in der falschen Stelle
- spaet entdeckte projektspezifische Regel
- final gefundener Workaround, der wiederverwendbar ist
- API-, Setup- oder Architektur-Fallen, die spaeter erneut auftreten koennen

### Schlechte Signale

- einmalige Tippfehler
- reine Session-Rauscheintraege
- generische Erkenntnisse ohne Projektbezug
- Dinge, die nur fuer genau diese Session gueltig waren

### Regel

Gespeichert wird nur, was in spaeteren Sessions wahrscheinlich wieder nuetzlich ist.

## Review-UX in V1

Die Review-Ausgabe bleibt kurz.

Beispiel:

```text
I found 3 candidate learnings:

C1. Enable corepack before pnpm setup
Reason: multiple setup failures before resolution

C2. Check checkout module boundaries first
Reason: repeated exploration in the wrong area

C3. API X requires header Y
Reason: misleading auth errors until header was added
```

Danach fragt der Agent per `question`, welche Kandidaten gespeichert werden sollen.

Beispiel:

- `C1`
- `C2`
- `C3`

Optional kann der User auch keinen Kandidaten bestaetigen.

## Format eines Learning-Files

Jedes bestaetigte Learning wird als einzelne Markdown-Datei gespeichert.

Beispiel:

```md
---
id: L-20260423-153210
title: Check module boundaries before changing checkout logic
summary: Aenderungen im Checkout zuerst auf bestehende Modulgrenzen pruefen, um falsche Ansatzpunkte zu vermeiden.
triggers:
  - checkout
  - module boundaries
  - architecture
sourceSession: <session-id>
sourcePath: sessions/2026-04-23_<session-id>.md
createdAt: 2026-04-23
---

## Problem
Das Modell hat mehrfach an der falschen Stelle gesucht.

## Beobachtung
Die relevante Logik lag nicht im zuerst vermuteten Modul.

## Empfehlung
Vor Aenderungen zuerst die Modulgrenzen und den Einstiegspunkt pruefen.

## Wann anwenden
Bei Aenderungen im Checkout oder wenn die Zustaendigkeit eines Moduls unklar ist.
```

## Format des Index

Der Index bleibt absichtlich klein, aber stabil genug fuer Updates.

Beispiel:

```md
# Learnings Index

- [L-20260423-153210](items/l-20260423-153210-check-module-boundaries.md) | triggers: checkout, architecture | summary: Erst Modulgrenzen pruefen, dann Code aendern.
- [L-20260423-160401](items/l-20260423-160401-enable-corepack-before-pnpm.md) | triggers: pnpm, setup | summary: Ohne corepack entstehen vermeidbare Setup-Fehler.
```

Eigenschaften dieses Formats:

- kompakt fuer den Default-Kontext
- stabiler Pfad auf die Detaildatei
- Trigger direkt sichtbar
- Summary direkt sichtbar

## Verhalten in spaeteren Sessions

In V1 gilt diese Retrieval-Regel:

1. Nur `index.md` lesen, wenn die Datei existiert.
2. Detaildateien nur bei klar passendem Trigger lesen.
3. Niemals alle Learning-Dateien pauschal laden.
4. Niemals `sessions/` als Standard-Retrievalquelle verwenden.

Wichtig:

Dieses Verhalten ist best effort. Es ist modellgesteuert und nicht als harte deterministische Matching-Engine zu verstehen.

## Beispielregel fuer `AGENTS.md`

```md
When starting work, check `.opencode/learnings/index.md` if it exists.
Only read a detailed learning file when the current task clearly matches one of the listed triggers.
Do not read all learning files by default.
Do not read `.opencode/learnings/sessions/` unless the user explicitly asks for raw session history.
```

## Implementierungsplan V1

### Schritt 1

Projektlokalen Command `/learn` anlegen.

### Schritt 2

Subagent `learning-reviewer` anlegen und verstecken.

### Schritt 3

Projekt-Plugin `.opencode/plugins/learning-tools.ts` anlegen.

### Schritt 4

Tool `learning_export_session` auf Basis des Plugin-SDK-Clients bauen.

### Schritt 5

Exportfilter, Redaction und Truncation fuer Session-Exporte umsetzen.

### Schritt 6

Tool `learning_save` bauen.

### Schritt 7

Ordnerstruktur und initiale `index.md` anlegen.

### Schritt 8

`AGENTS.md` um die Retrieval-Regel ergaenzen.

### Schritt 9

`sessions/` in Git und gegebenenfalls in Watcher-/Suchregeln passend behandeln.

### Schritt 10

Mit 3 bis 5 echten Sessions testen und die Kandidatenqualitaet manuell pruefen.

## Akzeptanzkriterien fuer V1

V1 ist erfolgreich, wenn:

- `/learn` in einer bestehenden Session aufrufbar ist
- der aktuelle effektive Session-Zustand als Markdown gespeichert wird
- der Export irrelevante Part-Typen nicht ungefiltert aufblaeht
- offensichtliche sensible Inhalte nicht roh in den Export durchgereicht werden
- der Subagent typischerweise 2 bis 5 brauchbare Kandidaten erzeugen kann
- der User Kandidaten selektiv bestaetigen kann
- nur bestaetigte Learnings als Einzeldateien unter `.opencode/learnings/items/` gespeichert werden
- jede Learning-Datei eine stabile ID, Trigger, Summary und Session-Referenz enthaelt
- `index.md` mit stabilen Links oder Pfaden aktualisiert wird
- spaetere Sessions standardmaessig nur den Index lesen und Detaildateien nur best effort bei passenden Triggern laden
- `sessions/` nicht als allgemeiner Retrieval-Bereich genutzt wird

## Klare Produktentscheidung fuer V1

V1 bleibt absichtlich:

- manuell gestartet
- manuell bestaetigt
- klein im Kontext-Footprint
- konservativ beim Speichern
- ohne Hintergrundautomatisierung

Das ist die richtige erste Version, weil sie:

- einfach implementierbar ist
- die realen OpenCode-Schnittstellen sauber nutzt
- wenig Risiko fuer schlechte Learnings hat
- nachvollziehbar fuer User bleibt
- schon in V1 echten Nutzen liefern kann
