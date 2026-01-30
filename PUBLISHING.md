# 🚀 NPM Publishing Guide: electron-pinia-sync (v2026 Edition)

## 1. Sicherheit & Accounts

### NPM Account & Granular Token

1. Logge dich auf [npmjs.com](https://www.npmjs.com/) ein.
2. Gehe zu **Access Tokens** -> **Generate New Token** -> **Granular Access Token**.
3. **Konfiguration:**
* **Token Name:** `github-actions-publish`
* **Expiration:** 365 Tage (oder nach Bedarf)
* **Permissions:** Read and Write für das Package `electron-pinia-sync`.


4. Kopiere den Token sofort.

### GitHub Secrets hinterlegen

1. Gehe in dein GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Erstelle ein neues Secret:
* **Name:** `NPM_TOKEN`
* **Value:** Dein Granular Token von oben.



---

## 2. Automatisierter Workflow (GitHub Actions)

Erstelle die Datei `.github/workflows/publish.yml`, damit Veröffentlichungen sicher und mit **Provenance** (Echtheitszertifikat) erfolgen:

```yaml
name: Publish to NPM
on:
  release:
    types: [created]

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write # Zwingend erforderlich für Provenance
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
      - run: npm test
      - run: npm run build
      
      # Veröffentlicht mit SLSA Provenance (Sicherheitsstandard 2026)
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

```

---

## 3. Die erste Veröffentlichung (Manueller Check)

Bevor die Automatisierung übernimmt, solltest du einmalig manuell prüfen:

### Schritt 1: Lokales Login & Dry-Run

```bash
npm login
npm run build
npm publish --dry-run

```

*Prüfe in der Ausgabe:* Sind alle Dateien im `dist/` Ordner enthalten? Ist die `package.json` korrekt?

### Schritt 2: Erstmaliger Push

```bash
# Falls es ein Scoped Package ist (@dein-user/name):
npm publish --access public --provenance

```

---

## 4. Laufende Updates (Best Practice)

Verwende für Updates immer den Git-getriebenen Workflow. Das stellt sicher, dass Git-Tags und NPM-Versionen synchron sind.

### Variante A: Der saubere Weg (CLI)

1. **Änderungen committen:** `git add . && git commit -m "feat: sync improvements"`
2. **Version erhöhen:**
* `npm version patch` (Bugfixes: 1.0.0 -> 1.0.1)
* `npm version minor` (Features: 1.0.0 -> 1.1.0)
* `npm version major` (Breaking Changes: 1.0.0 -> 2.0.0)


3. **Pushen:** `git push && git push --tags`
4. **Release erstellen:** Gehe auf GitHub zu "Releases" und erstelle ein neues Release basierend auf dem neuen Tag. **Die GitHub Action erledigt den Rest.**

---

## 5. Checkliste vor jedem Release

* [ ] **SemVer:** Habe ich die richtige Versionsnummer gewählt (Major/Minor/Patch)?
* [ ] **Build:** Läuft `npm run build` ohne Fehler durch?
* [ ] **Tests:** Bestehen alle `vitest` oder `playwright` Tests?
* [ ] **Types:** Sind die `.d.ts` Dateien im `dist/` Verzeichnis vorhanden?
* [ ] **README:** Sind neue Optionen oder IPC-Events dokumentiert?

---

## 6. Troubleshooting 2026

| Problem | Lösung |
| --- | --- |
| **"Provenance-Fehler"** | Stelle sicher, dass `id-token: write` in der GitHub Action gesetzt ist. |
| **"OTP required"** | NPM erzwingt 2FA. Bei CLI-Publish musst du den Code vom Handy eingeben. |
| **"403 Forbidden"** | Dein Granular Token ist abgelaufen oder hat keine Berechtigung für dieses Package. |
| **"Version conflict"** | Die Version in `package.json` wurde bereits veröffentlicht. Nutze `npm version`. |
