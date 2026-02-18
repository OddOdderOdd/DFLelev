# DFLelev - System Arkitektur v2.0.4

---

## Retningslinjer for videreudvikling

- **Læsning:** Hele dette dokument skal læses og forstås, før der foreslås kodeændringer.
- **Opdatering:** Ved ændringer i projektet skal denne fil opdateres med nye/slettede filer, endpoints, dataflow og dependencies. Tilføj opdateringsdato nederst.
- **Installation:** Der skal altid leveres ready-to-copy bash kommandoer til installation af nye dependencies eller flytning af filer.
- **Changelog:** Changelog-sektionen nederst må udelukkende indeholde den nyeste version. Slet gamle versioner.

---

## 1. Projekt Struktur (Monorepo v2.0)

/home/oskar/DFLelev/
├── package.json              # Root package (workspaces)
├── node_modules/             # SHARED dependencies
│
├── prisma/                   # Database
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Migration history
│
├── server/                   # Backend
│   ├── package.json
│   ├── index.js              # Main server
│   ├── middleware/
│   │   ├── auth.js          # Auth middleware
│   │   └── upload.js        # Multer config
│   └── routes/
│       ├── auth.js          # /api/auth/*
│       ├── boxes.js         # /api/boxes/*
│       ├── files.js         # /api/files/*
│       └── admin.js         # /api/admin/*
│
├── web/                      # Frontend
│   ├── package.json
│   ├── src/
│   ├── public/
│   └── ...
│
└── create-admin.cjs          # Admin bruger script

---

## 2. Storage Structure (NAS ONLY - NO FALLBACK)

### NAS Structure:
/mnt/koala/DFLelev akiv/           # NAS root 
├── database/
│   └── dflelev.db                 # SQLite database
│
└── Fysiske filer/                 # Alle filer under én mappe
    ├── Arkiv/                     # Arkiv boxes
    │   ├── box-id-1/
    │   │   ├── fil1.pdf
    │   │   ├── fil2.docx
    │   │   └── Undermappe/
    │   │       └── fil3.txt
    │   └── box-id-2/
    │
    └── Ressourcer/                # Ressource boxes
        └── box-id-3/

VIGTIGT: 
- INGEN lokal fallback - systemet kræver NAS
- Ingen .meta.json sidecar filer
- Alt metadata i database
- Kun fysiske filer på NAS under "Fysiske filer/"

---

## 3. Database (SQLite + Prisma)

### Database Location:
/mnt/koala/DFLelev akiv/database/dflelev.db

### Tables:

Users & Auth:
- User - Brugere (navn, telefon, kodeHash, aargang, kollegie, etc.)
- UserAuthority - Bruger myndigheder (Admin, Owner, Undergrunden, etc.)
- Session - Login sessions (token, userId, udloeber)
- Permission - Rolle rettigheder (JSON: {"Undergrunden": ["kp:log", ...]})
- ActivityLog - Aktivitets logs (LOGIN, UPLOAD_FIL, etc.)
- RedFlag - Sikkerhedsflag (bruger advarsler)

File System:
- Box - Kasser (id, category, titel, beskrivelse, farve, fysiskSti)
- Folder - Mapper (boxId, navn, titel, sti, parentId)
- File - Filer (boxId, folderId, filnavn, titel, sti, mimeType, stoerrelse, tags)

Statistics:
- StorageStats - Storage statistik per kategori

---

## 4. API Endpoints

Auth (/api/auth/*):
- POST /api/auth/opret - Opret bruger (afventer godkendelse)
- POST /api/auth/login - Log ind
- POST /api/auth/logout - Log ud
- GET /api/auth/mig - Hent nuværende bruger
- GET /api/auth/rettigheder - Hent alle rolle-rettigheder
- PUT /api/auth/admin/rettigheder - Opdater rettigheder (admin)

Boxes (/api/boxes/*):
- GET /api/boxes?category=arkiv - List boxes
- GET /api/boxes/:id - Hent én box
- POST /api/boxes - Opret box
- PUT /api/boxes/:id - Opdater box
- DELETE /api/boxes/:id - Slet box

Files (/api/files/*):
- POST /api/files/upload - Upload filer
- GET /api/files/sync/:boxId - Sync database med disk
- GET /api/files/:boxId/* - Download fil
- DELETE /api/files/:boxId/* - Slet fil/mappe
- POST /api/files/create-folder - Opret mappe
- PUT /api/files/rename - Omdøb fil/mappe

Admin (/api/admin/*):
- GET /api/admin/afventer - Hent ventende brugere
- POST /api/admin/godkend/:id - Godkend bruger
- POST /api/admin/afvis/:id - Afvis bruger
- GET /api/admin/brugere - Hent alle brugere
- PUT /api/admin/bruger/:id - Rediger bruger
- GET /api/admin/log/:userId - Hent bruger log
- GET /api/admin/roedt-flag - Hent røde flag
- PUT /api/admin/roedt-flag/:id/resolve - Løs rødt flag
- GET /api/admin/stats - System statistik

Rolle-management (/api/admin/roller/*):
- GET /api/admin/roller - Aktive roller (ekskl. Admin/Owner)
- GET /api/admin/roller/alle - Alle roller inkl. soft-slettede
- POST /api/admin/roller/sync - Sync roller fra UserAuthority
- POST /api/admin/roller - Opret ny rolle
- PUT /api/admin/roller/:id/omdoeb - Omdøb rolle (opdaterer overalt)
- POST /api/admin/roller/:id/anmod-slet - Trin 1: Anmod om sletning
- POST /api/admin/roller/:id/bekraeft-slet - Trin 2: Bekræft sletning (ANDEN admin)
- POST /api/admin/roller/:id/annuller-slet - Annuller sletnings-anmodning
- POST /api/admin/roller/:id/gendan - Gendan soft-slettet rolle

System:
- GET /api/health - Health check
- GET /api/nas-status - NAS status

---

## 5. Sådan Startes Systemet

Første Gang Setup:

```bash
# 1. Installer dependencies
cd /home/oskar/DFLelev
npm install

# 2. Opret NAS placeholder struktur
sudo mkdir -p "/mnt/koala/DFLelev akiv/database"
sudo mkdir -p "/mnt/koala/DFLelev akiv/Fysiske filer/Arkiv"
sudo mkdir -p "/mnt/koala/DFLelev akiv/Fysiske filer/Ressourcer"
sudo chown -R $USER:$USER "/mnt/koala/DFLelev akiv"

# 3. Opret database
npm run db:push

# 4. Opret admin bruger
node create-admin.cjs

# 5. Start development
npm run dev

Daglig Brug:
Bash

cd /home/oskar/DFLelev
npm run dev

Login credentials:

    Telefon: 00000000

    Kode: admin123

6. Utilities

Cleanup Script:
Bash

npm run cleanup

Database Admin:
Bash

npm run db:studio

7. Troubleshooting

Problem: "Cannot find module @prisma/client"
Bash

npm run db:generate
npm install

Problem: "Database locked"
Bash

pkill -f "node.*index.js"
npm run dev

Problem: "NAS ikke tilgængelig"
Bash

ls -la "/mnt/koala/DFLelev akiv"
sudo mkdir -p "/mnt/koala/DFLelev akiv/database"
sudo mkdir -p "/mnt/koala/DFLelev akiv/Fysiske filer/Arkiv"
sudo mkdir -p "/mnt/koala/DFLelev akiv/Fysiske filer/Ressourcer"
sudo chown -R $USER:$USER "/mnt/koala/DFLelev akiv"

Problem: "Port 3001 already in use"
Bash

lsof -i :3001
kill -9 <PID>

8. Changelog - Nyeste Version

Version 2.0.3 - 2026-02-17
Status: KLAR TIL BRUG

Ændringer:

create-admin.cjs:
    - Genererer korrekt bruger ID (format: "timestamp_xxxxx")
    - Korrekt salt ved hashing: sha256(kode + 'dfl_salt_2025') - matcher auth.js
    - UserAuthority bruger felt 'rolle' (ikke 'myndighed')
    - Aktiverer og godkender bruger automatisk
    - Opdaterer eksisterende bruger hvis telefonnummer allerede findes

web/src/utils/fileService.js:
    - Rettet token key: læser 'dfl_token' fra localStorage (ikke 'authToken')
    - Rettet alle fetch-kald fra ugyldigt tagged template syntax til fetch(url, options)
    - Tilføjet authHeaders() hjælpefunktion for konsistent token-håndtering
    - Token sendes nu korrekt med alle requests

9. Næste Skridt

Fremtidige opgaver:

    Features (Søgning, thumbnails, PDF preview)

Sidste opdatering: 2026-02-17 - Version 2.0.3

---

## 8. Changelog - Nyeste Version

Version 2.0.5 - 2026-02-18
Status: KLAR TIL BRUG

Ændringer:

web/src/pages/BoxDetail.jsx:
    - BUGFIX: Rettet JSX syntax fejl på linje 482-494
    - To betingede blokke manglede deres åbningsbetingelse `{condition && (`
    - Rettet til: `{!nasStatus.online && (` for NAS-offline-banner

prisma/schema.prisma:
    - Tilføjet ny `Rolle` model med soft-delete support:
      - id, navn (unique), slettet, slettetDato, slettetAfId
      - sletAnmodetAf, sletAnmodetAt, sletBekraeftet (to-admin-bekræftelse)
      - oprettet, oprettetAfId
    - Migration: `npm run db:push` (development) eller `npm run db:migrate`

server/routes/admin.js:
    - Tilføjet 9 nye rolle-management endpoints under /api/admin/roller/*:
      - GET /api/admin/roller — alle aktive roller (ekskl. Admin/Owner)
      - GET /api/admin/roller/alle — inkl. soft-slettede
      - POST /api/admin/roller/sync — synkroniser fra UserAuthority til Rolle-tabel
      - POST /api/admin/roller — opret ny rolle manuelt
      - PUT /api/admin/roller/:id/omdoeb — omdøb + opdater UserAuthority + Permission overalt
      - POST /api/admin/roller/:id/anmod-slet — trin 1: anmod om sletning (opretter rødt flag)
      - POST /api/admin/roller/:id/bekraeft-slet — trin 2: ANDEN admin bekræfter soft-delete
      - POST /api/admin/roller/:id/annuller-slet — annuller sletnings-anmodning
      - POST /api/admin/roller/:id/gendan — rollback: gendan soft-slettet rolle

web/src/pages/RettighederAdmin.jsx:
    - Tilføjet ny "🏷️ Rolle-katalog" fane ved siden af "🔑 Rettigheder"
    - Fuld CRUD for roller: opret, omdøb (inline), slet (to-admin-flow), gendan
    - Afventende sletninger fremhævet med gul boks øverst
    - "Sync fra brugere"-knap synkroniserer alle unikke roller fra UserAuthority
    - Slettede roller kan vises/skjules og gendannes
    - Informationsboks forklarer to-admin-sletnings-flowet

web/src/pages/OpretKonto.jsx:
    - Admin/Owner (intern: true) ekskluderes nu fra myndigheder-dropdown
    - Tomme sektioner (overskrifter uden synlige items) filtreres automatisk væk
    - Brugere kan aldrig selv ansøge om Admin/Owner — kun admin-tildeling

ARBEJDSPROCEDURE:
    Filer til ~/Downloads/ — kør install.sh for at flytte:
    - ~/Downloads/BoxDetail.jsx → web/src/pages/BoxDetail.jsx
    - ~/Downloads/OpretKonto.jsx → web/src/pages/OpretKonto.jsx
    - ~/Downloads/RettighederAdmin.jsx → web/src/pages/RettighederAdmin.jsx
    - ~/Downloads/admin.js → server/routes/admin.js

    Derefter: tilføj Rolle-model til prisma/schema.prisma og kør:
    npm run db:push

    Test rolle-sync:
    1. Opret en bruger med en ny rolle (fx "Testrolle")
    2. Gå til /kontrolpanel/rettigheder → "Rolle-katalog"
    3. Klik "Sync fra brugere" — "Testrolle" dukker op
    4. Test omdøb, anmod-slet (Admin A), bekræft-slet (Admin B), gendan

Sidst opdateret: 2026-02-18 - Version 2.0.5
