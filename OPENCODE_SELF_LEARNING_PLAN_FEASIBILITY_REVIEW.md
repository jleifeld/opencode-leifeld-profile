# Feasibility Review: OpenCode Self-Learning System Plan

## Kurzfazit

Der Plan ist in der Grundidee gut und zu grossen Teilen mit OpenCode machbar, aber **nicht in der aktuell beschriebenen Form** direkt implementierbar.

Es gibt vier zentrale Probleme, die vor einer Umsetzung korrigiert werden sollten:

1. Der geplante Session-Export ueber `!\`opencode export --format markdown\`` funktioniert lokal so nicht.
2. `AGENTS.md` kann `@.opencode/learnings/INDEX.md` **nicht** automatisch beim Session-Start einbinden.
3. Der Hit-Counter zaehlt mit `tool.execute.after` auf `read` **nicht** die geplanten `@`-Lazy-Loads.
4. Die Aussage in Abschnitt 12.3 zur fehlenden pfadgenauen `edit`-Permission ist falsch; OpenCode kann das bereits nativ.

Wenn diese Punkte korrigiert werden, ist das System weiterhin gut umsetzbar.

## Gepruefte Grundlage

Die Bewertung basiert auf:

- lokaler Projektstruktur in diesem Repo
- lokal installiertem OpenCode (`opencode --version` -> `1.14.21`)
- `opencode export --help`
- `opencode agent --help`
- `opencode agent list`
- `opencode plugin --help`
- `opencode.jsonc`
- `.opencode/package.json`
- Typdefinitionen aus `@opencode-ai/plugin` und `@opencode-ai/sdk`
- offizieller OpenCode-Doku zu Commands, Agents, Rules, Permissions, Plugins und TUI

## Was am Plan bereits stimmt

Diese Teile sind tragfaehig und offiziell von OpenCode unterstuetzt:

- Projekt-scoped Commands unter `.opencode/commands/`
- Projekt-scoped Agents unter `.opencode/agents/`
- Projekt-scoped Plugins unter `.opencode/plugins/`
- `subtask: true` fuer Child-Session-Ausfuehrung
- lokale Plugin-Dateien werden automatisch geladen
- Command-Templates duerfen `!` fuer Shell-Output und `@` fuer Datei-Includes verwenden
- Plugin-Hooks wie `tool.execute.before` und `tool.execute.after` existieren
- `.opencode/package.json` ist der richtige Ort fuer lokale Plugin-Abhaengigkeiten

Die Grundarchitektur mit:

- manuellem `/learn`
- isoliertem Subagent
- Review pro Kandidat
- kleinem Index statt Volltext im Dauer-Kontext

ist fuer eine V1 sinnvoll.

## Kritische Findings

## 1. Kritischer Blocker: Der geplante Session-Export funktioniert so nicht

Betroffene Planstellen:

- Abschnitt 2
- Abschnitt 6
- Abschnitt 7
- Abschnitt 12.1
- Abschnitt 13 Test 6
- Abschnitt 15

### Problem

Der Plan setzt als Kernmechanik voraus, dass der Command `/learn` den aktuellen Session-Transcript ueber

```md
!`opencode export --format markdown`
```

in den Prompt einbetten kann.

Das ist in der lokal verifizierten OpenCode-Version nicht korrekt:

- `opencode export --help` sagt: `export session data as JSON`
- Ein `--format markdown`-Flag existiert lokal nicht.
- `opencode export` ohne Session-ID oeffnet interaktiv einen Session-Picker.
- Ein interaktiver Picker haengt in einem Command-Template als Shell-Include praktisch fest.

Zusaetzlich habe ich in der aktuellen Umgebung keine `OPENCODE_SESSION_ID`-Variable gefunden. Vorhanden sind nur:

- `OPENCODE_RUN_ID`
- `OPENCODE`
- `OPENCODE_PROCESS_ROLE`
- `OPENCODE_PID`
- `OPENCODE_TUI_CONFIG`
- `OPENCODE_CONFIG`
- `OPENCODE_CONFIG_DIR`

### Auswirkung

Der wichtigste Datenpfad des gesamten Systems ist damit in der beschriebenen Form nicht belastbar.

Das System kann zwar spaeter Learnings speichern und indizieren, aber der Startpunkt `/learn` hat aktuell keinen verifizierten, nicht-interaktiven Zugriff auf den aktuellen Session-Inhalt.

### Empfehlung

Der Plan sollte diesen Teil neu formulieren. Realistische Optionen sind:

1. Ein Plugin- oder Tool-basierter Export, der ueber die OpenCode-SDK-/Session-APIs den aktuellen Session-Inhalt abruft.
2. Ein explizit manueller Export-Schritt ausserhalb des Commands.
3. Ein Plugin, das Session-Inhalt kontrolliert in eine temporaere Datei schreibt, die `/learn` dann liest.

Wichtig ist: Der aktuelle Plan darf **nicht** behaupten, dass `!\`opencode export --format markdown\`` die laufende Session direkt liefert.

## 2. Kritischer Blocker: `AGENTS.md` kann den Index nicht automatisch per `@` laden

Betroffene Planstellen:

- Abschnitt 1 Ziel 4
- Abschnitt 2 Session N+1 Flow
- Abschnitt 8
- Abschnitt 9
- Abschnitt 15 Kriterium 6

### Problem

Der Plan sagt, dass `AGENTS.md` den Block mit

```md
@.opencode/learnings/INDEX.md
```

enthaelt und der Index dadurch bei jedem Session-Start automatisch gelesen wird.

Laut offizieller OpenCode-Rules-Doku ist genau das **nicht** der Fall:

- OpenCode parst File-References in `AGENTS.md` nicht automatisch.
- In `AGENTS.md` kann man nur Regeln hinterlegen, die dem Modell sagen, dass es spaeter den `Read`-Tool-Call ausfuehren soll.
- Fuer echtes automatisches Einbinden externer Dateien ist `opencode.json`/`opencode.jsonc` `instructions` der empfohlene Weg.

### Auswirkung

Der beschriebene Mechanismus "Index wird beim Session-Start automatisch geladen" ist mit der vorgeschlagenen `AGENTS.md`-Aenderung alleine nicht erfuellt.

Das betrifft einen Kernnutzen des Systems.

### Empfehlung

Wenn der Index wirklich deterministisch immer geladen werden soll, dann ist die robuste Loesung:

- `.opencode/learnings/INDEX.md` in `opencode.jsonc` unter `instructions` aufnehmen

Die `AGENTS.md`-Ergaenzung kann trotzdem sinnvoll bleiben, aber nur fuer das Verhalten:

- Index beachten
- volle Learning-Dateien nur bei Match nachladen

Nicht fuer das eigentliche automatische Include.

## 3. Kritischer Blocker: Der Hit-Counter misst nicht die geplanten `@`-Lazy-Loads

Betroffene Planstellen:

- Abschnitt 1 Ziel 5 und 6
- Abschnitt 2 Flow fuer Session N+1
- Abschnitt 10
- Abschnitt 13 Test 7
- Abschnitt 15 Kriterium 7

### Problem

Der Plan koppelt zwei Aussagen, die zusammen nicht stimmen:

1. volle Learnings werden lazy via `@.opencode/learnings/<slug>.md` geladen
2. das Plugin zaehlt diese Nutzung ueber `tool.execute.after` auf `read`

Das Problem ist: `@file`-Referenzen sind in OpenCode keine normalen `read`-Tool-Calls. Sie werden als File-Parts in die Konversation eingebracht.

Die lokal geprueften SDK-Typen bestaetigen:

- Es gibt eigene `FilePart`- und `FilePartInput`-Typen.
- `tool.execute.after` liefert Tool-Aufrufe, nicht automatisch Message-File-Attachments.

### Auswirkung

Die geplante Statistik ist in der aktuellen Form irrefuehrend:

- sie zaehlt explizite `Read`-Tool-Nutzung
- aber **nicht** verlässlich die `@`-basierte Lazy-Load-Nutzung, die der Plan als Hauptpfad beschreibt

Damit sind auch diese Punkte im Plan falsch oder mindestens unbewiesen:

- Test 7
- Abnahmekriterium 7

### Empfehlung

Der Plan muss sich fuer **eine** saubere Semantik entscheiden:

1. **Stats zaehlen `Read`-Tool-Nutzung**
   Dann darf der Plan nicht behaupten, dass `@`-Loads gezaehlt werden. Das Lazy-Loading sollte dann bewusst ueber `Read` erfolgen.

2. **Stats zaehlen `@`-Dateireferenzen**
   Dann muss das Plugin auf Message-/File-Part-Ebene arbeiten, nicht auf `tool.execute.after` fuer `read`.

Beides gleichzeitig ist mit der aktuellen Spezifikation nicht sauber beschrieben.

## 4. Hoher Fehler: Abschnitt 12.3 zur `edit`-Permission ist sachlich falsch

Betroffene Planstellen:

- Abschnitt 6
- Abschnitt 12.3

### Problem

Der Plan behauptet, `edit`/`write` koenne nur global als `allow | deny | ask` gesetzt werden und pfadgenaue Regeln gaebe es nicht.

Das ist laut offizieller Permissions-Doku und den lokal installierten Typen falsch.

OpenCode kann granular matchen fuer:

- `edit`
- `read`
- `bash`
- weitere Tools

Beispiel aus der Doku sinngemaess:

```json
{
  "permission": {
    "edit": {
      "*": "deny",
      "packages/web/src/content/docs/*.mdx": "allow"
    }
  }
}
```

### Auswirkung

Der vorgeschlagene Hardening-Plugin-Fallback ist unnoetig kompliziert.

Zusaetzlich ist das Beispiel in 12.3 technisch fragwuerdig:

- `tool.execute.before` bekommt lokal kein `input.agent`-Feld.
- Bei `tool.execute.before` liegen die Tool-Args im Hook-`output.args`, nicht in `output?.args` nach frei vermuteter Struktur.
- Der Guard waere also selbst in der Beispielversion nicht sauber belegt.

### Empfehlung

Der Agent `learning-extractor` sollte direkt mit nativer Permission-Haertung definiert werden, z. B. so:

```yaml
permission:
  edit:
    "*": deny
    ".opencode/learnings/*.md": allow
  bash: deny
  webfetch: deny
```

Das ist einfacher, klarer und robuster als ein zusaetzliches Path-Guard-Plugin.

## Weitere wichtige Probleme und Schwaechen

## 5. Der Fallback mit `$OPENCODE_SESSION_ID` ist aktuell unbewiesen

Betroffene Planstellen:

- Abschnitt 7 Kommentarblock
- Abschnitt 12.1

Der Plan nennt als moegliche Alternative:

```bash
opencode export $OPENCODE_SESSION_ID --format markdown
```

In der lokal geprueften Umgebung existiert `OPENCODE_SESSION_ID` nicht. Die Spezifikation sollte das daher nicht als halbwegs erwartbare Alternative darstellen, sondern klar als unbelegte Hypothese markieren.

## 6. Smoke-Test 3 ist als Test fuer Plugin-Syntax unzuverlaessig

Betroffene Planstelle:

- Abschnitt 13 Test 3

Der Test lautet:

```bash
node --check .opencode/plugins/learning-stats.js
```

Das ist als OpenCode-spezifischer Test problematisch:

- OpenCode laedt lokale Plugins laut Doku als JS/TS-Module aus `.opencode/plugins/`.
- Die Beispielplugins der Doku verwenden ESM-Syntax (`export const ...`).
- In diesem Repo hat `.opencode/package.json` aktuell **kein** `"type": "module"`.
- `node --check` kann daher auf einer ESM-`.js`-Datei einen False-Negative liefern, obwohl OpenCode/Bun sie laden kann.

### Empfehlung

Entweder:

- Plugin-Datei als `.mjs` oder `.ts` planen
- oder den Test auf das tatsaechliche Laufzeitverhalten von OpenCode ausrichten
- oder den Test explizit mit Bun statt Node formulieren

In der aktuellen Form ist der Smoke-Test nicht zuverlaessig genug.

## 7. Abnahmekriterium 6 ist nicht deterministisch pruefbar

Betroffene Planstelle:

- Abschnitt 15 Kriterium 6

Der Plan fordert:

> Beim naechsten Session-Start erwaehnt der Hauptagent den Index

Das ist kein guter Verifikationstest. Selbst wenn der Index geladen ist, muss das Modell ihn nicht aktiv und sichtbar erwaehnen, solange der User nicht danach fragt.

### Empfehlung

Besser waere eine deterministische Pruefung, z. B.:

- `opencode.jsonc` enthaelt `.opencode/learnings/INDEX.md` unter `instructions`
- oder der Agent beantwortet auf direkte Nachfrage korrekt, dass ein Learning-Index vorhanden ist
- oder Debug-/Prompt-Inspection zeigt, dass die Datei geladen wurde

## 8. Smoke-Test 2 prueft Frontmatter nur sehr oberflaechlich

Betroffene Planstelle:

- Abschnitt 13 Test 2

Der aktuelle Test prueft nur, ob die erste Zeile `---` ist. Das validiert nicht:

- schliessendes `---`
- YAML-Syntax
- erlaubte Schluessel
- korrekte Einrueckung

Als schneller Smoke-Test ist das besser als nichts, aber fuer die Formulierung "Frontmatter-Syntax ist valide" ist er zu schwach.

## 9. Die Subagent-Permissions sind unnoetig komplex und teilweise ueberfluessig

Betroffene Planstelle:

- Abschnitt 6

Der `learning-extractor` soll nur Learnings schreiben und den Index neu bauen. Dafuer braucht er wahrscheinlich gar kein `bash`, wenn die Verzeichnisse bereits durch die Installation angelegt werden.

Die minimalere und robustere Variante waere:

- `bash: deny`
- nur `edit` auf `.opencode/learnings/*.md` erlauben
- `read` auf `.opencode/learnings/*` und eventuell Session-Export-Datei erlauben

Das reduziert Oberflaeche und vereinfacht das Sicherheitsmodell.

## 10. Der Plan vermischt an mehreren Stellen drei verschiedene Lademodi

Betroffene Planstellen:

- Abschnitt 2
- Abschnitt 7
- Abschnitt 9
- Abschnitt 10

Es werden im Plan drei Mechanismen miteinander vermischt:

1. `@file` in User-/Command-Prompts
2. explizite `Read`-Tool-Calls
3. Dateien in `instructions`/Rules

Diese Mechanismen haben in OpenCode unterschiedliche Semantik:

- `@file` in Chat oder Commands fuegt File-Content als Konversationspart hinzu
- `Read` ist ein Tool-Call und pluginseitig beobachtbar
- `AGENTS.md` parst `@file` nicht automatisch
- `instructions` bindet Dateien deterministisch beim Start ein

Der Plan sollte diese Modi sauber trennen, sonst entstehen Missverstaendnisse bei Export, Lazy-Load und Stats.

## Korrigierte Bewertung pro Hauptkomponente

| Komponente | Bewertung | Kommentar |
|---|---|---|
| `.opencode/commands/learn.md` | Teilweise machbar | Command-System ist korrekt, Session-Export-Mechanik nicht |
| `.opencode/agents/learning-extractor.md` | Machbar | Prompt-Idee gut, Permission-Design sollte vereinfacht werden |
| `.opencode/learnings/INDEX.md` | Machbar | Datei und Regenerierung sind unproblematisch |
| `AGENTS.md`-Addition | In aktueller Form falsch | `@` wird dort nicht automatisch geladen |
| `.opencode/plugins/learning-stats.js` | Teilweise machbar | Hook ist moeglich, aber nicht fuer `@`-basierte Nutzungsmessung |
| `.opencode/commands/learnings-stats.md` | Machbar | read-only Report-Command ist realistisch |
| Smoke-Tests | Teilweise brauchbar | mehrere Checks sind zu schwach oder nicht deterministisch |

## Empfohlene Plan-Korrektur

Wenn der Plan in eine belastbare V1 gebracht werden soll, wuerde ich ihn so nachschaerfen:

1. **Index-Autoload korrekt loesen**

   - `.opencode/learnings/INDEX.md` in `opencode.jsonc` `instructions` aufnehmen
   - `AGENTS.md` nur fuer Verhaltensregeln nutzen

2. **Session-Export korrekt loesen**

   - keine Shell-Include-Loesung mit `opencode export --format markdown`
   - stattdessen Plugin-/SDK-gestuetzte Export-Loesung oder klar manueller Zwischenschritt

3. **Stats-Semantik entscheiden**

   - entweder `Read`-Tool-Nutzung zaehlen
   - oder `@`-File-Parts zaehlen
   - aber im Plan nicht beides gleichsetzen

4. **Permissions vereinfachen**

   - nativer `permission.edit`-Pfadschutz statt optionalem Guard-Plugin

5. **Tests schaerfen**

   - keine sichtbare Agentenerwaehnung als Nachweis verlangen
   - Plugin-Ladetest auf tatsaechliche OpenCode-Laufzeit ausrichten
   - Frontmatter nicht nur ueber die erste Zeile pruefen

## Endbewertung

**Machbarkeit insgesamt:** Ja, aber nur nach Korrekturen.

**Machbarkeit genau wie beschrieben:** Nein.

Die grobe Produktidee ist stark. Die wichtigsten Probleme liegen nicht im Produktkonzept, sondern in vier falschen oder unvollstaendigen OpenCode-Annahmen:

- falscher Session-Export-Pfad
- falsche Annahme ueber `@` in `AGENTS.md`
- falsche Annahme ueber `@`-Tracking via `read`-Hook
- falsche Annahme ueber fehlende pfadgenaue `edit`-Permissions

Mit diesen Korrekturen ist das System fuer OpenCode weiterhin gut realisierbar.
