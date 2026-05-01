# EquipCheck (Hospital Equipment Check)

React + Vite app for daily equipment checks. Data is stored in **Supabase** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set.

## Local development

```bash
npm install
cp .env.example .env   # add your Supabase URL + anon key
npm run dev
```

Apply the database schema once in the Supabase SQL editor: `supabase/schema.sql`.

## GitHub Pages

This repo includes `.github/workflows/github-pages.yml`.

1. **Repository → Settings → Secrets and variables → Actions**: add  
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as local `.env`).
2. **Settings → Pages**: set **Source** to **GitHub Actions**.
3. Push to `main` or `master`; the workflow builds and deploys the site.

Live URL shape: `https://<username>.github.io/<repository>/` (for this project the repo is **`equipment`**).

## Scripts

- `npm run build` — production build to `dist/`
- `npm run lint` — ESLint
