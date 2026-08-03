# Split Meal Calculator

Work out how much each person owes when **one** person pays the whole
restaurant bill — including Service Charge and VAT. Frontend only, everything
runs locally in the browser.

Split Meal, the first of the AppHarn tools — see [VISION.md](VISION.md) for
where this is going.

## How it works

Each person is charged in proportion to what they ate:

```
yourFood      = your items + your slice of anything shared
serviceCharge = yourFood * serviceCharge%
subtotal      = yourFood + serviceCharge
vat           = subtotal * vat%
charged       = subtotal + vat          # what the bill asks of you
tip           = charged  * tip%         # or a flat amount in Baht
youPay        = charged  + tip
```

The person who did **not** pay transfers their share to the payer, e.g.
_"B should transfer 235.40 THB to A"_.

The total bill is reference only, but it is not ignored: everything you enter is
printed on that bill — your own items plus the **whole** price of anything
shared — so charged up it cannot exceed the total. If it does, the form refuses
to calculate and says what the items came to, which catches a mistyped price or
the wrong total. One baht of slack absorbs receipt rounding, and leaving the
total at `0` means "I don't know it" and skips the check.

A **tip** can be added on top, as a percentage or a flat number of Baht — tap
`%` / `฿` on the tip row to switch. A percentage tip is taken from the *charged*
total, so it grows with service charge and VAT. The tip switch defaults to
**off**: unlike service charge and VAT it is not on most receipts, and it is
deliberately excluded from the check above, since a tip is money added on top of
the bill rather than something printed on it.

Service charge and VAT each have their own switch, both **on** by default.
Switching one off drops it from the maths and from the summary — the
percentage box greys out and stops being validated, so a place that charges
neither (or VAT only) works without clearing the boxes.

## Saved bills

Every calculation is kept in `localStorage` under `bill-history` — there is no
backend, so history lives on the one device and never leaves it.

- A bill is named from the **Place / note** box, or generated from the items
  (`Pad Thai +2`) when that is left blank. Both the created and last-edited
  times are recorded.
- Dates read as `Today at 14:30`, `Yesterday at 20:05`, `3 days ago`, `last
  week`, then a plain date beyond a month. Hover one for the full timestamp.
  `Intl.RelativeTimeFormat` supplies the wording, so Thai needs no strings.
- **Edit** reopens the whole bill in the form; calculating again overwrites
  that record instead of adding a twin. **New bill** leaves edit mode.
- Only the inputs are stored. The amount shown in the list is recalculated
  from them, so it can never drift from the bill it came from — including the
  service charge and VAT switches as they were at the time.
- Unreadable or foreign-version storage is treated as "no history" rather than
  an error, and the oldest records fall off past `MAX_RECORDS` (20), quietly.

## Stack

- React 19 + TypeScript + Vite
- React Router (routing)
- Tailwind CSS v4 + shadcn/ui
- React Hook Form + Zod (validation)
- Vitest + Testing Library (unit + UI tests)

## Routes

| Path          | Page                                    |
| ------------- | --------------------------------------- |
| `/`           | Home — the tool list from `VISION.md`   |
| `/split-meal` | Split Meal calculator                   |
| anything else | redirects home                          |

Tools that are not built yet appear on the home page dimmed, badged `Soon`, and
are not tappable. Adding one means writing the page and flipping its `path` in
`src/lib/tools.ts`.

GitHub Pages has no server to rewrite unknown paths onto `index.html`, so a
refresh of `/app-harn/split-meal` would 404. Pages does serve `404.html` for
anything it cannot find, so the build copies `index.html` to `dist/404.html`
(see `pagesDeepLinkFallback` in `vite.config.ts`) and every route resolves. The
HTTP status on a deep link is still 404 even though the page renders — fine for
people, worth knowing if crawlers ever matter.

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # typecheck + production build
npm run test       # run tests in watch mode
npm run test:run   # run tests once
npm run typecheck  # tsc, no emit
npm run lint       # oxlint
```

## Structure

- `src/App.tsx` — routes (`AppRoutes` is exported for tests)
- `src/components/app-shell.tsx` — chrome shared by every page
- `src/pages/` — one file per page (`home.tsx`, `split-meal.tsx`)
- `src/lib/tools.ts` — the tool registry the home page renders
- `src/lib/calculator.ts` — pure calculation logic + THB formatting (unit tested)
- `src/lib/history.ts` — saved-bill storage, naming and dates (unit tested)
- `src/lib/schema.ts` — Zod form schema
- `src/components/bill-history.tsx` — the saved-bills list
- `src/components/split-meal-calculator.tsx` — form + result card
- `src/components/ui/` — shadcn components (`switch.tsx` is a dependency-free
  switch built on a native checkbox)

## Notes

Uses the public npm registry via a project-local `.npmrc` (independent of any
private/corporate registry configured globally).
