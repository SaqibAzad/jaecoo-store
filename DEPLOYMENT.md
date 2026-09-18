# Deploying

## One-time setup

### 1. Import the repo
[vercel.com/new](https://vercel.com/new) → pick `SaqibAzad/jaecoo-store`.
Next.js is auto-detected; leave the build settings alone.

### 2. Attach Postgres
Project → **Storage** → **Create Database** → **Postgres**.
Vercel injects `DATABASE_URL` itself, so nothing needs copying.

> The first build **fails without a database**, and that is expected rather than
> broken: `generateStaticParams` queries Postgres at build time to pre-render
> the product and model pages. Attach the database, redeploy, and it passes.

### 3. Migrate and seed the hosted database
From this machine, pointing at the hosted database rather than the local one:

```bash
export DATABASE_URL="<connection string from Vercel → Storage → .env.local>"
npx prisma migrate deploy      # create the tables
npx tsx prisma/seed.ts         # models, categories, settings, first product
```

Then redeploy so the pages pre-render with real data.

## Environment

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | set by Vercel when Postgres is attached |

Local development uses `.env` (git-ignored); tests use `.env.test` and refuse
to run against anything other than `jaecoo_test`.

## Deploys after the first

Push to `main`. Vercel builds and deploys automatically.

Pages carry `revalidate = 60`, so a product published from the admin appears
within a minute without a redeploy.

## Before pointing the domain at it

Nothing on the site can take an order yet — cart, checkout, payments and the
admin are not built, and "Add to cart" does nothing. Deploy to the Vercel URL
and test there; leave jaecooaccessories.com pointed elsewhere until checkout
works, or real customers will hit a dead end.

## Known issue to fix before the catalogue grows

Product images live in `public/products/` and are committed to the repo — about
5 MB for one product. That is fine now and will bloat the repo badly at a few
hundred products. Move them to object storage (Vercel Blob or Supabase Storage)
before bulk-importing.
