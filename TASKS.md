# YADA — Suivi des tâches

> Fichier de suivi actif. Mis à jour au fur et à mesure du développement.  
> Dernière mise à jour : 2026-05-29

---

## Légende
- ✅ Complété
- 🔄 En cours
- ❌ Bug connu / bloquant
- 📋 À faire
- 💡 Proposition / amélioration future
- [P] Peut être fait en parallèle

---

## Phase 1 — Infrastructure & Setup ✅ COMPLÈTE

- [x] T001 Structure Electron + TypeScript (main / renderer / server)
- [x] T002 Dépendances : Electron, React 18, SQLite, fast-xml-parser, Cytoscape.js, Jest
- [x] T003 ESLint + Prettier configurés
- [x] T004 Jest configuré avec support TypeScript
- [x] T005 Webpack configuré pour le renderer

---

## Phase 2 — Core Parser & UI de base ✅ COMPLÈTE (avec bugs corrigés)

- [x] T010 Modèles de données : Project, Table, Field, Layout, Script, Relationship
- [x] T011 Service parser XML (fast-xml-parser) avec détection BOM
- [x] T012 Support encodage UTF-16 LE BOM (fichiers DDR FileMaker)
- [x] T013 Support racine XML `FMSaveAsXML` (FM Pro 19+) en plus de `FMPReport` / `FMPDDR`
- [x] T014 Dashboard React avec liste de projets et statistiques
- [x] T015 Upload de fichier via FileReader (binaire → base64 → IPC → Buffer)
- [x] T016 Graphe de relations avec Cytoscape.js
- [x] T017 Panneau de recherche full-text

### Bugs corrigés en session
- [x] BUG-001 `RangeError: Invalid time value` dans ProjectDashboard (`formatDate` sur valeur nulle)
- [x] BUG-002 `readAsText()` corrompt les fichiers UTF-16 LE → remplacé par `readAsArrayBuffer` + base64
- [x] BUG-003 `writeTempFile` écrivait une string corrompue → écrit maintenant un Buffer depuis base64
- [x] BUG-004 Racine XML `FMSaveAsXML` non reconnue → ajoutée au parser
- [x] BUG-005 Labels du graphe Cytoscape illisibles (blanc sur blanc) → texte foncé + fond semi-transparent
- [x] BUG-006 `TypeError: Cannot read properties of null (reading 'notify')` Cytoscape lors du changement de layout → `cy.stop()` avant `destroy()`, `useEffect` découplé du changement de layout
- [x] BUG-007 `React error #31` dans SearchPanel → les `matches` du backend sont des objets `{field, value, startIndex, endIndex, context}`, pas des strings → conversion dans le mapping

---

## Phase 3 — Support multi-fichiers & Summary.xml 📋 À FAIRE

> Objectif : permettre d'importer une solution FileMaker complète via son `Summary.xml`

### Structure du Summary.xml (FM Pro 22, UTF-16 LE BOM)
```xml
<FMPReport type="Summary" version="22.0.4" creationDate="..." creationTime="...">
  <File link="./NomFichier_fmp12.xml" name="NomFichier.fmp12" path="100.90.20.68">
    <BaseTables count="81"/>
    <Tables count="174"/>
    <Relationships count="92"/>
    <Layouts count="84"/>
    <Scripts count="182"/>
    <ValueLists count="20"/>
    <CustomFunctions count="75"/>
    <Accounts count="55"/>
    <Privileges count="13"/>
    <ExtendedPrivileges count="12"/>
    <FileAccess count="0"/>
    <FileReferences count="1"/>
    <CustomMenuSets count="2"/>
    <CustomMenus count="33"/>
  </File>
  <!-- un <File> par fichier .fmp12 de la solution -->
</FMPReport>
```

### Tâches

- [x] T020 [P] Parser `Summary.xml` : extraire la liste des fichiers et leurs stats agrégées
  - Fichier : `src/services/summary-parser.service.ts` ✅
  - Sortie : objet `Solution` avec `files: SolutionFile[]` et stats par fichier

- [x] T021 [P] Modèle `Solution` + `SolutionFile` + `SolutionFileStats`
  - Fichier : `src/models/index.ts` ✅

- [x] T022 Upload de `Summary.xml` comme point d'entrée d'import de solution complète
  - Fichier : `src/renderer/components/FileUpload.tsx` ✅
  - Détection via `isSummaryFile` (IPC) → route vers `parseSolution` ou `parseFile`

- [x] T023 IPC handlers `parse-solution` + `is-summary-file` dans le main process
  - Fichier : `src/main/index.ts` + `src/main/preload.ts` ✅
  - Parse séquentiel de chaque DDR, events `solution-discovered` / `solution-file-status` / `solution-parsed`

- [ ] T024 Vue "Solution" dans le Dashboard
  - Afficher les stats agrégées de tous les fichiers de la solution
  - Liste des fichiers avec leur statut de parsing individuel
  - Indicateur de progression lors du parsing multi-fichiers

- [ ] T025 [P] API endpoint `POST /api/parse-solution` côté serveur
  - Fichier : `src/server/index.ts`
  - Accepte le chemin d'un `Summary.xml`
  - Retourne `{ solution, files: ParseResult[] }`

---

## Phase 4 — Enrichissement du parser 📋 À FAIRE

> Le parser actuel capture tables, champs, layouts, scripts (noms seulement) et relations.  
> Ces éléments manquent et sont importants pour l'analyse.

- [ ] T030 Parser les **étapes de scripts** `<StepList><Step>` pour les cross-références
  - Détecter `Perform Script`, `Go to Layout`, `Set Field`, `Execute SQL`
  - Alimenter une table `script_references` en base

- [ ] T031 Parser les **fonctions personnalisées** `<CustomFunctionCatalog>`
  - Nom, paramètres, calcul, commentaire

- [ ] T032 Parser les **listes de valeurs** `<ValueListCatalog>`
  - Type (fixe / depuis champ), valeurs, référence champ source

- [ ] T033 Parser les **références inter-fichiers** `<FileReferences>`
  - Identifier les scripts qui appellent des fichiers externes

- [ ] T034 [P] Parser les **privilèges** `<PrivilegeCatalog>` (optionnel / basse priorité)

---

## Phase 5 — Amélioration UI/UX 💡 PROPOSITIONS

- [ ] T040 Graphe : afficher le nom de la **table de base** sous chaque TO (occurrence)
- [ ] T041 Graphe : filtre par fichier source quand solution multi-fichiers
- [ ] T042 Graphe : colorier différemment les TOs selon leur fichier d'origine
- [ ] T043 Recherche : afficher le **contexte** de la correspondance (extrait de calcul, commentaire)
- [ ] T044 Recherche : filtre par fichier source dans une solution multi-fichiers
- [ ] T045 Dashboard : badge / compteur de **fonctions personnalisées** et **listes de valeurs**
- [ ] T046 Export : rapport "scripts orphelins" (aucun appel entrant détecté)
- [ ] T047 Export : rapport "champs non utilisés dans les layouts"
- [ ] T048 Snapshot diff : comparaison de deux versions du même DDR

---

## Phase 6 — Qualité & Tests 📋 EN ATTENTE

- [ ] T050 Tests unitaires pour `parser.service.ts` (BOM handling, root element variants)
- [ ] T051 Tests unitaires pour `summary-parser.service.ts`
- [ ] T052 Tests d'intégration : import solution complète via Summary.xml
- [ ] T053 Couverture de code ≥ 80% (objectif NFR-005)
- [ ] T054 Tests E2E Playwright : workflow complet upload → visualisation

---

## Backlog / Idées futures 💡

- Support DDR exporté en plusieurs dossiers (solutions avec sous-dossiers)
- Mode comparaison de snapshots (diff entre 2 DDR de dates différentes)
- Détection de dépendances circulaires entre scripts
- Vue "impact analysis" : si je supprime ce champ, qu'est-ce qui casse ?
- Export rapport en PDF
- Raccourcis clavier dans le graphe

---

## Notes techniques

| Sujet | Décision |
|---|---|
| Encodage DDR | UTF-16 LE avec BOM (`FF FE`) — lire en ArrayBuffer, décoder avec `buffer.toString('utf16le')` |
| Racine XML FM 19+ | `<FMSaveAsXML>` |
| Racine XML FM 12–18 | `<FMPReport>` |
| Racine Summary.xml | `<FMPReport type="Summary">` |
| Transfer renderer→main | Base64 (binary safe) via IPC |
| Base de données locale | SQLite via `better-sqlite3` |
| Graphe | Cytoscape.js — stopper le layout avec `cy.stop()` avant `destroy()` |
