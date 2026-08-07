# YADA — Suivi des tâches

> Fichier de suivi actif. Mis à jour au fur et à mesure du développement.  
> Dernière mise à jour : 2026-07-20

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

- [x] T024 Vue "Solution" dans le Dashboard
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

- [x] T030 Parser les **étapes de scripts** `<StepList><Step>` pour les cross-références
  - Détecter `Perform Script`, `Go to Layout`, `Set Field`, `Execute SQL`
  - Alimenter une table `script_references` en base

- [x] T031 Parser les **fonctions personnalisées** `<CustomFunctionCatalog>`
  - Nom, paramètres, calcul, commentaire ✅

- [x] T032 Parser les **listes de valeurs** `<ValueListCatalog>`
  - Type (fixe / depuis champ), valeurs, référence champ source ✅

- [x] T033 Parser les **cross-références scripts→scripts** via `Perform Script` steps
  - `scriptReferences[]` : `{ callerScriptName, targetScriptName, targetFile }` ✅

- [x] T034 Parser les **privilege sets** `<PrivilegeCatalog>`
  - Nom, fullAccess ✅

---

## Phase 5 — Amélioration UI/UX 💡 PROPOSITIONS

- [x] T040 Graphe : afficher le nom de la **table de base** sous chaque TO (occurrence)
  - `api.service.ts` : champ `baseTable` ajouté aux données nœuds
  - `GraphVisualization.tsx` : label biligne `TOName\n(BaseTable)` + `text-wrap: wrap`
  - Panneau "Node Details" affiche aussi "Base table: ..."
- [ ] T041 Graphe : filtre par fichier source quand solution multi-fichiers
- [ ] T042 Graphe : colorier différemment les TOs selon leur fichier d'origine
- [ ] T043 Recherche : afficher le **contexte** de la correspondance (extrait de calcul, commentaire)
- [ ] T044 Recherche : filtre par fichier source dans une solution multi-fichiers
- [x] T045 Dashboard : badge / compteur de **fonctions personnalisées** et **listes de valeurs**
  - Cartes ajoutées pour `valueListCount`, `privilegeSetCount`, `scriptReferenceCount` (masquées si `null`)
- [ ] T046 Export : rapport "scripts orphelins" (aucun appel entrant détecté)
- [ ] T047 Export : rapport "champs non utilisés dans les layouts"
- [ ] T048 Snapshot diff : comparaison de deux versions du même DDR

- [x] T049 TablesView : colonne "Type de champ" (Normal/Calculé/Résumé)
  - Le XML DDR porte deux attributs distincts sur `<Field>` : `dataType` (déjà extrait → `Field.type`)
    et `fieldType` (`Normal`/`Calculated`/`Summary`, actuellement ignoré)
  - Extrait dans le parser → nouveau champ `Field.fieldKind` (`'normal'|'calculated'|'summary'`)
  - Nouvelle colonne "Genre" dans le tableau des champs du drawer de détail (`TablesView.tsx`),
    chip affiché seulement quand ≠ "normal" pour ne pas encombrer le cas courant

- [x] T096 TablesView : tri sur les en-têtes de colonnes du tableau des champs
  - Fichier : `src/renderer/components/TablesView.tsx`
  - Chaque en-tête (Nom, Type, Genre, Options, Commentaire) est cliquable via `TableSortLabel` (MUI),
    tri ascendant/descendant en alternance, colonne Options triée par combinaison de flags actifs

---

## Phase 6 — Qualité & Tests 📋 EN ATTENTE

- [ ] T050 Tests unitaires pour `parser.service.ts` (BOM handling, root element variants)
- [ ] T051 Tests unitaires pour `summary-parser.service.ts`
- [ ] T052 Tests d'intégration : import solution complète via Summary.xml
- [ ] T053 Couverture de code ≥ 80% (objectif NFR-005)
- [ ] T054 Tests E2E Playwright : workflow complet upload → visualisation

---

## Phase 7 — Analyse approfondie FMSaveAsXML 📋 À FAIRE (plus tard)

> Les fichiers DDR exportés via **File > Save a Copy as XML** (FM Pro 19+) ont une structure
> différente et plus riche que les DDR classiques. Cette phase vise à exploiter pleinement
> ce format.

- [ ] T060 Inventorier la structure complète de `FMSaveAsXML` vs `FMPReport`
  - Documenter les balises présentes dans `FMSaveAsXML` mais absentes dans `FMPReport`
  - Identifier les données supplémentaires disponibles (scripts complets, calculs, etc.)

- [ ] T061 Adapter le parser pour tirer parti des données supplémentaires de `FMSaveAsXML`
  - Contenu complet des étapes de scripts (pas seulement les noms)
  - Calculs de champs complets
  - Définitions de layouts plus détaillées

- [ ] T062 Valider avec des fichiers réels les différences de contenu entre les deux formats

---

## Bugs connus 🐛

- [x] BUG-008 Bouton "œil" (view entity) dans SearchPanel ne fait rien au clic
  - Fix : prop `onNavigate` ajoutée à `SearchPanel`, branchée sur `setCurrentTab` dans `App.tsx`
  - table/field/relationship → onglet Visualize (3), script/layout → onglet Dashboard (0)

- [ ] BUG-009 Les fichiers `FMSaveAsXML` (FM Pro 19+) ne parsent RIEN silencieusement
  - Découvert en travaillant sur T080 : `root.File` (utilisé par `processFileElement`) n'existe pas dans ce format —
    sa racine réelle est `root.Structure`/`root.Metadata`, une structure complètement différente de `FMPReport`
  - Résultat actuel : 0 tables/champs/layouts/scripts extraits, mais `project.status` reste `'ready'` sans erreur —
    silencieux, donc trompeur pour l'utilisateur
  - Confirmé sur `tests/fixtures/saveAsXML_Gestionnaire iPlus.xml` et `saveAsXML_gip_data.xml`
  - Rattaché à la Phase 7 (déjà prévue, pas traité ici — hors scope de T080-T085)

- [x] BUG-010 Dépendances de niveau 1 manquantes pour les champs référencés dans un bloc "If"/calcul de script
  - Signalé avec un exemple concret : un step "If" référençant `EMP__EMPLOYES::id` (script `employe.delete`,
    `gip/Gestionnaire iPlus_fmp12.xml`) n'apparaissait pas dans les dépendances
  - Cause réelle : le champ est défini dans un **autre fichier** de la solution multi-fichiers
    (`gip_data_fmp12.xml`) — invisible pour le graphe de dépendances, qui est scopé par projet/fichier
  - Fix en deux parties :
    1. Utilisation des chunks `<DisplayCalculation><Chunk type="FieldRef"|"FunctionRef">` du DDR —
       le propre parseur de calcul de FileMaker, fiable par construction (contrairement à une regex sur le
       texte brut qui peut se tromper sur un littéral de chaîne contenant "::") — extraits dans le parser
       (`Field`/`CustomFunction`/`ScriptStep.options.fieldRefs`/`functionRefs`) et utilisés en priorité par
       `dependency.service.ts`, avec repli sur l'ancienne heuristique regex si absents (ex: données de test)
    2. Une référence de champ non résolue dans le projet courant est maintenant **affichée quand même**
       (`DependencyNode.unresolved: true`), au lieu d'être silencieusement ignorée — grisée, icône "?",
       sans bouton "Naviguer vers". Les fonctions non résolues restent ignorées (bruit des fonctions
       natives FileMaker impossible à distinguer des fonctions personnalisées à ce niveau)
  - Vérifié sur le vrai fichier : `EMP__EMPLOYES::id` apparaît maintenant en Niveau 1, marqué non résolu
  - Amélioration suite à une suggestion : le message affiché nomme maintenant le **fichier externe réel**
    (ex: "Probablement défini dans \"gip_data_fmp12.xml\"") plutôt qu'un message générique — résolu via
    le `<FileReference id="X">` propre à chaque occurrence de table (`RelationshipGraph > TableList > Table`)
    croisé avec `ExternalDataSourcesCatalog > FileReference[@id][@link]` ; nouveau champ `Table.externalFile`
  - Non traité (limite assumée) : résolution complète cross-fichiers dans le **graphe de dépendances**
    (aller chercher le champ réel dans le projet de l'autre fichier pour continuer la cascade) —
    nécessiterait que le backend connaisse le regroupement Solution → projets, qui n'existe pas
    aujourd'hui au niveau de `dependency.service.ts`
  - Suite (2026-07-08) — demande : « pour les occurrences de table externes, peux-tu faire un lien vers
    celles-ci? Autrement, on ne voit pas les champs. » Ajout d'un lien de navigation dans `TablesView` :
    - Le drawer de détail d'une occurrence externe (`table.externalFile` défini) affiche maintenant un
      bandeau d'info nommant la table et le fichier externe, avec une icône « ouvrir »
    - Côté `App.tsx` (qui a accès à `currentSolution` + la liste de tous les `Project` chargés), un clic
      résout le nom de fichier DDR contre `Solution.files[].link` (comparaison par nom de fichier, le
      `link` étant un chemin absolu résolu par `summary-parser.service.ts`), retrouve le `Project` déjà
      parsé correspondant, bascule dessus (`setCurrentProject`) et sélectionne automatiquement la table
      de base visée dans le nouvel onglet Tables (`focusRequest` avec un token pour forcer le re-déclenchement)
    - Si aucune solution multi-fichiers n'est chargée, ou si le fichier visé n'a pas encore été analysé,
      une notification explique pourquoi plutôt que de rester silencieux
    - Ceci referme la limite ci-dessus **côté navigation UI** ; le graphe de dépendances lui-même reste
      scopé à un seul projet (la limite documentée plus haut persiste pour la cascade automatique)

- [x] BUG-011 Occurrences majeures disparues du fichier UI après import d'une solution multi-fichiers
  - Signalé : après import de `gip/Summary.xml`, recherche de `prj__` / `emp__` dans l'onglet Tables du
    fichier `Gestionnaire iPlus_fmp12.xml` → `PRJ__PROJETS` et `EMP__EMPLOYES` introuvables (alors que
    présentes dans une analyse isolée du même fichier)
  - Cause réelle : `DatabaseService` (mock en mémoire) indexait `mockTables`/`mockFields`/`mockLayouts`/
    `mockScripts`/`mockCustomFunctions` par le simple `.id` de l'entité — or les id assignés par FileMaker
    dans le DDR ne sont uniques **que dans un seul fichier exporté**, pas à travers toute une solution.
    Le fichier UI et le fichier données réutilisent très souvent les mêmes id numériques pour des entités
    différentes. Lorsque le second fichier de la solution finissait de parser (toujours après le premier,
    séquentiellement — voir `parse-solution` dans `main/index.ts`), toute entité dont l'id entrait en
    collision **écrasait silencieusement** l'entrée du premier projet dans la Map partagée — l'entité
    survivante portant le `projectId` du second fichier, elle disparaissait du résultat de
    `getTablesForProject()`/etc. pour le premier
  - Reproduit hors UI : parser `Gestionnaire iPlus_fmp12.xml` (249 tables) puis `gip_data_fmp12.xml` dans
    la même session serveur → re-requête du premier projet : 129 tables restantes, `PRJ__PROJETS` /
    `EMP__EMPLOYES` / `T__TACHES` disparues (exactement le symptôme rapporté)
  - Fix : clé composite `${projectId}:${id}` pour ces 5 Maps dans `database.service.ts` (aucun lecteur
    n'utilisait de `.get(id)` direct sur ces Maps — uniquement `Array.from(map.values()).filter(...)` —
    donc changement de clé sans risque de casser un autre appelant)
  - Portée du bug : pas spécifique à une solution multi-fichiers via Summary.xml — se serait produit pour
    **n'importe quels deux fichiers DDR** parsés dans la même session serveur sans redémarrage, dès qu'un
    id se répète (fréquent, FileMaker attribue souvent de petits id séquentiels par fichier)
  - Tests de régression : `tests/services/database.service.test.ts` (nouveau) — confirmé qu'ils échouent
    sans le fix (`git stash` sur `database.service.ts` seul) et passent avec

- [x] BUG-012 Gros fichier DDR impossible à importer (fixture `abase/abase_fmp12.xml`, ~141 Mo)
  - Demande : « J'ai un très gros fichier XML à extraire... Pourrais-tu le rendre parsable? »
  - Cause : `multer` (upload middleware d'`/api/parse` dans `api.service.ts`) plafonnait `limits.fileSize`
    à 100 Mo — tout fichier plus gros (upload navigateur **et** import local via Electron, qui passe aussi
    par `/api/parse` en interne) était rejeté avant même d'atteindre le parseur
  - Vérifié que le parseur lui-même n'a aucun problème avec un fichier de cette taille : parsing direct de
    `abase_fmp12.xml` (141 Mo, hors limite d'upload) en ~4.4s, ~890 Mo de RSS, sans flag mémoire particulier
    (20 tables, 3716 champs, 397 layouts, 1140 scripts, 767 relations) — donc uniquement un problème de
    plafond arbitraire, pas de limite réelle de performance
  - Fix : `limits.fileSize` relevé à 500 Mo ; ajout d'une réponse claire (413 `FILE_TOO_LARGE`) au lieu
    d'une "Internal server error" générique si la nouvelle limite est un jour dépassée
  - Vérifié de bout en bout via l'endpoint HTTP réel (upload multipart du fichier de 141 Mo) : 200 OK en
    ~4.5s, puis dans l'UI (Tables : 620 tables listées, y compris la table de base `Abase` à 3001 champs
    qui s'affiche sans souci dans le drawer de détail)

---

## Phase 8 — Internationalisation (i18n) 💡 À FAIRE (plus tard)

- [ ] T070 Choisir et intégrer une librairie i18n (ex: `react-i18next`)
- [ ] T071 Extraire toutes les strings UI en fichiers de traduction (`en.json`, `fr.json`)
- [ ] T072 Ajouter un sélecteur de langue dans les paramètres
- [ ] T073 Traduire l'interface en français (priorité : FR + EN)

---

## Phase 9 — Analyse de dépendances en cascade ✅ COMPLÈTE

### User Story
> *En tant que développeur FileMaker, lorsque je clique sur une entité (ex: un champ d'une table),
> je veux voir toutes ses dépendances en ordre de cascade — du plus proche au plus loin —
> afin de comprendre l'impact d'une modification ou suppression.*

### Exemples de cascade
- **Champ** → layouts qui l'affichent → scripts qui le modifient (`Set Field`) → scripts qui appellent ces scripts → ...
- **Script** → scripts qui l'appellent → scripts qui appellent ces appelants → ...
- **Table** → relations qui l'impliquent → layouts basés sur ces TOs → scripts qui accèdent à ces layouts → ...

### Tâches

- [x] T080 Moteur de résolution de dépendances en cascade
  - Fichier : `src/services/dependency.service.ts`
  - Entrée : `{ entityType, entityId }`
  - Sortie : `DependencyGraph` avec `dependencies`/`dependents: DependencyNode[]`, profondeur (level 1, 2, 3...)
  - Algorithme BFS (largeur d'abord) — garantit l'ordre du plus proche au plus loin, détecte les cycles
    via un Set de nœuds visités (arête vers un nœud déjà visité = cycle enregistré, pas de re-visite)
  - Prérequis découvert en cours de route : le parser jetait déjà layouts/scripts/customFunctions/
    scriptReferences sans les persister — ajout de `createLayout/getLayoutsForProject`,
    `createScript/getScriptsForProject`, `createCustomFunction/getCustomFunctionsForProject`,
    `saveScriptReferences/getScriptReferencesForProject` dans `database.service.ts`
  - Extraction layout→champ ajoutée au parser (`processLayoutCatalog`) : champs directs
    (`Object[@type=Field]`) et champs dans des portails (`Object[@type=Portal] > PortalObj > FieldList`),
    y compris portails imbriqués dans des onglets/groupes — donnée absente du modèle auparavant
    (`Layout.fields` était toujours `[]`)
  - Bug corrigé au passage : `RelationshipGraph` était traité **après** `LayoutCatalog`, empêchant
    la résolution nom-de-TO → table de base nécessaire pour retrouver les champs d'un layout
  - Bug corrigé au passage : les layouts organisés en dossiers (`LayoutCatalog > Group > Layout`)
    n'étaient pas du tout parcourus (seul `LayoutCatalog > Layout` direct l'était) → 0 layout extrait
    silencieusement pour toute solution utilisant des dossiers de layouts (cas réel, pas un edge case)
  - Heuristique de calcul (`field-references-field` / `field-references-function`) à vocabulaire fermé
    (validée contre les champs/fonctions réels du projet) pour limiter les faux positifs
  - Tests : `tests/services/dependency.service.test.ts` (12 tests : layout direct/portail, Set Field,
    chaîne script→script→script, cycle + terminaison, relation bidirectionnelle, heuristique calc
    vrai/faux positif, référence fonction, troncature maxDepth, entité inconnue, isolation par projet)

- [x] T081 API endpoint `POST /api/dependencies` côté serveur
  - Retourne `{ entity, dependencies, dependents, cycles, truncated, depth }` (étend le spec initial
    avec `dependents`/`cycles`/`truncated`, nécessaires à l'UI)
  - Tests : `tests/api/dependency-service.test.ts` (7 tests : validations 400, 404 projet/entité, 200)

- [x] T082 Vue "Dependency Panel" dans l'UI
  - Fichiers : `src/renderer/components/DependencyPanel.tsx`, `src/renderer/utils/entityColors.ts`
  - Panneau latéral (Drawer), réutilise le langage visuel du `DetailDrawer` de TablesView
  - Sections "Dépendances"/"Dépendants" groupées par niveau, code couleur par `EntityType`,
    sélecteur de profondeur (1 à 10 niveaux), alerte si des cycles sont détectés
  - Bouton "Naviguer vers" sur chaque ligne

- [x] T083 Intégration dans SearchPanel — clic sur l'œil ouvre le Dependency Panel
  - Le comportement précédent (BUG-008 : changement d'onglet) devient le "Naviguer vers" du panneau
- [x] T084 Intégration dans GraphVisualization — clic sur un nœud affiche ses dépendances
  - Bouton "Voir les dépendances" dans la carte "Node Details" existante ; "Naviguer vers" centre
    le nœud cible sur le canvas s'il y est déjà (le graphe n'affiche que des tables aujourd'hui),
    sinon rouvre simplement le panneau sur la nouvelle entité
- [x] T085 Intégration dans TablesView — clic sur un champ dans le drawer de détail d'une table
  - Fichier : `src/renderer/components/TablesView.tsx`
  - Champ cliquable dans `DetailDrawer` → ouvre le Dependency Panel ; "Naviguer vers" une table ou
    un champ change la table sélectionnée et rouvre le panneau sur la nouvelle cible

- Vérification GUI : parcours complet testé via un navigateur piloté par Playwright (build réel +
  serveur Express + clics simulés) sur les trois points d'intégration, avec captures d'écran — voir
  le fixture `tests/fixtures/CRM_fmp12.xml` (74 tables, 60 layouts, 941 champs sur layouts dont 139
  via portails) pour un scénario réaliste

### Prérequis
- T030 ✅ (étapes de scripts parsées — nécessaire pour les dépendances scripts→scripts)
- T033 ✅ (cross-références scripts→scripts extraites)
- T031 ✅ (custom functions — peuvent être des dépendances de calculs)

---

## Phase 10 — Export SQL (MySQL / PostgreSQL) 💡 À FAIRE (plus tard)

### User Story
> *En tant que développeur FileMaker, je veux pouvoir exporter une table ou une solution complète
> en SQL (MySQL ou PostgreSQL), en tenant compte des liaisons entre tables à travers les fichiers
> de la solution, afin de faciliter une migration ou une analyse externe.*

### Défis spécifiques FileMaker → SQL
- FileMaker utilise des **Table Occurrences (TOs)** : plusieurs TOs peuvent pointer vers la même table de base → il faut dédupliquer
- Les **relations** FileMaker sont entre TOs, pas entre tables de base → résolution nécessaire
- Les types de champs FileMaker n'ont pas d'équivalent direct SQL (ex: `Container`, `Calculation`, `Summary`)
- Les **clés primaires** ne sont pas toujours explicites dans le DDR
- Les relations **inter-fichiers** (entre deux `.fmp12`) deviennent des foreign keys cross-schema

### Tâches

- [ ] T090 Mapper les types de champs FileMaker → SQL
  - Fichier : `src/services/sql-export.service.ts`
  - Mapping : `Text→VARCHAR`, `Number→DECIMAL`, `Date→DATE`, `Time→TIME`, `Timestamp→DATETIME`, `Calculation→(généré/commenté)`, `Summary→(vue/commenté)`
  - **Container** — selon le dialecte et la stratégie choisie :
    - `PostgreSQL` → `BYTEA` (binaire inline) ou `OID`/`lo` (large object) pour les gros fichiers
    - `MySQL` → `LONGBLOB` (binaire inline) ou référence externe
    - `PostgreSQL` supporte aussi les extensions : `pg_largeobject` pour streaming, ou stocker uniquement le chemin (`TEXT`) si les fichiers sont externalisés (FM peut stocker les conteneurs par référence)
    - Option dans T094 : "Store binary inline" vs "Store as file path reference"
    - Note : FileMaker stocke parfois les conteneurs **par référence** (chemin fichier) — dans ce cas un `VARCHAR(512)` suffit
  - Configurable : longueur VARCHAR par défaut, dialecte MySQL vs PostgreSQL

- [ ] T091 Export SQL d'une seule table de base
  - Génère `CREATE TABLE` avec colonnes, types, contraintes `NOT NULL` si requis
  - Inclut les commentaires de champs comme `COMMENT ON COLUMN`
  - Identifie la clé primaire via les relations : un champ utilisé comme **côté gauche de plusieurs relations** (`LeftField`) est très probablement une PK
  - Fallback : convention de nommage (`id_*`, `pk_*`, champ serial) si aucune relation ne la désigne clairement
  - Heuristique : champ utilisé dans le plus grand nombre de `JoinPredicate` à travers toute la solution = PK probable

- [ ] T092 Résolution des relations inter-TOs → Foreign Keys
  - Déduplique les TOs vers leurs tables de base
  - Génère `FOREIGN KEY` entre tables de base à partir des `JoinPredicate`
  - Gère les relations multi-prédicats (clés composites)
  - Signale les relations inter-fichiers (cross-schema)
  - **Détection et décomposition des relations many-to-many** :
    - FileMaker permet les relations M-N directes (ex: `Projets ←→ Employés`)
    - En SQL, une M-N doit être décomposée en table de jonction : `Projets_Employés (id_projet FK, id_employe FK)`
    - Détecter : si un champ est à la fois `LeftField` dans certaines relations ET `RightField` dans d'autres → table de jonction potentielle
    - Générer automatiquement la table de jonction avec les deux FK + PK composite
    - Inclure dans le rapport de migration (T095) avec suggestion du nom de la table de jonction

- [ ] T093 Export SQL d'une solution complète (multi-fichiers)
  - Génère un script SQL complet : toutes les tables + toutes les FK
  - Dialectes : MySQL (`ENGINE=InnoDB`) et PostgreSQL
  - Option : un fichier par table de base, ou un seul script
  - Inclut un header avec métadonnées (source FM, date export, version)

- [ ] T094 UI — panneau d'export SQL
  - Sélection : table individuelle ou solution complète
  - Choix du dialecte : MySQL / PostgreSQL
  - Options avancées : inclure commentaires, inclure indexes, longueur VARCHAR
  - Aperçu du SQL généré avant téléchargement
  - Export en `.sql`

- [ ] T095 Rapport de migration
  - Liste les champs `Calculation` et `Summary` non migrés (avec explication)
  - Liste les relations inter-fichiers qui deviennent cross-schema
  - Signale les champs sans type clair ou sans nom de clé primaire détectable

---

## Phase 11 — Vue tabulaire des Scripts ✅ COMPLÈTE

### User Story
> *Au même titre que TablesView pour les tables, je veux une vue tabulaire des scripts avec un
> panneau de détail au clic (accès complet, inclusion menu, étapes lisibles, champs/scripts/layouts/
> fonctions utilisés) — cf. l'export DDR HTML de référence (Script Name, Run script with full access
> privileges, Layouts/Scripts that use this script, Script Definition, Fields/Scripts/Layouts/Custom
> Functions used in this script).*

- [x] T097 Parser : extraction robuste des scripts
  - `ScriptCatalog` est organisé en dossiers (`Group`), exactement comme `LayoutCatalog` (T080) —
    même bug non détecté jusqu'ici : seul un script sur XX était extrait sur de vraies solutions
  - Extraire `runFullAccess`→`Script.runWithFullAccess`, `includeInMenu`→`Script.includeInMenu`
    (jusqu'ici seul le chemin mort `handleOpenTag` les lisait, jamais le chemin actif)
  - Chaque `<Step>` porte un `<StepText>` déjà formaté par FileMaker (ex: "Set Variable [ $x; Value:... ]")
    → extrait tel quel comme `ScriptStep.text`, évite d'avoir à réimplémenter le rendu de chacune
    des ~150 étapes FileMaker une par une
  - Nouveau cas `Set Variable` (Value/Calculation + Name) — fréquent et riche en références
  - `Layout.scripts` (toujours vide jusqu'ici) peuplé via `<ScriptTriggers>` (déclencheurs) et les
    `<Step name="Perform Script">` imbriqués dans les boutons (découverts par la marche récursive
    déjà construite pour l'extraction layout→champ, T080)
  - Siri Shortcut Visible : aucun attribut correspondant trouvé dans les fixtures réelles disponibles
    (probablement FM19+ uniquement) — non implémenté plutôt que deviner un nom d'attribut

- [x] T098 Étendre le moteur de dépendances pour les scripts
  - Nouveaux types d'arête `script-references-field` / `script-references-function` : heuristique
    de calcul (déjà utilisée pour les champs calculés) appliquée aux steps `Set Variable`/`If`/
    `Else If`/`Exit Script`/`Halt Script`
  - Nouveau type d'arête `layout-triggers-script` (layout → script, via `Layout.scripts`) : symétrique
    à `layout-shows-field`, permet aux dépendants d'un script d'inclure à la fois les scripts
    appelants et les layouts qui le déclenchent (bouton/trigger)

- [x] T099 Nouveau composant `ScriptsView.tsx` (miroir de `TablesView.tsx`)
  - Liste triable/filtrable : nom, nb d'étapes, accès complet, inclusion menu
  - Clic sur un script → drawer de détail : étapes lisibles (`StepText`, désactivées en grisé/barré),
    tables/TOs utilisés (dérivés côté client des champs/layouts référencés, pas une nouvelle arête
    dédiée), et `DependencyPanel` réutilisé tel quel pour dépendances/dépendants
  - Découverte en vérifiant sur un vrai DDR : FileMaker représente les séparateurs du menu Scripts
    comme de vrais scripts nommés `"-"` sans étape — filtrés côté UI (données brutes inchangées)
  - Filtre de recherche rapide ajouté dans l'en-tête du tableau (`GridToolbarQuickFilter`), même
    composant que celui de `TablesView`

- [x] T100 Intégration navigation : nouvel onglet "Scripts" dans `App.tsx`
  - Inséré entre Tables et Search → tous les index d'onglets décalés (Search 3→4, Visualize 4→5,
    Export 5→6) ; mapping de navigation du DependencyPanel dans `SearchPanel.tsx` mis à jour en
    conséquence (résultat de type `script` → onglet Scripts, `table`/`field`/`relationship` → Visualize)

- [x] T101 Tests (parser + dependency service) + vérification GUI
  - `tests/services/parser.scripts.test.ts` (6 tests) + 3 tests ajoutés à `dependency.service.test.ts`
  - Vérifié sur `CRM_fmp12.xml` : 141 scripts extraits (vs 1 seul avant le fix Group — bug à fort impact
    corrigé au passage), 258 références layout→script, script "File - Open" (132 étapes) correctement
    affiché avec dépendances complètes

### Limite connue (non traitée ici)
- "Custom menu set used by this script" : aucun subsystem de custom menus n'existe dans l'app —
  hors scope, nécessiterait une nouvelle catégorie d'entité à part entière

---

## Backlog / Idées futures 💡

- 🌟 **Wishlist lointaine** — Générer un prototype d'app web CRUD depuis le DDR : reproduire partiellement l'UI FileMaker en web (structure des tables, relations, layouts basiques, listes de valeurs, navigation scripts→layouts). Limites connues : pas de coordonnées x/y des champs, pas de styles visuels, pas de données. Faisable comme outil de prototypage / aide à la migration.



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
