# DFLelev v2.0 — AI Context README

> **Til AI-assistenter:** Læs hele dette dokument før du foreslår kodeændringer. Opdater denne fil ved ændringer: tilføj nye/slettede filer, endpoints, dataflow og dependencies. Changelog og slettede filler må kun indeholde info fra den **nyeste** version — slet ældre versioner.

---

## Stack

- Node.js 18+, Express 4.18.2
- SQLite 3 + Prisma ORM 5.20.0
- React (Vite), Tailwind CSS
- Monorepo (npm workspaces)

---

## Projekt Struktur

```
/home/oskar/DFLelev/
├── package.json              # Root (workspaces: server, web)
├── node_modules/             # Shared dependencies
├── create-admin.cjs          # Script til at oprette første admin-bruger
│
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/
│
├── server/                   # Backend
│   ├── package.json
│   ├── index.js              # Express app, health/NAS-endpoints
│   ├── middleware/
│   │   ├── auth.js           # Session-token middleware
│   │   └── upload.js         # Multer config
│   └── routes/
│       ├── auth.js           # /api/auth/*
│       ├── boxes.js          # /api/boxes/*
│       ├── files.js          # /api/files/*
│       └── admin.js          # /api/admin/* + /api/admin/roller/*
│
└── web/                      # Frontend (React/Vite)
    ├── package.json
    ├── public/
    └── src/
        ├── context/
        │   ├── AuthContext.jsx
        │   └── AdminContext.jsx
        ├── components/
        │   ├── AccessKeyPanel.jsx
        │   ├── Layout/
        │   │   └── Navigation.jsx
        │   └── Mindmap/
        │       ├── MindmapCanvas.jsx
        │       ├── InfoPanel.jsx
        │       ├── DefaultNode.jsx
        │       ├── GroupNode.jsx
        │       └── MindmapData.js
        ├── utils/
        │   └── fileService.js    # API-kald til filer (bruger 'dfl_token' fra localStorage)
        └── pages/
            ├── Arkiv.jsx
            ├── Ressourcer.jsx
            ├── BoxDetail.jsx
            ├── OpretKonto.jsx
            ├── Mindmap.jsx
            ├── Brugere.jsx
            └── RettighederAdmin.jsx
```

---

## Storage (filesystem via env)

```
${DFLELEV_STORAGE_ROOT:-./storage}/
├── database/
│   └── dflelev.db
└── Fysiske filer/
    ├── Arkiv/
    │   └── <box-id>/
    │       ├── fil.pdf
    │       └── Undermappe/
    └── Ressourcer/
        └── <box-id>/
```

- Ingen `.meta.json` sidecar-filer — alt metadata er i databasen.
- Systemet kræver en gyldig storage-sti. Sæt `DFLELEV_STORAGE_ROOT` eller brug standard `./storage`.

---

## Database (SQLite + Prisma)

**Placering:** `${DFLELEV_STORAGE_ROOT:-./storage}/database/dflelev.db`

**Tabeller:**

*Brugere & Auth:*
- `User` — navn, email, kodeHash, aargang, kollegie, aktiv, godkendt
- `UserAuthority` — bruger-roller (felt: `rolle`)
- `Session` — login-tokens (token, userId, udloeber)
- `Permission` — rolle-rettigheder som JSON (`{"Undergrunden": ["kp:log", ...]}`)
- `ActivityLog` — hændelseslog (LOGIN, UPLOAD_FIL, osv.)
- `RedFlag` — sikkerhedsadvarsler på brugere

*Filer:*
- `Box` — kasser (id, category, titel, beskrivelse, farve, fysiskSti)
- `Folder` — mapper (boxId, navn, sti, parentId)
- `File` — filer (boxId, folderId, filnavn, sti, mimeType, stoerrelse, tags)

*Roller:*
- `Rolle` — rolle-katalog med soft-delete (slettet, sletAnmodetAf, sletBekraeftet, oprettetAfId)

*Statistik:*
- `StorageStats` — storage-statistik per kategori

**Hashing:** `sha256(kode + 'dfl_salt_2025')` — defineret i `auth.js` og `create-admin.cjs`.

**Bruger ID-format:** `"timestamp_xxxxx"` (genereres i `create-admin.cjs`).

---

## API Endpoints

**Auth `/api/auth/*`**
- `POST /opret` — opret bruger (afventer godkendelse)
- `POST /login` — log ind
- `POST /logout` — log ud
- `GET /mig` — hent aktuel bruger
- `GET /rettigheder` — hent alle rolle-rettigheder
- `PUT /admin/rettigheder` — opdater rettigheder (admin)

**Boxes `/api/boxes/*`**
- `GET /?category=arkiv&q=term` — list boxes (inkl. dyb søgning i mapper/filer via `q`)
- `GET /:id` — hent én box
- `POST /` — opret box
- `PUT /:id` — opdater box
- `DELETE /:id` — slet box

**Files `/api/files/*`**
- `POST /upload` — upload filer
- `GET /sync/:boxId` — sync database med disk
- `GET /:boxId/*` — download fil
- `DELETE /:boxId/*` — slet fil/mappe
- `POST /create-folder` — opret mappe
- `PUT /rename` — omdøb fil/mappe
- `PUT /metadata/folder` — opdater mappe-metadata (titel, beskrivelse, billede)
- `PUT /metadata/file` — opdater fil-metadata (titel, beskrivelse, tags)

**Admin `/api/admin/*`**
- `GET /afventer` — ventende brugere
- `POST /godkend/:id` — godkend bruger
- `POST /afvis/:id` — afvis bruger
- `GET /brugere` — alle brugere
- `PUT /bruger/:id` — rediger bruger
- `GET /log/:userId` — bruger-log
- `GET /roedt-flag` — røde flag
- `PUT /roedt-flag/:id/resolve` — løs rødt flag
- `GET /stats` — system-statistik

**Rolle-management `/api/admin/roller/*`**
- `GET /` — aktive roller (ekskl. Admin/Owner)
- `GET /alle` — alle inkl. soft-slettede
- `POST /sync` — sync fra UserAuthority
- `POST /` — opret ny rolle
- `PUT /:id/omdoeb` — omdøb + opdater overalt
- `POST /:id/anmod-slet` — direkte soft-delete (ingen ekstra godkendelse)
- `POST /:id/bekraeft-slet` — legacy endpoint (beholdt for bagudkompatibilitet)
- `POST /:id/annuller-slet` — annuller sletnings-anmodning
- `POST /:id/gendan` — gendan soft-slettet rolle

**System**
- `GET /api/health`
- `GET /api/nas-status`

---

## Vigtige Implementeringsdetaljer

- `fileService.js` læser token fra `localStorage` under nøglen `'dfl_token'`
- Admin/Owner (`intern: true`) ekskluderes fra myndigheder-dropdown i `OpretKonto.jsx`
- `BoxDetail.jsx` bruger `/api/files/sync/:boxId` til fillister — ingen `.meta.json`
- "Mere info" på Arkiv/Ressourcer vises både som samlet panel og per-kasse (undermapper, filer, størrelse)
- Box-søgning understøtter dyb (rekursiv) match mod box, mapper og filer via backend
- Nøgle-objekter på kasse-niveau registreres automatisk i Permission-systemet (`rolle: box:<id>`) ved oprettelse/opdatering og fjernes ved sletning
- Nøgle-panelet bruger samme aktive roller som Rettigheder & Roller og ligger over topmenuen via højere z-index
- `RettighederAdmin.jsx` har to faner: "🔑 Rettigheder" og "🏷️ Rolle-katalog"
- Kaldenavn er valgfrit ved oprettelse/profil-redigering; hvis tomt autogenereres det som: første ord + initialer for efterfølgende ord + punktum (fx `Oskar Hansen Madsen` → `OskarHM.`)

### Mindmap nøglefunktion (hvilke filer en AI skal bede om)
- `web/src/components/Mindmap/MindmapCanvas.jsx`:
  - top-toolbar med admin-tools, "📝 Rediger tekst" og 🔑 for "Mindmap kontrol"
  - gem/indlæsning af `accessControl` sammen med noder/kanter
  - rolle-evaluering for hvem der må bruge admin-tools
- `web/src/components/Mindmap/InfoPanel.jsx`:
  - node-sidepanel med 🔑 pr. node (ikke grupper/forbindelser)
  - rolle-styring for: `Rediger indhold`, `Rediger farve`, `Slet node`, `Rediger association`
- `web/src/context/AuthContext.jsx`:
  - aktuelle brugerroller (`bruger.myndigheder`) og admin/owner-check (`erAdmin`)
- `web/src/context/AdminContext.jsx`:
  - admin-mode toggle (`isAdmin`) og tekst-redigeringstilstand (`isEditingText`)

---

## Kommandoer

```bash
# Start
npm run dev                  # Start backend + frontend

# Database
npm run db:push              # Opret/opdater database (dev)
npm run db:migrate           # Kør migration (prod)
npm run db:studio            # Åbn Prisma Studio
npm run db:generate          # Generer Prisma client

# Workspaces
npm run dev -w server        # Kun backend
npm run dev -w web           # Kun frontend
```

**Første gang:**
```bash
cd /home/oskar/DFLelev
npm install
sudo mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/database"
sudo mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/Fysiske filer/Arkiv"
sudo mkdir -p "${DFLELEV_STORAGE_ROOT:-./storage}/Fysiske filer/Ressourcer"
sudo chown -R $USER:$USER "/mnt/koala/DFLelev akiv"
npm run db:push
node create-admin.cjs
npm run dev
```

**Standard login:** email `admin@dflelev.local`, kode `admin123`

---

## Troubleshooting

| Problem | Løsning |
|---|---|
| `Cannot find module @prisma/client` | `npm run db:generate && npm install` |
| `Database locked` | `pkill -f "node.*index.js" && npm run dev` |
| `Port 3001 in use` | `lsof -i :3001` → `kill -9 <PID>` |
| Storage-sti ikke tilgængelig | `ls -la "/mnt/koala/DFLelev akiv"` → opret mapper, chown |
| `Cannot find module` generelt | `rm -rf node_modules */node_modules && npm install` |

**Rollback:**
```bash
pkill -f node
rm -rf /home/oskar/DFLelev
mv /home/oskar/DFLelev.backup.YYYYMMDD /home/oskar/DFLelev
cd /home/oskar/DFLelev/DFLelev_nas && node server.js
```

---

## Changelog — Nyeste Version

### Version 2.0.5 — 2026-02-18
**Status: KLAR TIL BRUG**

**web/src/pages/BoxDetail.jsx**
- BUGFIX: Rettet JSX syntax fejl på linje 482-494 — to betingede blokke manglede åbningsbetingelse
- Rettet til: `{!nasStatus.online && (` for NAS-offline-banner

**prisma/schema.prisma**
- Tilføjet `Rolle`-model med soft-delete support (id, navn, slettet, slettetDato, sletAnmodetAf, sletBekraeftet, oprettet, oprettetAfId)
- Kør `npm run db:push` efter opdatering

**server/routes/admin.js**
- Tilføjet 9 nye rolle-management endpoints under `/api/admin/roller/*` (se API-sektion)

**web/src/pages/RettighederAdmin.jsx**
- Tilføjet "🏷️ Rolle-katalog"-fane: fuld CRUD, to-admin-sletningsflow, sync-knap, gendan

**web/src/pages/OpretKonto.jsx**
- Admin/Owner ekskluderes fra myndigheder-dropdown
- Tomme sektioner filtreres automatisk væk

**Arbejdsprocedure for denne version:**
```bash
# Flyt filer fra ~/Downloads/
cp ~/Downloads/BoxDetail.jsx web/src/pages/BoxDetail.jsx
cp ~/Downloads/OpretKonto.jsx web/src/pages/OpretKonto.jsx
cp ~/Downloads/RettighederAdmin.jsx web/src/pages/RettighederAdmin.jsx
cp ~/Downloads/admin.js server/routes/admin.js
npm run db:push
```

*Sidst opdateret: 2026-02-18 — Version 2.0.5*
