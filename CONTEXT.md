# YADA — Context de session

> À lire au début de chaque nouvelle session pour reprendre sans relire l'historique.  
> Mis à jour : 2026-05-29

---

## C'est quoi ce projet ?

**YADA** (Yet Another Database Analyzer) — Application Electron + TypeScript + React qui parse les fichiers DDR (Database Design Report) XML exportés par FileMaker Pro et permet de les explorer visuellement.

- **Stack** : Electron 27, React 18, TypeScript 5, SQLite (better-sqlite3), fast-xml-parser, Cytoscape.js, Material-UI
- **Architecture** : 3 processus séparés — `main` (Electron IPC), `server` (Express HTTP), `renderer` (React UI)
- **Dossier** : `D:\_data\projets\filemaker\yada`
- **Branche** : `001-filemaker-ddr-xml`
- **Commandes** :
  - `npm run build && npm run electron` — build complet + lancement
  - `npm run build:renderer && npm run build:main && npm run electron` — build partiel

---

## État actuel (2026-05-29)

### Ce qui fonctionne ✅
- Upload de fichier DDR individuel (UTF-16 LE BOM géré)
- Upload de `Summary.xml` → détecte automatiquement → parse toute la solution
- Parser XML : tables, champs, layouts, scripts + étapes, relations, custom functions, value lists, privilege sets, cross-références scripts→scripts
- Graphe Cytoscape interactif (sans crash au changement de layout)
- Recherche full-text (résultats correctement affichés)
- Dashboard avec vue Solution (stats agrégées, statut par fichier)

### Encodage DDR FileMaker
- Tous les fichiers DDR sont en **UTF-16 LE avec BOM** (`FF FE`)
- Le renderer lit en `ArrayBuffer`, encode en base64, transfère via IPC
- Le main process décode le base64 → `Buffer` → écrit sur disque
- Pour `Summary.xml` : on passe le `file.path` original directement (les liens relatifs doivent être résolus depuis le vrai dossier)

### Structure XML FileMaker
| Format | Balise racine | Versions |
|---|---|---|
| DDR individuel récent | `<FMSaveAsXML>` | FM 19+ |
| DDR individuel ancien | `<FMPReport>` | FM 12–18 |
| Summary | `<FMPReport type="Summary">` | Toutes |

### Structure Summary.xml
```xml
<FMPReport type="Summary" version="22.0.4" creationDate="..." creationTime="...">
  <File link="./NomFichier_fmp12.xml" name="NomFichier.fmp12" path="100.90.20.68">
    <BaseTables count="81"/> <Tables count="174"/> <Scripts count="182"/> ...
  </File>
</FMPReport>
```

---

## Fichiers clés modifiés dans cette session

| Fichier | Rôle |
|---|---|
| `src/services/parser.service.ts` | Parser DDR principal — UTF-16, root element, steps, custom functions, value lists, privileges, script refs |
| `src/services/summary-parser.service.ts` | **NOUVEAU** — Parser Summary.xml |
| `src/models/index.ts` | Modèles : ajout `Solution`, `SolutionFile`, `SolutionFileStats`, stats étendues |
| `src/main/index.ts` | IPC handlers : `parse-solution`, `is-summary-file`, events solution |
| `src/main/preload.ts` | Exposé : `parseSolution`, `isSummaryFile`, `onSolutionDiscovered/FileStatus/Parsed` |
| `src/main/tsconfig.json` | `rootDir: ".."`, `outDir: "../../dist"` — pour accéder à `services/` et `models/` |
| `src/renderer/components/App.tsx` | État `currentSolution`, écoute events solution IPC |
| `src/renderer/components/ProjectDashboard.tsx` | Vue Solution : stats agrégées, statut par fichier, barre de progression |
| `src/renderer/components/FileUpload.tsx` | Détection Summary vs DDR, `file.path` pour Summary, base64 pour DDR |
| `src/renderer/components/SearchPanel.tsx` | Fix React error #31 : `matches` objets → strings |
| `src/renderer/components/GraphVisualization.tsx` | Fix crash Cytoscape, labels lisibles, `cy.stop()` avant `destroy()` |
| `src/renderer/types.ts` | Interface `ElectronAPI` à jour |
| `TASKS.md` | Suivi des tâches (voir ci-dessous) |

---

## Bugs corrigés dans cette session

| Bug | Fichier | Fix |
|---|---|---|
| `RangeError: Invalid time value` | ProjectDashboard | `formatDate` défensive (null/undefined/invalid) |
| UTF-16 LE corrompu à l'upload | FileUpload | `readAsArrayBuffer` + base64 au lieu de `readAsText` |
| `writeTempFile` écrivait du texte corrompu | main/index.ts | `Buffer.from(content, 'base64')` |
| Racine XML `FMSaveAsXML` non reconnue | parser.service.ts | Ajoutée au lookup |
| UTF-8 BOM mal détecté | parser.service.ts | `buffer[1] === 0xbb` corrigé |
| UTF-16 BE mal décodé | parser.service.ts | Swap bytes correct |
| Labels graphe illisibles | GraphVisualization | Texte foncé + fond blanc semi-transparent |
| Crash Cytoscape `null.notify` | GraphVisualization | `cy.stop()` + `useEffect` découplé |
| `React error #31` en recherche | SearchPanel | `matches` objets convertis en strings |
| `Summary.xml` ne parsait pas les DDR | FileUpload | `file.path` original passé à `parseSolution` |
| `tsconfig rootDir` trop restrictif | src/main/tsconfig.json | `rootDir: ".."`, `outDir: "../../dist"` |

---

## Prochaines tâches (voir TASKS.md pour détails)

### Priorité haute
- **T040** — Graphe : afficher le nom de la table de base sous chaque TO
- **T041** — Graphe : filtre par fichier source (multi-fichiers)
- **T045** — Dashboard : badges valueListCount, scriptReferenceCount, privilegeSetCount
- **T046** — Export : rapport "scripts orphelins" (aucun appel entrant)

### Priorité moyenne
- **T042** — Graphe : couleurs différentes par fichier d'origine
- **T044** — Recherche : filtre par fichier source
- **T047** — Export : rapport "champs non utilisés dans les layouts"

### Priorité basse / plus tard
- **T048** — Snapshot diff
- **Phase 7** — Analyse approfondie format FMSaveAsXML vs FMPReport

---

## Notes importantes pour la prochaine session

1. **`file.path`** — En Electron, `(file as any).path` donne le chemin disque réel. Essentiel pour Summary.xml.
2. **IPC summary events** — `solution-discovered`, `solution-file-status`, `solution-parsed` sont exposés via preload.
3. **Script cross-refs** — Stockées dans `parser.scriptReferences[]` mais pas encore persistées en DB ni visibles dans l'UI.
4. **Stats étendues** — `valueListCount`, `privilegeSetCount`, `scriptReferenceCount` sont dans `ProjectStatistics` mais pas encore affichées dans le dashboard (T045).
5. **`src/main/tsconfig.json`** — `outDir: "../../dist"` (pas `dist/main`) — les fichiers compilés du main sont dans `dist/main/`, les services dans `dist/services/`.
