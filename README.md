# DocRequest

A free, self-hosted way for businesses to collect documents from their clients securely, instead of chasing them by email.

🚧 In development — see [PRD.md](PRD.md) for what it will do and [plan.md](plan.md) for progress. The full README (self-hosting, AWS, security) lands in the final phase.

## Run it locally

Needs Node.js 24, pnpm, PostgreSQL and Redis (or Docker for the last two: `docker compose -f docker-compose.dev.yml up -d`).

```bash
pnpm install
cp .env.example .env          # then set JWT_SECRET and CODE_PEPPER (openssl rand -base64 48)
pnpm db:migrate               # create the tables
pnpm build
pnpm --filter @docrequest/api start          # API on http://localhost:8120
pnpm --filter @docrequest/api start:worker   # emails and background jobs
pnpm --filter @docrequest/web start          # web on http://localhost:8020
```

In development, emails are written to `apps/api/storage/mail/` as `.eml` files instead of being sent.

## Tests

`pnpm test` runs against a real PostgreSQL database (`docrequest_test`) and Redis. No mocks.

Licence: AGPL-3.0
