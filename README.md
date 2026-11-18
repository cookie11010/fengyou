# 風遊 FengYou

A bilingual (繁體中文 / English) guide to Hsinchu, Taiwan, for international
visitors. Local students find hidden spots, write them up, and visitors use
them to plan a trip. Anyone who signs in can share a story with a photo, add a
place to the map, comment, and save stories and places to their trip. Posts go
live straight away; editors can take down anything that breaks the rules.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Supabase
(PostgreSQL + auth) and Leaflet with OpenStreetMap.

## Run it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. It redirects you to `/zh-TW` or `/en` depending on
your browser's language.

**Without a database, the site still works.** It shows sample places and
example stories (labelled "Example"). Likes, saves and comments on those are
kept only in your browser. Signing in, the trip planner and sharing stories
need Supabase (next section).

## Run it with the database (Supabase)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

```bash
npx supabase start
```

This starts a local Supabase, applies everything in `supabase/migrations/`,
loads `supabase/seed.sql` and prints the local URL and keys. Copy
`.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`: the "API URL" it printed
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the "Publishable key" it printed

Restart `npm run dev`. Sign-in codes are "emailed" to the local inbox at
http://localhost:54324.

To give an account a role (student contributor, teacher/editor), see
[supabase/README.md](supabase/README.md).

## Updating the live site

The live site reads from the production Supabase project. When a pull request
adds a file to `supabase/migrations/`, apply it there **before or together
with** deploying the code:

```bash
npx supabase link --project-ref <your-project-ref>   # once
npx supabase db push
```

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the site locally with live reload |
| `npm run build` | Production build. Run it before opening a pull request |
| `npm run lint` | Check the code for common mistakes |
| `npm run test:db` | Check the database security rules (no Docker needed) |

## Where things are

| Folder | What's in it |
|---|---|
| `src/app/[lang]/` | The pages. `[lang]` is `zh-TW` or `en` |
| `src/components/` | Reusable building blocks, grouped by area (layout, home, map, stories, itinerary, auth, ui) |
| `src/i18n/dictionaries/` | All interface text, one JSON file per language. Add a key to **both** files |
| `src/data/` | Loading data from Supabase, plus the sample places and example stories |
| `src/lib/` | Small helpers (Supabase clients, image loader, formatting) |
| `supabase/migrations/` | The database: tables, security rules, triggers. Never edit an old migration; add a new one |
| `supabase/tests/` | The database security tests |
| `public/brand/` | The logo |

## Working together

1. Get the latest code: `git pull`
2. Make a branch for your change: `git switch -c your-name/short-description`
3. Commit, push the branch, and open a pull request on GitHub
4. Someone else reviews it before it's merged into `main`

**Never commit keys.** `.env.local` is ignored by git on purpose. Only the
*publishable* Supabase key may go in browser code. The *secret* key bypasses
all security rules, so it must never be shared, pasted into chat, or given a
`NEXT_PUBLIC_` prefix.

## Credits

Photos from Wikimedia Commons; their authors and licences are listed on the
home page under "Photo credits". Map data © OpenStreetMap contributors.
