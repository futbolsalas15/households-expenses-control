# households-expenses-control

Minimal MVP: React (Vite) + Firebase Auth + Firestore to track shared home expenses.
Two-member household (you + cousin), default split 50/50 with custom ratio per expense.

## Quick start

1) **Create Firebase project**
   - Enable Authentication › Google (or Email/Password).
   - Create Cloud Firestore (in test mode for development).
   - Grab config from Project Settings > General.

2) **Local setup**
```bash
npm install
cp .env.sample .env
# edit .env with your Firebase project keys
npm run dev
```

3) **Deploy (optional)**
- You can use Firebase Hosting or any static host (Netlify/Vercel).

4) **GitHub**
```bash
git init
git add .
git commit -m "feat: MVP scaffolding"
gh repo create households-expenses-control --public --source=. --remote=origin --push
# or manually on github.com, then:
git remote add origin https://github.com/<your-user>/households-expenses-control.git
git push -u origin main
```

## MVP features
- Google Sign-In
- Create expense with: date, description, category, cost center, payer, amount, conciliado flag, and per-expense split ratio
- List & filter (conciliado, search in description)
- Balance card (who owes whom) for current month or all-time
- Single household computed from your UID + partner email (set in Settings)

## Env
See `.env.sample` for required vars.

## Firestore structure (MVP)
- `expenses/{id}`
  - `householdId: string`  (computed from `uid` and `partnerEmail`)
  - `date: string (ISO)`
  - `weekLabel: string (YYYY-ww)`
  - `description, category, costCenter, amount: number, conciliado: boolean`
  - `payerUid: string`
  - `split: [{uidOrEmail, ratio}]`
  - `createdBy, createdAt, updatedAt`

## Security (dev note)
- Rules here are permissive for quick start; tighten before prod.
