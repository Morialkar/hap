# R3-A — Evidence bundle

Preuves reproductibles du spike Tauri 2 (voir [R3-A-TAURI-SPIKE.md](R3-A-TAURI-SPIKE.md)).
Aucune conclusion Go/No-go n'est déclarée tant que la matrice complète (macOS, Windows,
iOS, Android) et la preuve PMTiles hors-ligne ne sont pas couvertes.

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

## macOS — PMTiles hors-ligne : NON EXÉCUTÉ

Fixture PMTiles et sonde carte non implémentées à ce jour. Bloquant pour toute
conclusion, y compris un go conditionnel.

## Cibles restantes

Windows, iOS simulator, Android emulator : non exécutées.
