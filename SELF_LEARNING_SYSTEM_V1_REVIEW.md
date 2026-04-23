# Review: Design Plan V1 Self-Learning System fuer OpenCode

## Kurzfazit

Der Plan ist grundsaetzlich machbar, aber nicht ganz in der Form, wie er aktuell beschrieben ist.

Die grobe Produktentscheidung ist gut:

- manuell gestartet
- manuell reviewed
- kleine, kuratierte Learnings statt Volltranskripte im Dauer-Kontext
- spaeter nur Index lesen, Details nur bei Bedarf

Das ist fuer eine V1 sinnvoll und realistisch.

Es gibt aber einige technische und konzeptionelle Fehler oder Luecken, von denen drei wirklich wichtig sind:

1. `learning_export_session` ist als normales Tool unter `.opencode/tools/` nicht robust geplant.
2. Ein Session-Export ist in OpenCode nicht automatisch eine vollstaendige Originalhistorie, weil Compaction und Pruning dazwischenfunken koennen.
3. Roh-Session-Exporte unter `.opencode/learnings/sessions/` brauchen zwingend eine Ignore-, Redaction- und Suchstrategie, sonst erzeugen sie Rauschen und potenziell sensible Ablagen.

Wenn diese Punkte korrigiert werden, ist die V1 sehr gut umsetzbar.

## Grundlage der Pruefung

Die Bewertung basiert nicht nur auf dem Plantext, sondern auf der tatsaechlichen OpenCode-Struktur in diesem Projekt und auf den OpenCode-Dokumentationen.

Geprueft wurde insbesondere:

- `opencode.jsonc` im Projektroot
- `.opencode/package.json`
- die installierten Typdefinitionen von `@opencode-ai/plugin`
- die installierten Typdefinitionen von `@opencode-ai/sdk`
- die OpenCode-Dokumentation zu Commands, Agents, Tools, Plugins, Server und SDK

Wichtige verifizierte Punkte:

- Projektlokale Commands unter `.opencode/commands/` sind offiziell unterstuetzt.
- Projektlokale Agents unter `.opencode/agents/` oder via `opencode.json` sind offiziell unterstuetzt.
- Projektlokale Custom Tools unter `.opencode/tools/` sind offiziell unterstuetzt.
- Plugins unter `.opencode/plugins/` koennen eigene Tools registrieren und erhalten zusaetzlich Zugriff auf `client` und `serverUrl`.
- Ein normales Custom Tool erhaelt nur Tool-Context wie `sessionID`, `messageID`, `agent`, `directory`, `worktree`, aber keinen OpenCode-Client.
- OpenCode hat eine eingebaute `question`-Funktion fuer User-Review und Selektionen.

## Wichtigste Findings

## 1. Kritischer Architekturfehler: `learning_export_session` ist als normales `.opencode/tools/`-Tool falsch zugeschnitten

So wie der Plan formuliert ist, soll `learning_export_session` aus der laufenden Session anhand der `sessionID` die Session exportieren.

Das Problem: ein normales Tool unter `.opencode/tools/` bekommt zwar die `sessionID`, aber keinen OpenCode-SDK-Client und keine garantierte Server-URL. Damit kann es die Session nicht sauber ueber die offizielle API auslesen, jedenfalls nicht auf robuste Weise.

Das ist der zentrale technische Bruch im Plan.

Warum das wichtig ist:

- Das Tool braucht fuer einen sauberen Export Zugriff auf `session.messages()` oder aehnliche Session-APIs.
- Der dafuer noetige `client` steht laut Plugin-API einem Plugin zur Verfuegung, nicht einem normalen Tool-Context.
- Die TUI nutzt laut Doku standardmaessig keinen fest verdrahteten Server-Port, sondern einen dynamischen Port. Ein Tool kann also nicht verlaesslich einfach `http://localhost:4096` annehmen.

Saubere Loesung fuer V1:

- `learning_export_session` nicht als plain Tool in `.opencode/tools/` bauen
- stattdessen ein Projekt-Plugin unter `.opencode/plugins/learning-tools.ts` anlegen
- dieses Plugin registriert die Tools `learning_export_session` und `learning_save`
- das Plugin schliesst ueber den vom Plugin-Context gelieferten `client` und `serverUrl`

Dann ist der Export robust und nutzt offizielle OpenCode-Schnittstellen.

Bewertung:

- Idee: machbar
- aktuelle Ausformulierung: technisch fehlerhaft bzw. unvollstaendig

## 2. Kritischer inhaltlicher Punkt: Ein Session-Export ist nicht automatisch die volle Originalhistorie

Der Plan formuliert implizit: `/learn` exportiert die aktuelle Session und analysiert dann die Session als Markdown.

Das klingt einfach, hat aber in OpenCode eine wichtige Einschraenkung:

- Sessions koennen kompaktifiziert werden
- Tool-Outputs koennen gepruned werden
- dadurch ist die spaeter exportierte Session nicht zwingend ein 1:1-Abbild aller urspruenglichen Zwischenschritte

Das ist kein Showstopper, aber es ist ein echter Produktpunkt, der im Plan aktuell fehlt.

Faktisch gibt es drei moegliche Bedeutungen von "Session exportieren":

1. Aktuellen effektiven Session-Zustand exportieren
2. Vollstaendige historische Message-/Part-Folge exportieren, soweit noch vorhanden
3. Vollstaendige Originalsession inklusive aller alten Tool-Outputs garantieren

Variante 3 ist in V1 ohne weitergehende Mechanik nicht belastbar zugesichert.

Empfehlung:

- Im V1-Plan explizit von "aktueller effektiver Session-Export" sprechen.
- Nicht versprechen, dass jede fruehe Rohinteraktion immer noch vollstaendig verfuegbar ist.
- Den Export so definieren, dass er das ausliest, was OpenCode zum Zeitpunkt von `/learn` noch als Sessioninhalt fuehrt.

Das macht die V1 ehrlich und vermeidet spaetere Enttaeuschungen.

## 3. Hoher Risikopunkt: Roh-Sessiondateien brauchen Ignore-, Such- und Sensitivity-Regeln

Der Plan speichert Session-Exporte unter:

```text
.opencode/learnings/sessions/
```

Das ist an sich sinnvoll, aber aktuell fehlt eine klare Policy fuer diese Dateien.

Risiken:

- Roh-Sessiondateien koennen sensible Inhalte enthalten.
- Tool-Outputs koennen Tokens, Header, Pfade, Logs oder andere ungeeignete Details enthalten.
- Volltexte der Session vergroessern den lokalen Suchraum fuer spaetere `grep`- oder `glob`-Operationen.
- Diese Dateien koennen versehentlich in Git landen, wenn nicht klar definiert wird, was versioniert werden soll.

In diesem Projekt ist `.opencode` aktuell explizit nicht ignoriert. Das macht das Risiko noch konkreter.

Empfehlung fuer V1:

- `sessions/` nicht committen
- `items/` und `index.md` optional committen, wenn gewuenscht
- Session-Exporte in `.gitignore` und idealerweise auch in Such-/Watcher-Regeln aus dem Standardpfad halten
- im Export bewusst filtern oder redigieren

Mindestens sollte der Export nicht unkontrolliert alles persistieren, was irgendwo in Tool-Outputs aufgetaucht ist.

## 4. Mittlerer Fehler: Das Indexformat ist zu menschlich, aber noch nicht maschinenstabil genug

Das Beispiel fuer `index.md` ist gut lesbar, aber fuer sichere Updates noch zu lose.

Probleme:

- kein expliziter Pfad zur Learning-Datei
- keine stabil definierte Struktur pro Eintrag
- unklar, wie `learning_save` bestehende Eintraege eindeutig findet und erweitert
- unklar, wie spaeter gezielt von Index zu Item navigiert wird, ohne fuzzy Matching auf Titel zu machen

Fuer Menschen reicht das Beispiel. Fuer ein Tool, das wiederholt und zuverlaessig aktualisieren soll, fehlt aber noch eine feste Struktur.

Bessere Minimalvariante:

```md
# Learnings Index

- id: L-001
  title: Check module boundaries before changing checkout logic
  path: items/l-001-check-module-boundaries.md
  triggers: checkout, architecture
  summary: Erst Modulgrenzen pruefen, dann Code aendern.
```

Oder noch einfacher und kompakter:

```md
- [L-001](items/l-001-check-module-boundaries.md) | triggers: checkout, architecture | summary: Erst Modulgrenzen pruefen, dann Code aendern.
```

Das bleibt klein, ist aber eindeutig.

## 5. Mittlere Luecke: Die ID-Strategie ist nicht definiert

`L-001`, `L-002` usw. sehen gut aus, aber der Plan sagt nicht, wie diese IDs sicher erzeugt werden.

Probleme in der Praxis:

- parallele Sessions
- Branches
- manuelle Edits
- geloeschte Learnings
- Merge-Konflikte

Fuer V1 wuerde ich keine globale fortlaufende Nummer als harte Wahrheit empfehlen, wenn sie nicht sauber synchronisiert wird.

Einfachere V1-Varianten:

- Dateiname auf Basis von Datum plus Slug
- ID als kurzer Timestamp-Slug
- oder `L-YYYYMMDD-HHMMSS-<shortslug>`

Wenn unbedingt `L-001` gewuenscht ist, dann muss `learning_save` die vorhandenen IDs scannen und den naechsten freien Wert vergeben. Das ist machbar, aber im Plan bisher nicht benannt.

## 6. Mittlere Luecke: Review-Mechanik ist produktseitig noch nicht konkret genug

Der Plan sagt zurecht, dass der User Kandidaten reviewen und selektiv bestaetigen soll.

Was noch fehlt:

- Wie genau bestaetigt der User?
- Wie wird "1 und 3 speichern" strukturiert an das System uebergeben?
- Wie werden Kandidaten identifiziert, wenn sich Titel aendern?

Fuer OpenCode ist das loesbar, weil es eine eingebaute `question`-Funktion gibt.

Empfohlene V1-Umsetzung:

- Der `learning-reviewer` erzeugt 2 bis 5 Kandidaten.
- Jeder Kandidat bekommt eine temporaere Candidate-ID wie `C1`, `C2`, `C3`.
- Der User bestaetigt ueber `question` selektiv die gewuenschten Kandidaten.
- Nur diese Kandidaten werden an `learning_save` uebergeben.

Ohne so eine minimale Formalisierung wird der Review-Schritt schnell fragil.

## 7. Mittlere Luecke: Exportformat braucht klare Filterregeln pro Part-Typ

OpenCode-Sessions bestehen nicht nur aus User- und Assistant-Text, sondern aus vielen Part-Typen, zum Beispiel:

- `text`
- `tool`
- `subtask`
- `agent`
- `reasoning`
- `snapshot`
- `patch`
- `step-start`
- `step-finish`
- `compaction`

Wenn der Plan einfach sagt "wichtige Tool-Aufrufe in lesbarer Form speichern", dann fehlt die entscheidende Definitionsarbeit.

Ohne Filter explodieren die Exportdateien schnell.

Sinnvolle V1-Filterung:

- `text`: ja
- `tool`: ja, aber nur Name, Input-Zusammenfassung, Status und gekuerzter relevanter Output
- `subtask`: ja, knapp
- `agent`: optional, knapp
- `reasoning`: nein
- `snapshot`: nein
- `patch`: nein
- `step-start` und `step-finish`: nein oder hoechstens stark verdichtet
- Attachments nur wenn fachlich relevant

Das sollte im Plan explizit stehen, sonst wird die Exportqualitaet stark schwanken.

## 8. Mittlere Luecke: Retrieval in spaeteren Sessions ist nur heuristisch, nicht hart garantiert

Die Retrieval-Idee fuer V1 ist gut:

1. nur `index.md` lesen
2. Details nur bei passenden Triggern laden
3. niemals alles pauschal laden

Das Problem ist nicht die Idee, sondern der Garantiegrad.

Mit einer AGENTS-Regel kann man das Verhalten stark anleiten, aber nicht mathematisch erzwingen. Trigger-Matching bleibt modellgetrieben und damit heuristisch.

Das ist fuer V1 okay, solange es so formuliert wird:

- best effort
- durch Regeln stark priorisiert
- nicht als harte deterministische Engine verkauft

Ich wuerde das Akzeptanzkriterium daher sprachlich absichern. Sonst klingt es praeziser, als es faktisch ist.

## 9. Mittlere Luecke: Source Traceability ist noch etwas zu duenn

Im Beispiel hat jedes Learning:

- `sourceSession`

Das ist schon gut, aber fuer Auditierbarkeit wuerde ich minimal mehr mitgeben.

Empfehlenswerte kleine Erweiterungen:

- `sourceSession: <session-id>`
- `sourcePath: sessions/<date>_<session-id>.md`
- optional ein sehr kurzer `sourceExcerpt` oder Candidate-Reason

Das hilft spaeter bei Rueckverfolgung, ohne die Dateien aufzublaehen.

## 10. Kleinere Unklarheit: `subtask: true` ist vermutlich redundant

Der Command verweist auf einen Subagent `learning-reviewer`.

Laut OpenCode-Doku wird ein Command, der auf einen Subagent zeigt, standardmaessig bereits als Subagent-Invocation ausgefuehrt. `subtask: true` ist deshalb wahrscheinlich redundant.

Das ist kein Fehler, nur ein ueberfluessiger Schalter.

Ich wuerde fuer V1 sagen:

- `agent: learning-reviewer` reicht meist
- `subtask: true` kann drinbleiben, wenn ihr das Verhalten explizit absichern wollt

## 11. Kleinere Unklarheit: Die AGENTS-Regel sollte auf Existenz pruefen und Sessions explizit ausnehmen

Die vorgeschlagene Regel ist sinnvoll, aber etwas zu grob.

Bessere Form fuer V1:

```md
When starting work, check `.opencode/learnings/index.md` if it exists.
Only read a detailed learning file when the current task clearly matches one of the listed triggers.
Do not read all learning files by default.
Do not read `.opencode/learnings/sessions/` unless the user explicitly asks for raw session history.
```

Der letzte Satz ist wichtig, damit der Agent nicht spaeter versehentlich in Session-Archiven statt in kuratierten Learnings sucht.

## Komponentenbewertung

## `/learn` als projektlokaler Slash-Command

Bewertung: machbar

Das ist direkt von OpenCode unterstuetzt. `.opencode/commands/learn.md` ist eine passende und saubere Wahl.

## `learning-reviewer` als versteckter Subagent

Bewertung: machbar

Auch das ist von OpenCode direkt unterstuetzt. `hidden: true` bei `mode: subagent` passt zur Anforderung.

Empfehlung:

- entweder in `opencode.json`
- oder als `.opencode/agents/learning-reviewer.md`

Die Markdown-Agent-Datei ist oft angenehmer, weil Prompt und Metadaten beieinander liegen.

## Tool `learning_export_session`

Bewertung: machbar, aber nicht in der aktuell beschriebenen Form

Die Funktion selbst ist umsetzbar. Der geplante technische Ort ist aber der falsche oder zumindest der riskante.

Empfohlene Umsetzung:

- Plugin-definiertes Tool statt plain `.opencode/tools/learning_export_session.ts`

## Tool `learning_save`

Bewertung: machbar

Das Speichern von Markdown-Dateien und das Aktualisieren eines Index ist unkompliziert. Dieses Tool kann theoretisch auch als normales Custom Tool funktionieren.

Pragmatisch wuerde ich trotzdem beide Tools in einem Plugin registrieren, damit die Learning-Funktionalitaet an einer Stelle lebt.

## Ordnerstruktur unter `.opencode/learnings/`

Bewertung: machbar und sinnvoll

Die Struktur ist gut. Ich wuerde nur ergaenzen, dass `sessions/` nicht als normaler Such- und Commit-Bereich behandelt werden sollte.

## Kompakter Index

Bewertung: machbar und sehr sinnvoll

Das ist einer der staerksten Teile des Plans.

## Nur bei Bedarf Detaildateien laden

Bewertung: sinnvoll, aber nur heuristisch absicherbar

Fuer V1 absolut okay. Sollte aber als modellgesteuerte Regel und nicht als harte technische Garantie verstanden werden.

## Empfohlene korrigierte V1-Architektur

Die kleinste saubere Architektur waere aus meiner Sicht diese:

```text
User
  -> /learn
  -> learning-reviewer (subagent)
  -> plugin-backed tool: learning_export_session
  -> exported markdown in .opencode/learnings/sessions/
  -> learning-reviewer proposes candidates C1..Cn
  -> user approves via question tool
  -> plugin-backed tool: learning_save
  -> save approved items to .opencode/learnings/items/
  -> update .opencode/learnings/index.md
```

Wichtige Unterschiede zum Originalplan:

- Export- und Save-Logik lieber als Plugin-registrierte Tools
- Session-Export als effektiver aktueller Session-Export definieren
- `sessions/` als rohes Archiv behandeln, nicht als allgemeinen Retrieval-Bereich
- Review ueber klare Candidate-IDs und `question`

## Empfohlene angepasste Dateistruktur

Ich wuerde fuer V1 diese Struktur empfehlen:

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

Wenn ihr `learning-reviewer` lieber in `opencode.json` definiert, ist das auch okay. Die Kernkorrektur ist hier vor allem der Wechsel von `.opencode/tools/` zu `.opencode/plugins/` fuer den Export.

## Empfohlene Anpassung des Learning-Formats

Das Learning-Format ist grundsaetzlich gut. Ich wuerde es nur minimal absichern:

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
...

## Beobachtung
...

## Empfehlung
...

## Wann anwenden
...
```

Das bleibt klein, ist aber besser rueckverfolgbar.

## Empfohlene Anpassung des Index-Formats

Kleine, aber klare V1-Variante:

```md
# Learnings Index

- [L-20260423-153210](items/l-20260423-153210-check-module-boundaries.md) | triggers: checkout, architecture | summary: Erst Modulgrenzen pruefen, dann Code aendern.
- [L-20260423-160401](items/l-20260423-160401-enable-corepack-before-pnpm.md) | triggers: pnpm, setup | summary: Ohne corepack entstehen vermeidbare Setup-Fehler.
```

Das ist kompakt, menschenlesbar und maschinenstabil genug fuer V1.

## Akzeptanzkriterien: Was ich anpassen wuerde

Die bestehenden Kriterien sind fast richtig. Ich wuerde sie so schaerfen:

- `/learn` ist in einer bestehenden Session aufrufbar.
- Der aktuelle effektive Session-Zustand wird als Markdown gespeichert.
- Der Export filtert irrelevante Part-Typen und speichert keine unkontrollierten Voll-Outputs.
- Der Subagent erzeugt typischerweise 2 bis 5 brauchbare Kandidaten.
- Der User kann Kandidaten selektiv bestaetigen.
- Nur bestaetigte Kandidaten werden unter `.opencode/learnings/items/` gespeichert.
- `index.md` wird mit stabilen Links oder Pfaden aktualisiert.
- Spaetere Sessions lesen standardmaessig nur den Index und laden Detaildateien nur best effort bei passenden Triggern.

So sind die Kriterien naeher an der realen Plattform.

## Gesamturteil

Das Produktkonzept fuer V1 ist gut.

Es ist:

- klein genug fuer eine erste Version
- nachvollziehbar fuer User
- nuetzlich ohne uebermaessige Automatisierung
- gut passend zu den OpenCode-Faehigkeiten

Aber:

- der Export-Mechanismus ist aktuell technisch falsch oder mindestens zu optimistisch spezifiziert
- die Auswirkungen von Compaction/Pruning fehlen im Plan
- die Behandlung roher Session-Archive ist noch nicht sicher genug beschrieben

Meine Bewertung lautet deshalb:

- V1 ist machbar
- aber nicht 1:1 wie aktuell beschrieben
- mit 3 bis 5 gezielten Plan-Korrekturen wird daraus eine sehr solide und realistische erste Version

## Konkrete Empfehlung in einem Satz

Behalte den manuellen, kleinen V1-Ansatz unbedingt bei, verschiebe aber `learning_export_session` und idealerweise auch `learning_save` in ein Plugin, definiere Session-Export bewusst als effektiven aktuellen Export statt als garantierte Vollhistorie und fuehre eine strikte Policy fuer `sessions/` ein.
