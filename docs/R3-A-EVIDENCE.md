# R3-A — Evidence bundle

Preuves reproductibles du spike Tauri 2 (voir [R3-A-TAURI-SPIKE.md](R3-A-TAURI-SPIKE.md)).

## Décision : GO

Déclarée par Naomi Gilbert le 2026-08-03, sur la base des preuves ci-dessous : les trois
capacités requises — SQLite local, écriture Markdown, carte PMTiles hors-ligne — sont
exercées et passent sur macOS, sur le simulateur iOS et sur l'émulateur Android, soit
deux moteurs de webview distincts.

Deux points sont ouverts et portés avec la décision, ils ne sont pas refermés par elle :

1. **Windows n'a pas été testé** (décision du 2026-08-03). Risque résiduel jugé faible
   depuis qu'Android valide la pile sur un webview Chromium, mais ce n'est pas une preuve.
2. **Le modèle de vault mobile reste à trancher.** Le sélecteur de dossier n'existe pas
   sur iOS ni Android; le vault du bureau n'a donc pas d'équivalent direct. Trois options
   sont documentées plus bas et le choix conditionne la conception du vault. À décider
   avant R3-B.

Le fallback ratifié en D8 (Capacitor + Electron) n'est pas retenu.

## Environnement (macOS)

| Composant | Version |
| --- | --- |
| macOS | 26.5.1 (Darwin 25.5.0, Apple Silicon) |
| rustc | 1.96.0 (Homebrew) |
| Node / pnpm | v25.0.0 / 11.9.0 |
| tauri | 2.11.5 (`@tauri-apps/cli` 2.11.4, `@tauri-apps/api` 2.11.1) |
| tauri-plugin-sql | 2.4.0 (sqlx-sqlite 0.8.6, libsqlite3-sys 0.30.1 — SQLite embarqué) |
| tauri-plugin-fs | 2.5.1 |
| tauri-plugin-dialog | 2.7.1 |

## Commandes

```sh
pnpm --dir apps/desktop tauri build --bundles app
open "apps/desktop/src-tauri/target/release/bundle/macos/HAP Tauri Spike.app"
```

La fenêtre démarre directement sur l'écran de sonde (`tauri://localhost/tauri-spike`,
configuré dans `apps/desktop/src-tauri/tauri.conf.json`) — pas de redirection /login,
`isTauri()` détecté.

## macOS — SQLite (2026-07-12) : PASS

- Sonde UI : « Persisté : hap-r3-a-sqlite-persistence » (écriture, fermeture,
  réouverture, relecture via `tauri-plugin-sql`).
- Vérification indépendante sur disque :

```sh
$ sqlite3 "$HOME/Library/Application Support/com.morialkar.hap.spike/hap-r3-a-spike.sqlite" \
    "SELECT id, value FROM spike_probe;"
1|hap-r3-a-sqlite-persistence
```

- Fichier créé uniquement dans le dossier applicatif du bundle spike
  (`com.morialkar.hap.spike`), conforme au périmètre test-contrôlé.

## macOS — Vault Markdown (2026-07-12) : PASS

- Sonde UI : dossier choisi via le dialogue natif (`tauri-plugin-dialog`), fichier
  écrit puis relu à l'identique via `tauri-plugin-fs` :
  « Écrit et relu : …/vault-probe/hap-r3-a-vault-probe.md ».
- Vérification indépendante : `file` rapporte « Unicode text, UTF-8 text »; le contenu
  UTF-8 (apostrophe typographique incluse) fait l'aller-retour sans altération.
- Le scope fs est étendu dynamiquement par la sélection du dialogue; aucun accès hors
  du dossier choisi par l'utilisateur.

### Capabilities requises (constat)

Les jeux `default` des plugins ne suffisent pas; `apps/desktop/src-tauri/capabilities/default.json`
doit ajouter explicitement :

- `sql:allow-execute` — `sql:default` n'autorise que load/select/close; sans lui,
  `CREATE TABLE`/`INSERT` sont refusés à l'exécution.
- `fs:allow-read-text-file` et `fs:allow-write-text-file` — `fs:default` ne couvre que
  la lecture des dossiers applicatifs.
- `fs:allow-open`, `fs:allow-seek`, `fs:allow-read`, `fs:allow-fstat` — l'API bas niveau
  de descripteurs de fichier a ses propres commandes ACL, indépendantes des helpers
  `readFile`/`writeTextFile`. Sans elles : « Command plugin:fs|seek not allowed by ACL ».
  Attention, `fs:allow-close` **n'existe pas** et fait échouer la compilation.
- Portée `fs:scope` sur `$RESOURCE/fixtures/*` pour lire l'archive embarquée.

## macOS — PMTiles hors-ligne (2026-08-03) : PASS

Sonde exécutée automatiquement au démarrage de la fenêtre native, verdict écrit dans la
base du spike (`probe_verdicts`) pour être relu sans interaction :

```json
{
  "ok": true,
  "sourceFeatures": 87,
  "renderedFeatures": 7,
  "blockedRequests": [],
  "transport": "tauri-fs"
}
```

- **87 entités décodées** depuis l'archive embarquée et **7 réellement peintes** — la carte
  s'affiche, elle n'est pas seulement chargée.
- **`blockedRequests: []`** : aucune ressource réseau n'a même été demandée. Le style
  n'utilise ni glyphes ni sprites, qui seraient des dépendances réseau cachées.
- Fixture : polygones de pays Natural Earth (domaine public, donc redistribuable),
  générée depuis les données déjà présentes dans le dépôt par
  `packages/core/scripts/build-pmtiles-fixture.mjs`. **Aucun téléchargement, aucune donnée
  dérivée d'OSM, aucun préchargement de serveur de tuiles.** 598 Kio, zooms 0 à 4.

### Contrainte plateforme majeure : pas de byte serving sur `tauri://`

PMTiles lit une archive par plages d'octets. Le protocole applicatif de Tauri **ignore
l'en-tête `Range`** :

| Demande | Réponse |
| --- | --- |
| `Range: bytes=0-126` | `200`, `Content-Range: null`, **612 390 octets** (fichier entier) |

La bibliothèque refuse explicitement ce backend : *« Check that your storage backend
supports HTTP Byte Serving »*. **Servir l'archive via `tauri://localhost` ne fonctionne
donc pas.**

Contournement retenu et prouvé : embarquer l'archive comme ressource
(`bundle.resources`) et la lire par plages avec le plugin `fs`
(`apps/client/src/lib/tauriPmtilesSource.ts`). C'est plus proche de ce que ferait une
application locale de toute façon.

### Piège de concurrence à retenir

Un `seek` suivi d'un `read` sont deux allers-retours sur **un curseur partagé**, et
MapLibre demande plusieurs tuiles simultanément. Sans sérialisation des accès, les seeks
s'entrelacent et chaque lecture reçoit les octets d'une autre plage; le symptôme
apparaît très loin de la cause, sous la forme d'une tuile corrompue (« Extra bytes past
the end »). La source sérialise donc ses lectures.

### Validation de la fixture

Indépendamment du spike, `apps/client/src/lib/__tests__/pmtilesFixture.test.ts` vérifie
l'en-tête v3, le type MVT, la couche déclarée et la taille. Les tuiles ont par ailleurs
été parsées avec `@mapbox/vector-tile` : 7 tuiles sur 7 décodées avec la couche
`countries` peuplée.

## Exécution non assistée

La sonde carte s'exécute au démarrage et écrit son verdict dans la table
`probe_verdicts` de la base du spike. Les smoke tests Windows, iOS et Android pourront
donc lire le résultat sans piloter d'interface :

```sh
sqlite3 "<app data>/hap-r3-a-spike.sqlite" \
  "SELECT verdict FROM probe_verdicts WHERE probe='offline-map';"
```

## iOS simulator (2026-08-03) : PASS

iPhone 17 Pro, runtime iOS 26.3.1, build `tauri ios build --target aarch64-sim`,
installé et lancé via `simctl`. Verdict relu dans le conteneur de l'application :

```json
{ "ok": true, "sourceFeatures": 48, "renderedFeatures": 3,
  "blockedRequests": [], "transport": "tauri-fs" }
```

- **Carte hors-ligne : PASS** — 48 entités décodées, 3 peintes, aucune requête réseau.
  L'archive est lue depuis le bundle de l'app
  (`…/HAP Tauri Spike.app/assets/fixtures/r3a-countries.pmtiles`).
- **SQLite : PASS** — la table `probe_verdicts` est créée et écrite par l'application
  elle-même; sans SQLite fonctionnel il n'y aurait aucun verdict à lire.
- **Vault : contrôle de capacité PASS, avec une contrainte majeure** — voir la section
  dédiée ci-dessous.

Moins d'entités que sur macOS (48 contre 87) simplement parce que la fenêtre est plus
petite : moins de tuiles sont dans le champ de vue.

## Android emulator (2026-08-03) : PASS

AVD `Medium_Phone_API_36.1` (API 36.1), APK debug universel installé via `adb`.

```json
{ "ok": true, "sourceFeatures": 48, "renderedFeatures": 3,
  "blockedRequests": [], "transport": "tauri-fs" }
```

- **Carte hors-ligne : PASS**, **SQLite : PASS**, **Vault : capacité vérifiée** — mêmes
  conclusions qu'iOS.
- **Différence de plateforme à noter :** `resolveResource` renvoie ici
  `asset://localhost/fixtures/r3a-countries.pmtiles`, une URI et non un chemin de
  système de fichiers. Le plugin `fs` l'ouvre et la lit par plages sans adaptation :
  la même source PMTiles fonctionne donc sur les trois plateformes malgré des formes
  d'adresse différentes.
- L'identifiant du paquet installé porte le suffixe `.debug`
  (`android.debugApplicationIdSuffix`), à savoir pour les scripts de smoke.

## Reproduire les builds mobiles

Les projets `gen/apple` et `gen/android` ne sont pas versionnés : ce sont des
échafaudages de build (855 Mo), régénérés à l'identique par `init`.

```sh
export PATH="$HOME/.cargo/bin:$PATH"          # rustup, pas le rust Homebrew
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.0.12077973"
export JAVA_HOME="/opt/homebrew/opt/openjdk@17"

pnpm --dir apps/desktop tauri ios init
pnpm --dir apps/desktop tauri ios build --target aarch64-sim   # au premier plan

pnpm --dir apps/desktop tauri android init
pnpm --dir apps/desktop tauri android build --debug --target aarch64
```

## Vault sur mobile : le sélecteur de dossier n'existe pas

Contrôle non assisté exécuté sur les trois plateformes le 2026-08-03.

| Plateforme | Écriture en stockage applicatif | Sélecteur de dossier |
| --- | --- | --- |
| macOS | PASS (aller-retour UTF-8) | **supporté** |
| iOS 26.3.1 | PASS (aller-retour UTF-8) | **non supporté** |
| Android 36.1 | PASS (aller-retour UTF-8) | **non supporté** |

Message renvoyé par le plugin sur les deux plateformes mobiles :

```
Folder picker is not implemented on mobile
```

**Conséquence pour l'architecture, à trancher avant R3-B.** Le vault du bureau repose sur
un dossier arbitraire choisi par l'utilisateur — typiquement un dossier Obsidian ou un
dossier synchronisé. Cette notion **n'existe pas** sur iOS ni Android avec la pile
actuelle. Le mobile peut écrire du Markdown, mais uniquement dans le stockage propre à
l'application, invisible aux autres applications et supprimé avec elle.

Les options se limitent donc à :

1. **Vault en stockage applicatif sur mobile**, avec import/export explicite. Simple,
   mais le vault mobile n'est plus le même objet que celui du bureau.
2. **Passer par le sélecteur de documents du système** (`UIDocumentPicker` sur iOS,
   Storage Access Framework sur Android) via un plugin Tauri à écrire ou à trouver. Les
   accès y sont accordés par URI, souvent limités dans le temps, et se réautorisent — ce
   n'est pas un chemin de système de fichiers stable.
3. **Vault desktop uniquement**, le mobile étant en lecture/consultation.

Le spec exige de consigner la contrainte plutôt que de simuler les sémantiques du bureau;
c'est fait ici. **Le choix reste ouvert et conditionne la conception du vault.**

## Chaîne d'outils mobile : ce qu'il a fallu

Rien de tout cela ne relève de Tauri ni du code du spike, mais tout a bloqué un build :

- **Rust doit venir de rustup**, pas de Homebrew : la formule ne fournit que la cible
  hôte, sans bibliothèques standard iOS/Android.
- **`tauri ios build` doit tourner au premier plan.** Le script Xcode « Build Rust Code »
  se connecte en WebSocket au CLI parent; détaché, la connexion est refusée et le build
  échoue en `Abort trap: 6`.
- **Le runtime simulateur doit exister**, et `xcodebuild -downloadPlatform iOS` installe
  toujours la dernière version, sans possibilité de cibler. SDK 26.2 + runtime 26.3.1
  fonctionne.
- **Gradle 8.14.3 refuse les JDK trop récents** : JDK 26 donne « Unsupported class file
  major version 70 ». JDK 17 fonctionne. Le cask Temurin exige sudo; la formule
  `openjdk@17` non.

## Windows : SUPPOSÉ, NON TESTÉ

Décision prise le 2026-08-03 : Windows n'est pas exécuté. **Ce n'est pas une preuve** et
le dossier ne le compte pas comme telle — mais le risque résiduel est faible et il a
beaucoup baissé depuis.

Ce qui rassure : les trois capacités passent désormais sur **trois moteurs de webview
distincts** — WKWebView (macOS et iOS) et le WebView Android (Chromium). MapLibre, WebGL,
le plugin SQLite et la lecture par plages du plugin `fs` fonctionnent donc déjà sur du
Chromium, qui est ce que Windows utilise via WebView2. Le contournement adopté ne dépend
d'ailleurs pas du protocole applicatif, puisqu'il lit le fichier nativement.

Ce qui reste néanmoins non vérifié :

- WebView2 est un Chromium distinct de celui d'Android, avec sa propre pile graphique;
  l'accélération WebGL sous Windows dépend du pilote et bascule parfois sur un rendu
  logiciel.
- Les chemins de ressources et la portée `fs` y ont une autre forme — Android a déjà
  montré une troisième forme (`asset://localhost/...`), donc cette partie varie
  réellement d'une plateforme à l'autre.

## État de la matrice

| Cible | Build | SQLite | Vault | PMTiles hors-ligne |
| --- | --- | --- | --- | --- |
| macOS | PASS | PASS | PASS | PASS |
| iOS simulator | PASS | PASS | capacité vérifiée (contrainte) | PASS |
| Android emulator | PASS | PASS | capacité vérifiée (contrainte) | PASS |
| Windows | supposé | supposé | supposé | supposé |

Une seule réserve subsiste côté exécution : Windows n'a pas été testé (décision du
2026-08-03), avec un risque résiduel jugé faible depuis qu'Android valide la pile sur un
webview Chromium.

Le contrôle de capacité du vault mobile est fait, et il est concluant au sens du spec :
il a **révélé une contrainte** qui n'invalide pas la faisabilité de Tauri, mais qui
impose un choix d'architecture pour le vault mobile avant R3-B.
