
# AGENTS.md — Households Expenses Control

This document is the single source of truth for the MVP scope, architecture, and project conventions of **households-expenses-control**. It includes the project structure we scaffolded, the requirements spec, core calculations, and a short delivery roadmap.

---

## 1) Project overview

Cloud app to track shared home expenses (you + cousin) with a lightweight stack: **React (Vite)** + **Firebase Auth** + **Cloud Firestore** (no complex backend). Default split is 50/50 but each expense can define custom ratios or N‑way splits when needed.

### Tech stack
- **Frontend**: React 18 (Vite), minimal CSS
- **Auth**: Firebase Authentication (Google or Email/Password)
- **Database**: Firestore (client SDK)
- **Hosting**: Firebase Hosting / Vercel / Netlify (any static host)
- **Optional**: Firebase Storage for receipt images, Cloud Functions for import/aggregation

---

## 2) Project structure (current MVP)

```
households-expenses-control/
├─ README.md
├─ .gitignore
├─ .env.sample
├─ firestore.rules
├─ package.json
├─ vite.config.js
├─ index.html
├─ src/
│  ├─ styles.css
│  ├─ main.jsx
│  ├─ App.jsx
│  ├─ firebase.js
│  ├─ hooks/
│  │  └─ useAuth.js
│  ├─ lib/
│  │  └─ calc.js
│  └─ components/
│     ├─ ExpenseForm.jsx
│     └─ ExpenseTable.jsx
```

**Notes**
- `calc.js` holds non‑UI helpers: week label derivation and balance math.
- `useAuth.js` exposes `user`, `loading`, and `login/logout` functions.
- `firestore.rules` is **dev‑permissive**; update before production.

---

## 3) Functional requirements

1. **Expenses**
   - Create expense with fields: date, week label, description, cost center (Shared / Juan / Maruja / other), payer, amount, `conciliado` (settled) flag.
   - Defaults: cost center = Shared, `conciliado` = false.
   - Support **split rules** per expense: 50/50 by default; override with custom ratios (e.g., 100/0, 70/30) and allow **N‑way** split (e.g., 3 people) for edge cases.
   - Categorize expenses (e.g., groceries, utilities, dining) for reporting.
   - Handle **non‑shared** items that still impact balances when one pays for the other.

2. **Balances & settlements**
   - Per‑person **Gastos** (consumed share) vs **Aporto** (paid) and computed **balance (Debe/a favor)**.
   - Weekly, monthly, and custom date‑range views.
   - Record **settlement transactions** (manual payments/adjustments between members) and mark linked expenses as reconciled.

3. **Views & filters**
   - Table view with filters: by week/date, category, payer, cost center, `conciliado` status, and text search.
   - Quick actions: “Mark selected as conciliated”, “Duplicate expense”, “Split custom”.
   - Analytics: totals by category, by payer, by week; “who owes whom” summary.

4. **Data import/export**
   - **CSV export** (entire period / current filters).
   - **Google Sheets import** (CSV upload or copy‑paste mapping wizard).

5. **Notifications (optional MVP+)**
   - Reminder to settle (threshold or periodic, e.g., monthly).
   - Optional email/push when new expenses are added.

6. **Multi‑person households (nice‑to‑have)**
   - A “household” can have 2+ members; per‑member splits supported.

---

## 4) Non‑functional requirements

- **Stack**: React (Vite) + Firebase Auth + Firestore + (optional) Cloud Functions; Firebase Hosting.
- **Offline‑ready**: Firestore persistence for adding expenses offline; sync later.
- **Auditability**: Store created/updated timestamps and editor ID.
- **Privacy & security**: Firestore Security Rules—users can only access their household.
- **Localization**: default COP currency and Spanish labels; configurable currency & locale.
- **Performance**: virtualized list for large histories; indexed Firestore queries by `householdId`, `date`, and `conciliado`.

---

## 5) Data model (Firestore)

> MVP keeps everything in a single `expenses` collection keyed by `householdId`. Future versions can nest under `/households/{householdId}`.

- `expenses/{expenseId}`
  - `householdId: string` — stable ID from (current user uid + partner email), sorted and joined.
  - `date: string` (ISO `YYYY-MM-DD`)
  - `weekLabel: string` (e.g., `2025-37`)
  - `description: string`
  - `category: string`
  - `costCenter: "Shared" | "Juan" | "Maruja" | "Other"`
  - `amount: number`
  - `conciliado: boolean`
  - `payerUid: string` — uid of the payer; for partner we use the partner email during MVP or a uid once multi‑auth is enabled
  - `split: Array<{ uidOrEmail: string, ratio: number }>` — ratios sum to 1
  - `createdBy: string`
  - `createdAt: serverTimestamp`
  - `updatedAt: serverTimestamp`

**Future entities**
- `households/{householdId}` — name, members[], defaultSplit, currency.
- `settlements/{settlementId}` — fromUserId, toUserId, amount, date, notes, linkedExpenseIds[].
- `categories/{categoryId}` — name, color.
- `attachments` — receipt image URLs in Firebase Storage.

---

## 6) Core calculations

For each expense:
- Compute each member’s **owed share** from `split` (fallback: 50/50).

Per member:
- **Gasto** = Σ owed shares of shared expenses + personal cost‑center expenses assigned to them.
- **Aporto** = Σ amounts they paid (`payerUid`).
- **Balance (Debe/a favor)** = `Aporto − Gasto`.
- “Who owes whom”:
  - If `you.balance > 0` → partner owes you that amount.
  - If `you.balance < 0` → you owe partner `abs(balance)`.

**Scopes**
- Show balances **by week**, **by month**, and **lifetime** totals.

---

## 7) UI (React) — MVP screens

1. **Dashboard**
   - “Who owes whom” card; totals this month; pending conciliation count.
   - Quick add expense.

2. **Expenses list**
   - Columns: Date, Description, Category, Cost center, Payer, Amount, Conciliado.
   - Filters: month toggle, conciliation status, text search.
   - CSV export (next iteration).

3. **Add/Edit expense drawer**
   - Date picker (auto‑derive week label), category, cost center, payer (defaults to current user), amount, `conciliado`, and **split slider** (50/50 default).

4. **Balances**
   - Per‑person summary (Gastos, Aporto, Debe/a favor).
   - “Create settlement” (next iteration).

---

## 8) Firebase specifics

**Auth**
- Start with Google Sign‑In; Email/Password optional.
- MVP treats partner as an email identifier for splitting; full multi‑user comes later.

**Firestore**
- Suggested composite indexes:
  - (`householdId`, `date` DESC)
  - (`householdId`, `conciliado`)
  - (`householdId`, `payerUid`, `date`)

**Security Rules (MVP)**
```
// firestore.rules — DEV ONLY (permissive)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /expenses/{docId} {
      allow read, write: if true; // tighten before prod
    }
  }
}
```
**Production hardening ideas**
- Users can read/write only where `resource.data.householdId` matches a set computed from their uid + allowed partner(s).
- Only creator or household admin can delete expenses.
- Validate amounts ≥ 0, required fields, and `sum(split.ratio) ≈ 1.0`.

---

## 9) Import strategy from Google Sheets

- Map columns 1‑to‑1: Semana → `weekLabel`, Conciliado → `conciliado`, Fecha → `date`, Concepto → `description`, Centro Costo → `costCenter`, Fuente/Pagó → `payerUid` (or partner email), Valor → `amount`.
- If **Centro Costo** is a specific person and **Fuente** (payer) is the other, record it as a personal expense with `payerUid` of the paying person; balances account for it automatically.
- Detect “divided by 3” cases and set a 3‑way split.
- Start with CSV export from Sheets and a simple import wizard (next iteration).

---

## 10) Edge cases to support

- Recurring utilities (e.g., internet, water, gas) → quick templates or recurring helpers.
- Large one‑offs (repairs, tools, loans) → allow personal or shared with arbitrary split and a different payer.
- Pending items (`conciliado = false`) → batch actions to reconcile at month end.

---

## 11) Roadmap

- **MVP (done in scaffold):**
  - Google Sign‑In, create/list expenses, 50/50 & custom split slider, balances, filters (month toggle, conciliado, search).
- **v0.2:**
  - Settlements, categories management, CSV export/import, receipt uploads.
  - Security rules tightened to household‑scoped access.
- **v1.0:**
  - Multi‑household support, recurring templates, reminders/notifications, offline polish, role‑based permissions, analytics.

---

## 12) How to run locally

```bash
npm install
cp .env.sample .env   # paste Firebase Web config
npm run dev
```

---

## 13) Conventions & guidelines

- Keep business logic (math, transformations) in `src/lib` and pure.
- UI components are stateless where possible; forms manage their own local state.
- Prefer Firestore batched writes for imports; validate/normalize inputs.
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`).

---

**Maintainers**: Juan Camilo (owner). PRs welcome once repo is public.
