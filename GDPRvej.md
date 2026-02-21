# GDPRvej

## Hvad vi har gjort nu (første realistiske skridt)

1. **Skiftet login-identitet fra telefonnummer til e-mail**
   - Backend validerer og normaliserer e-mail (`lowercase + trim`).
   - Frontend formularer for login, oprettelse, verify og brugerstyring er opdateret til e-mail.

2. **Reduceret eksponering af persondata i sikkerhedslogs**
   - Rå IP-adresser gemmes ikke længere i login-relaterede aktivitetslogs.
   - IP anonymiseres via hash (`ipHash`) i relevante loghændelser.

3. **Gjort storage-sti konfigurerbar**
   - Hardcoded sti `/mnt/koala/DFLelev akiv/` er fjernet fra runtime-konfiguration.
   - Storage root styres nu via `DFLELEV_STORAGE_ROOT` (standard: `./storage`).

4. **Flyttet database-url til miljøvariabel**
   - Prisma bruger nu `DATABASE_URL` i stedet for hardcoded path.

5. **Opdateret admin-oprettelsesværktøj**
   - `create-admin.cjs` bruger nu e-mail i stedet for telefon.
   - Password hashing matcher serverens saltningsstrategi.

---

## Næste skridt (anbefalet rækkefølge)

1. **Dataminimering i DB**
   - Gennemgå felter (`note`, `detaljer`, fritekstfelter) og indfør klare regler for, hvad der må gemmes.

2. **Retention / slettepolitik**
   - Automatisk oprydning af gamle sessions, logs og flags efter faste retention-perioder.

3. **Data subject rights (DSAR)**
   - Implementér flows til indsigt, rettelse, eksport og sletning af persondata.

4. **Samtykke og transparens**
   - Tilføj privatlivstekst og tydelig info om hvilke data der indsamles og hvorfor.

5. **Sikkerhedsforbedringer**
   - Overvej stærkere password hashing (Argon2/bcrypt), rate limiting, og bedre audit af admin-handlinger.

6. **Adgangsbegrænsning**
   - Stram visning af personfelter i UI efter rolle/hierarki (need-to-know).

---

## Hvilke muligheder der er

### Mulighed A: Hurtig pragmatisk vej
- Fokus på low-risk forbedringer uden store schema-migrationer.
- Fordel: hurtig levering.
- Ulempe: efterlader teknisk gæld i datamodellen.

### Mulighed B: Kontrolleret migrering
- Fuldt migreringsforløb med Prisma migrationer, datamigrering fra telefon->email, retention jobs og DSAR endpoints.
- Fordel: robust fundament.
- Ulempe: kræver mere tid og test.

### Mulighed C: Compliance-first roadmap
- Kombinér B med juridisk review, DPIA-light, databehandleraftaler, cookie/session-politik og incident playbook.
- Fordel: stærk governance.
- Ulempe: størst omkostning.

---

## Bemærkning
Dette er **ikke juridisk rådgivning**, men tekniske forbedringer mod bedre GDPR-compliance.
