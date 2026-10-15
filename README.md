# GetStabilized

Apartment search that estimates which listings are rent controlled or rent stabilized. Every listing gets a 1 to 99 likelihood score with plain language reasons, and new listings stream into the page as soon as the worker finds them.

Cities: San Francisco, Los Angeles, Oakland, New York City, Washington DC.

## How a listing is scored

| Clue | Why it matters |
| --- | --- |
| **Uneven rent** ($2,687.40 instead of $2,700) | Capped yearly increases are percentages of the old rent, so regulated rents drift to odd amounts. |
| **Listing language** ("rent controlled", "RSO", "lease rider", "annual allowable increase") | Landlords often say so outright, or use terms that only apply to regulated units. |
| **Building age and size** from public property records | Each city covers buildings built before a cutoff year with a minimum number of units. |
| **Exempt property types** | California's Costa-Hawkins Act exempts most condos and single family homes. NYC excludes condos and co-ops. |
| **NYC tax benefits** (421-a, J-51) and registration lists | These programs require stabilized rents. |

Points convert to a score with diminishing returns, so nothing ever reads as certain. Rules live in `packages/core/src/cities.ts` and `packages/core/src/scoring.ts`. They are screening rules, not legal advice; the UI always links to the city agency that can confirm.

## Architecture

```
apps/
  web/       Next.js app: search UI, REST API, live updates over server-sent events
  worker/    CLI: imports building records, ingests listings, scores, stores, sends alerts
packages/
  core/      City rules, scoring engine, address normalization, filter logic (no I/O, fully tested)
  db/        Postgres schema, migrations, and queries
```

```
 listing sources ──> worker ──> match address to building ──> score ──> Postgres
 (sample, demo,                                                          │
  RentCast)                                         pg_notify ───────────┤
                                                                         ▼
 browser <── server-sent events <── web app (LISTEN) <── new listing event
         <── /api/listings (search, sort, filters)
```

* **Buildings** are matched to listings by a normalized street address (`1650 Golden Gate Avenue #4` and the assessor's `0000 1650 GOLDEN GATE AV0000` both become `1650 GOLDEN GATE AVE`).
* **Live updates:** the worker calls `pg_notify` for each new listing. Each web server holds one `LISTEN` connection and fans events out to open browser streams filtered by city. New matches wait in a "1 new listing" pill so the grid doesn't jump.
* **Alerts:** saved searches are matched against each new listing in the worker. Delivery currently prints to the console; plug an email provider into `apps/worker/src/notify.ts`.

## Run it locally

Needs Node 20.12+ and Docker (or any Postgres 14+).

```bash
cp .env.example .env
npm install
npm run db:up        # start Postgres in Docker
npm run seed         # migrate, load sample SF buildings, ingest sample listings for all cities
npm run dev          # http://localhost:3000
```

Watch live updates: keep the site open and run, in a second terminal,

```bash
npm run ingest -- --city sf --source demo
```

A "new listing" pill appears within a second. `npm run worker` does this on a schedule (every `INGEST_INTERVAL_MINUTES`).

## Real data

**San Francisco buildings** (free, no key): downloads the Assessor's secured property rolls from DataSF.

```bash
npm run import:buildings -- --city sf
```

**Real listings** from [RentCast](https://www.rentcast.io/api): add `RENTCAST_API_KEY` to `.env`, then

```bash
npm run ingest -- --city sf --source rentcast
```

The DataSF and RentCast adapters follow each service's published field names, but they haven't been run against the live services yet. Run each once and check the counts it prints before turning on the scheduled worker.

Listing data is the hard part of this product. Zillow, StreetEasy, and Craigslist prohibit scraping in their terms of service, so real listings should come from a licensed feed or partner API, or from landlords and renters submitting them directly.

## Commands

| Command | What it does |
| --- | --- |
| `npm run seed` | Migrate and load all sample data |
| `npm run import:buildings -- --city sf [--file rows.json]` | Load building records |
| `npm run ingest -- [--city sf,la] [--source sample,demo,rentcast]` | One ingest run |
| `npm run worker` | Ingest on a schedule |
| `npm run dev` / `build` / `start` | Web app |
| `npm test` | Unit tests (scoring, addresses, filters, importers, sources) |
| `npm run typecheck` | TypeScript across every package |

## API

| Endpoint | |
| --- | --- |
| `GET /api/listings?city=sf&beds=1&maxRent=3000&likelyOnly=true&noFee=true&hideExempt=true&sort=best\|cheap\|likely\|newest` | Search |
| `GET /api/listings?ids=1,2,3` | Specific listings |
| `GET /api/listings/:id` | One listing with its score breakdown |
| `GET /api/stream?city=sf` | Server-sent events, `event: listing` per new listing |
| `POST /api/saved-searches` `{ email, filters }` | Save an alert |
| `GET /api/health` | Listing and building counts per city |

## Deploy on Railway

The web app keeps live connections open, so it needs an always on server rather than serverless functions.

1. New Project, Deploy from GitHub repo, pick this repo. This becomes the **web** service.
2. Add a PostgreSQL database to the project.
3. Web service variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Build command `npm run build`. Start command `npm run db:migrate && npm start`. Under Networking, generate a public domain.
4. Add a second service from the same repo named **worker**. Variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `LISTING_SOURCES=sample,demo`, `INGEST_INTERVAL_MINUTES=5`. Start command `npm run seed && npm run worker`. No public domain.

## Roadmap

1. Building importers for LA (County Assessor), Oakland (Alameda County), NYC (PLUTO, HCR registered buildings, DOF tax benefits), and DC.
2. Email delivery for alerts (Resend or Postmark) with unsubscribe links.
3. Accounts, so saved listings follow you across devices.
4. Map view, and price history per unit to catch legal rent patterns over time.
5. Renter submitted listings and landlord verification.
6. Deploy: web on Vercel, Postgres on Supabase or Neon, worker as a cron job.
