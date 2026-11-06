# Proof: latviešu valodas gramatikas labotājs

RTU kursa prototips. Lietotājs ielīmē latviešu tekstu, Gemini (vai izvēlētais Claude modelis) to izlabo, un katrs labojums tiek iezīmēts un paskaidrots. Katram kontam ir 3 bezmaksas pārbaudes, pēc tam vajag ikmēneša abonementu (Stripe).

- `client/`: tīmekļa lietotne (React, Vite)
- `server/`: API serveris (Express, MongoDB, Gemini/Claude, Stripe)
- `shared/`: tipi, kas kopīgi abiem

---

## Uzstādīšana soli pa solim

Stripe izmanto testa režīmu. Gemini API sākumā var izmantot ar bezmaksas plānu tā limitos; maksas plānā vai ar Claude API modeļa izsaukumi var radīt izmaksas.

### 1. Programmas

Uzinstalē:
- **Docker Desktop**: [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
- **Node.js 22.22 vai jaunāks**: [nodejs.org](https://nodejs.org). Vajadzīgs šifrēšanas atslēgas ģenerēšanai (6. solis).

```bash
docker --version
node -v
```

### 2. Projekta mape

Mapes nosaukums jāatstāj **`latvian-grammer-checker-main`**: Docker pēc tā nosauc datubāzi, un, ja nosaukums mainās, Docker izveido jaunu, tukšu datubāzi.

### 3. Clerk (pieteikšanās)

1. Izveidot lietotni [dashboard.clerk.com](https://dashboard.clerk.com).
2. **User & authentication**: ieslēgt **Email** un **Password**, e-pasta apstiprināšanu ar **kodu**.
3. **User model**: ieslēdgt **First and last name**, bet atstāt to **neobligātu**.
4. **API keys**: nokopēt **Publishable key** (`pk_test_...`) un **Secret key** (`sk_test_...`). Ja Clerk prasa IP adresi, ierakstīt `0.0.0.0/0`.

### 4. LLM API atslēga

#### 4.1 Gemini API atslēga

1. Atvērt [Google AI Studio](https://aistudio.google.com/apikey).
2. Izveidot API atslēgu un saglabāt to `.env` mainīgajā `GEMINI_API_KEY`. Atslēga vajadzīga tikai serverim.
3. AI Studio pārbaudīt projektam pieejamo modeļu un bezmaksas plāna limitus. Noklusētais modelis ir `gemini-3.8-flash`; to var mainīt ar `GEMINI_MODEL`.

#### 4.2 Claude API atslēga

1. [platform.claude.com](https://platform.claude.com)
2. **API keys**: izveidot atslēgu (`sk-ant-...`).

Bez atslēgas lietotne arī startē: īstās pārbaudes tad atbild "Valodas modelis nav pieslēgts", bet strādā **Testa režīms** (skat. 8. soli).

### 5. Stripe (maksājumi, testa režīmā)

Viss notiek ar ieslēgtu **Test mode**.
1. **Product catalog → Add product**: piemēram "Abonements", ar **Recurring / Monthly** cenu. Atvērt produktu, sadaļā **Pricing** uzklikšķināt uz cenas un nokopēt tās ID (**`price_...`**, !!! nevis `prod_...` !!!).
2. **Developers → API keys**: nokopēt **Secret key** (`sk_test_...`).

### 6. `.env` fails

1. Nokopēt paraugu:
   ```bash
   cp .env.example .env
   ```
2. Uzģenerēt šifrēšanas atslēgu:
   ```bash
   node -e "console.log(crypto.randomBytes(32).toString('base64'))"
   ```
3. Atvērt `.env` un aizpildīt:

| Mainīgais | Kur ņemt |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk, `pk_test_...` (3. solis) |
| `CLERK_SECRET_KEY` | Clerk, `sk_test_...` (3. solis) |
| `LLM_PROVIDER` | `gemini` (noklusējums); alternatīva ir `claude` |
| `GEMINI_API_KEY` | Google AI Studio (4. solis) |
| `ENCRYPTION_KEY` | 2. punkta komandas izvade |
| `STRIPE_SECRET_KEY` | Stripe, `sk_test_...` (5. solis) |
| `STRIPE_PRICE_ID` | Stripe, `price_...` (5. solis) |
| `STRIPE_WEBHOOK_SECRET` | pagaidām atstāt `whsec_xxx`, skatīt 7. soli |
| `COMPOSE_PROFILES` | atstāt `stripe` |

### 7. Palaišana

```bash
docker compose up -d --build
```

Pirmajā reizē iestatīt webhook atslēgu:
```bash
docker compose logs stripe
```
No rindas `Your webhook signing secret is whsec_...`, ielikt šo vērtību `.env` kā `STRIPE_WEBHOOK_SECRET` un pārstartēt lietotni:
```bash
docker compose up -d --force-recreate app
```

Atvēršanai izmantot **http://localhost:8080**.

### 8. Pārbaude

1. Reģistrēties ar īstu e-pastu (Clerk atsūtīs kodu).
2. Ievietot `es vakar gājam uz veikalu ,jo man vajag maizes.` un nospied "Pārbaudīt tekstu".
3. Pēc 3 pārbaudēm ceturtā paziņos, ka bezmaksas pārbaudes ir izmantotas.
4. **Iestatījumi → Abonements → Abonēt**, maksāt ar testa karti `4242 4242 4242 4242` (jebkurš nākotnes datums, jebkurš CVC). Atgriežoties statusam jābūt **Aktīvs**.
5. Ar karti `4000 0000 0000 0002` var redzēt noraidītu maksājumu.

**Testa režīms bez izmaksām.** Pārbaudes lapā poga **Testa režīms** ieliek fiksētu tekstu ar piecām zināmām kļūdām. "Pārbaudīt tekstu" tad neizsauc valodas modeli, dokuments saglabājas vēsturē kā parasti, un pārbaude netiek ieskaitīta 3 bezmaksas pārbaudēs, tāpēc tā strādā arī bez abonementa un bez API atslēgas. Teksts un labojumi ir `shared/demo.ts`. Vēlreiz nospiežot pogu, atgriežas tavs paša teksts.

### Apturēšana un atkārtota palaišana

```bash
docker compose down          # aptur visu, dati paliek
docker compose up -d         # palaiž atkal (bez koda izmaiņām)
docker compose up -d --build # palaiž ar jaunāko kodu
```
**Uzmanību:** `docker compose down -v` neizmantot, ja negrib izdzēst datu bāzi (konts saglabājas, jo tas tiek apstrādāts ar Clerk)

---

## Koda labošana (izstrāde)

Kad maini kodu, ērtāk ir `npm run dev`: izmaiņas parādās uzreiz, bez `--build`. Abus veidus nelaid vienlaicīgi ar to pašu Stripe CLI.

```bash
docker compose stop app stripe   # ja Docker versija darbojas
docker compose up -d mongo       # tikai datubāze
npm install                      # pirmajā reizē un pēc atkarību izmaiņām
npm run dev                      # serveris :3001, lietotne http://localhost:5173
```

Maksājumu testēšanai šajā režīmā vajag Stripe CLI uz paša datora ([instalācija](https://docs.stripe.com/stripe-cli)) atsevišķā terminālī:
```bash
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed
```
Bez `--events` jaunākās CLI versijas nestartē. `--all-thin` neder: serveris lasa klasiskos "snapshot" notikumus. Abonements aktivizējas arī bez webhook (lapa pēc maksājuma pati pajautā serverim), bet atjaunošana, atcelšana un neveiksmīgi maksājumi pienāk tikai caur webhook.

Komandas:

| Komanda | Ko dara |
|---|---|
| `npm run dev` | serveris un lietotne kopā, ar automātisku pārlādi |
| `npm run dev:server` / `npm run dev:client` | tikai viens no tiem |
| `npm run typecheck` | TypeScript pārbaude |
| `npm test` | servera testi. Ar `TEST_MONGODB_URI=mongodb://localhost:27017` palaiž arī datubāzes testus. |
| `npm run build` | lietotnes produkcijas būve |

---


## Claude

`.env` failā:
```
LLM_PROVIDER=claude
```
Pēc izmaiņas pārstartē (`docker compose up -d --force-recreate app` vai `npm run dev` no jauna). Servera logā redzams `Checking texts with claude (...)`. Bez tiem: `claude-opus-5-5`

---

## Kā darbojas pārbaude

1. `POST /api/documents` pārbauda tekstu (nav tukšs, ne vairāk par 20 000 rakstzīmēm), atļauj 10 pārbaudes minūtē vienam lietotājam un atbild `SUBSCRIPTION_REQUIRED`, ja lietotājs bez aktīva abonementa ir izmantojis 3 bezmaksas pārbaudes. Neveiksmīgas pārbaudes netiek skaitītas, un vēstures dzēšana pārbaudes neatdod.
2. `server/src/fragment.ts` sadala tekstu fragmentos līdz 3000 rakstzīmēm pa rindkopu un teikumu robežām (projektējuma 5.1.2).
3. `server/src/llm.ts` izvēlas Gemini vai Claude adapteri. Kopīgais `server/src/corrector.ts` sadala un apvieno fragmentus; Gemini adapteris `server/src/gemini-corrector.ts` tos pārbauda secīgi ar kopīgu rindu, bet Claude pārbauda līdz 4 fragmentiem vienlaicīgi katram dokumentam. Abi izmanto latviešu korektora sistēmas uzvedni un strukturētu JSON: katra labojuma precīzo oriģinālo tekstu, īsu citātu ap to, aizstājēju, paskaidrojumu latviski un kategoriju. Gemini JSON papildus validē ar kopīgo Zod shēmu. Nepilnīga vai nederīga atbilde beidzas ar `CORRECTION_FAILED` (5.1.3). Gemini patēriņā pieskaita arī modeļa domāšanas tokenus, ja tie norādīti atbildē.
4. `server/src/edits.ts` atrod katru labojumu pašā tekstā un aprēķina iezīmēšanas pozīcijas. Pozīcijas nekad netiek ņemtas no modeļa, un labojumi, ko nevar atrast vai kas pārklājas, tiek izmesti.
5. `server/src/store.ts` saglabā dokumentu un labojumus, šifrētus ar AES-256-GCM (NFR 2.3), un pieraksta izmantotos tokenus `usage_logs`.

## Maksājumi

"Abonēt" aizved uz Stripe Checkout. Pēc maksājuma Stripe atgriež lietotāju ar sesijas ID, un lapa palūdz serverim nolasīt sesiju no Stripe un aktivizēt abonementu (4.1, 4.2). Stripe to pašu paziņo arī caur webhook (`checkout.session.completed`), tāpēc pietiek ar vienu no abiem. Atjaunošana, atcelšana un neveiksmīgi maksājumi pienāk kā `customer.subscription.*` notikumi; katram serveris no jauna nolasa abonementu no Stripe, jo notikumi var pienākt nepareizā secībā. Neveiksmīgs maksājums atstāj abonementu `past_due`, un cilnē Abonements parādās "Maksājumu neizdevās apstrādāt" ar saiti kartes nomaiņai (4.3). Kartes dati serverī nenonāk (NFR 2.2).

## API

Visiem maršrutiem vajag Clerk sesiju (`Authorization: Bearer <token>`); kļūdas atbild kā `{ "code": ErrorCode }`.

| Maršruts | |
|---|---|
| `POST /api/documents` `{ text }` | pārbauda un saglabā tekstu, atgriež `DocumentDetail` |
| `POST /api/documents/demo` | testa pārbaude: fiksēts teksts bez modeļa izsaukuma, neskaitās bezmaksas pārbaudēs |
| `GET /api/documents?from&to` | vēstures kopsavilkumi, jaunākie pirmie, ISO datumi |
| `GET /api/documents/:id` | viens dokuments |
| `DELETE /api/documents/:id` | dzēš vienu |
| `DELETE /api/documents` | dzēš visu vēsturi |
| `GET /api/subscription` | `active`, Stripe `status`, `freeChecksLeft`, `currentPeriodEnd`, `cancelAtPeriodEnd` |
| `POST /api/subscription/checkout` | `{ url }` uz Stripe Checkout |
| `POST /api/subscription/sync` `{ sessionId }` | pēc Checkout nolasa sesiju no Stripe un aktivizē abonementu |
| `POST /api/subscription/portal` | `{ url }` uz Stripe klientu portālu (karte, atcelšana) |
| `POST /api/stripe/webhook` | Stripe notikumi; pārbaudīti ar parakstu, bez sesijas |
| `POST /api/me/sign-out-everywhere` | atsauc visas lietotāja sesijas |
| `DELETE /api/me` | atceļ abonementu, dzēš datus, tad Clerk kontu |
| `GET /api/health` | bez sesijas |

MongoDB kolekcijas: `users` (ar pārbaužu skaitu), `documents`, `corrections`, `usage_logs`, `subscriptions` (projektējuma 2.2). Datus var apskatīt ar [MongoDB Compass](https://www.mongodb.com/products/tools/compass), pieslēdzoties `mongodb://localhost:27017`; teksti tur ir šifrēti.

## Struktūra

- `client/`: React + Vite + shadcn/ui. Lietotāja teksti `src/i18n/lv.ts`, ceļi `src/routes.ts`, API līgums `src/lib/api.ts`.
- `server/`: Express + MongoDB + Gemini/Claude + Stripe. Maršruti `src/app.ts`, testi `test/`.
- `shared/types.ts`: API tipi un kļūdu kodi.
- `Dockerfile`, `docker-compose.yml`, `Caddyfile`: palaišana ar Docker un HTTPS uz VPS.
