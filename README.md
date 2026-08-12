# CourtSync

Minimal Next.js 14 (App Router) + TypeScript + TailwindCSS scaffold for the CourtSync app.

Quick start:

```bash
npm install
npm run dev
```

The Supabase client is in `lib/supabase.ts` and reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from environment variables.

The `.env.local` file has been added but is ignored by git.
