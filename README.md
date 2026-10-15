# WebWallet Client

Web client for the [WebWallet](https://github.com/Andrej5768/WebWallet) personal finance API: accounts,
transactions, envelope budget, bank imports, reports and goals.

React + TypeScript on Vite, [Mantine](https://mantine.dev) components, TanStack Query, React Router,
i18next (Ukrainian and English), an API client generated from the backend OpenAPI spec
([openapi-typescript](https://openapi-ts.dev) + openapi-fetch), Vitest and Playwright.

## Development

Requirements: Node.js 22.12+ (see `.nvmrc`) and the backend running on `http://localhost:8080`
(`docker compose up` or the `local` profile, see the backend README).

```bash
npm ci
npm run dev          # http://localhost:5173, /api is proxied to the backend (API_URL overrides it)
```

The browser talks to the API on the same origin: Vite proxies `/api` in development and the reverse proxy does
it in production. The access token is kept in memory only; the refresh token is an HttpOnly cookie set by the
backend, so a page reload starts with `POST /api/v1/auth/refresh`.

| Command                                               | What it does                                                                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run api`                                         | Downloads the spec from the backend `dev` branch into `src/api/openapi.json` and regenerates `src/api/schema.d.ts` (`OPENAPI_SOURCE=../WebWallet/api/openapi.json` uses a local file) |
| `npm run lint`, `npm run format`, `npm run typecheck` | ESLint, Prettier, TypeScript                                                                                                                                                          |
| `npm test`                                            | Unit and component tests (Vitest, Testing Library)                                                                                                                                    |
| `npm run e2e`                                         | End-to-end tests (Playwright) against the production build                                                                                                                            |
| `npm run build`                                       | Production build into `dist/`                                                                                                                                                         |

CI runs all of the above on every push; the `api-drift` job reports when the backend spec moved ahead of the
committed copy.

## Design

Mockups of every screen (light and dark themes) are kept as a design canvas. Main decisions:
minimal technical style, cobalt accent `#0D52A8`, dark background `#2B2B2B`, warnings `#FFF9EC` / `#EEA94A`,
expenses red and income green, [Fixel](https://github.com/MacPaw/Fixel) for text (SIL OFL 1.1, bundled in
`src/assets/fonts/fixel`) with Inter digits for amounts, Lucide icons, desktop first.

## Roadmap

### 1. Foundation

- [x] Vite + React + TypeScript, Mantine theme with light, dark and system color schemes, fonts
- [x] Ukrainian and English translations
- [x] API client generated from the backend spec, access token in memory, refresh through the cookie
- [x] ESLint, Prettier, Vitest, Playwright, CI

### 2. Sign-in and app shell

- [x] Sign in, registration, email confirmation, forgotten and new password pages (links from emails:
      `/verify-email#token=…`, `/reset-password#token=…`)
- [x] Session restore on reload, protected routes, sign out
- [x] Sidebar: balance with a selectable mode (net worth / with credit limits / free outside envelopes),
      navigation, accounts and savings, collapsing to icons; header with theme and language

### 3. Accounts

- [x] Accounts grouped by type with balances in the account currency and in hryvnias, Monobank differences
- [x] Create and edit dialog, archive, delete; row menu and double click

### 4. Transactions

- [ ] Feed by day with period presets, filters and hidden-by-default search
- [ ] Side panel to add and edit: expense, income, transfer between currencies, splits, tags, comment
- [ ] Quick categorization of uncategorized transactions

### 5. Imports

- [ ] Monobank: connect, synchronization schedule, card and jar links, differences, history progress
- [ ] PrivatBank PDF statement and Zen Money (token or file) with a preview before import

### 6. Envelopes

- [ ] Month view: ready to assign, assigned / spent / available per category, moving money between envelopes

### 7. Reports

- [ ] Spending by category, income and expenses, net worth, payees

### 8. Dashboard

- [ ] Key figures, warnings, spending, envelopes with the today marker, recent transactions

### 9. Settings

- [ ] Profile, password change, start over
- [ ] Categories: tree with drag and drop, icon, color, needs / wants flag; rules; payees; tags with colors

### Later, together with the backend phases

- [ ] Analytics: plan vs actual, cash flow, period comparison, spending trends, savings and 50/30/20
- [ ] Goals and Monobank jars, balance forecast with planned payments (planning phase)
- [ ] FIRE, FYM and the compound interest calculator (investments phase)

### Backend changes this client needs

Tracked in the backend roadmap (phase 2); listed here with the client step that needs them.

- [x] Categories: icon, color, needs / wants flag, reordering — step 9
- [x] Tag colors — steps 4 and 9
- [x] Free-text transaction search — step 4
- [x] Optional last name at registration — step 2
- [x] Balances in the base currency and the accounts summary — steps 2 and 3
- [ ] Monobank synchronization schedule — step 5
- [ ] Import preview — step 5
- [ ] Start over — step 9

## License

This project is source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md).
Personal and other noncommercial use is allowed. Commercial use requires a separate agreement with the author.
