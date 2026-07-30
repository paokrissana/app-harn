# Split Meal Calculator

Work out how much each person owes when **one** person pays the whole
restaurant bill — including Service Charge and VAT. Frontend only, everything
runs locally in the browser.

## How it works

Each person is charged in proportion to what they ate:

```
foodTotal     = foodA + foodB
serviceCharge = foodTotal * serviceCharge%
subtotal      = foodTotal + serviceCharge
vat           = subtotal  * vat%
grandTotal    = subtotal  + vat

ratioPerson   = personFood / foodTotal
payPerson     = grandTotal * ratioPerson
```

The person who did **not** pay transfers their share to the payer, e.g.
_"B should transfer 235.40 THB to A"_.

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
- **Edit** reopens the whole bill in the form; calculating again overwrites
  that record instead of adding a twin. **New bill** leaves edit mode.
- Only the inputs are stored. The amount shown in the list is recalculated
  from them, so it can never drift from the bill it came from — including the
  service charge and VAT switches as they were at the time.
- Unreadable or foreign-version storage is treated as "no history" rather than
  an error, and the oldest records fall off past `MAX_RECORDS` (200).

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 + shadcn/ui
- React Hook Form + Zod (validation)
- Vitest + Testing Library (unit + UI tests)

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
