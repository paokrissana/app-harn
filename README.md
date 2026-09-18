# AppHarn

Calculators for splitting expenses. Frontend only — everything runs locally in
the browser, no login, no backend. See [CLAUDE.md](CLAUDE.md) for the vision,
architecture and roadmap.

Four tools so far:

- **Split Meal** — what you owe when somebody else paid the whole bill.
- **Split Group Order** — what everyone owes you when you ordered delivery for
  the group.
- **Split Group Meal** — the dine-in case: one restaurant bill, dishes going
  round the table.
- **Percentage Calculator** — a percentage, a discount, a price rise, or one
  amount as a percentage of another.

The first two are deliberately one-sided in opposite directions — money out
versus money back. See [CLAUDE.md](CLAUDE.md) for what is still to come.

## Split Meal

Work out how much you owe when **one** person pays the whole restaurant bill —
including Service Charge, VAT and a tip.

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

## Split Group Order

One person orders delivery for a group; everyone else owes them. Laid out the
way a delivery receipt is — people first, then lines filed under whoever tapped
them in the app.

The point that shapes it: **who added a line and who shares it are different
facts**. Gyoza tapped by Alex but halved with Bianca sits under Alex and costs
them 60 each. So each line records `addedBy` (where it appears in the form) and
`sharedBy` (where the money goes), and you tick the sharers.

- **Four fees, each split by what it buys.** The **delivery fee** and the
  **small order fee** divide evenly — the trip happens once, and the fee for
  ordering too little is the same whoever ordered. The **service fee** is a
  percentage of the order on any receipt that carries one, so it follows what
  each person ordered. The **tip** goes to the rider for that same one trip, so
  it divides evenly like delivery. Leave any of them at 0.
- **Each discount says who it belongs to.** By order size (the default, and
  what a receipt implies), split evenly, or the payer's alone — a voucher the
  group shares and your own loyalty points are not the same thing. There can be
  several, each with its own rule. Every percentage comes off the *original*
  food total, so two promos do not compound, and a percentage over 100 is
  refused as the typo it is.
- **Delivery promos are their own thing**, attached to the fee. A free-delivery
  voucher cancels the fee before it is split and can never reach the food.
- Everyone but the payer is **rounded to whole Baht**, since they are the ones
  transferring; the payer carries the odd change, so the shares always add up to
  exactly what was paid.

### Shared plates

Each person's total is one number, and it hides the only part that actually
needs working out. You already know what your own lines cost — the delivery app
prints them. What you cannot do in your head is your cut of a plate that sits
under somebody else's name.

So underneath the totals, a **Shared plates** section lists every line with more
than one name on it: the plate and its price, everyone in on it, and what each
of the others owes whoever it sits under. Plates nobody shared are left out —
there is nothing to settle on a line you ate alone.

The person a plate sits under is never billed for it, and need not be among the
sharers at all: a cake ordered for the other two leaves both of them owing the
person who tapped it, and that person owing nothing.

These figures are at **menu price**. Fees and promos belong to the totals above,
which remain the authoritative settlement — the section says so, or a discount
would make it look like the same food is being charged twice.

`src/shared/lib/bill.ts` is the engine — a `Bill` in, per-person totals and
transfers out, plus `sharedPlates()` for the breakdown above. Framework
independent and unit tested, with the real Grab order above as its main case.

## Split Group Meal

Everyone at one restaurant table, one bill, one person settling it. The dine-in
counterpart to Split Group Order — and a separate tool rather than a mode,
because the two have **opposite defaults**.

A delivery receipt already files every line under whoever tapped it, so there
sharing is the exception. A restaurant bill has no such structure: it is one
list of dishes, most of them for the table. So here **every dish starts shared
by everyone**, and the work is tapping a name *off* the one dish somebody ate
alone. Get that backwards and a table of eight costs eight taps per dish.

- **Service charge and VAT** are proportional — they scale with what each person
  ate, unlike a delivery fee which buys the trip and splits per head. VAT is
  worked out on the food *and* the service charge, matching the receipt, so the
  two cannot collapse into one combined percentage. Each has its own switch.
- **The total on the bill is cross-checked.** Everything typed in is printed on
  that bill, so charged up it cannot exceed it. This is what catches a mistyped
  price or a dish entered twice. One baht of slack absorbs receipt rounding, and
  leaving it at `0` means "I have not got the bill" and skips the check.
- Adding somebody puts them on every dish the whole table was already sharing;
  removing them takes them off everything, and a dish only they were eating goes
  with them.
- Every dish is filed under the payer, because on a restaurant bill it really is.

`src/features/split-group-meal/` holds the form, schema and mapping. The engine
is the same `src/shared/lib/bill.ts` as Split Group Order — the charges are just
`Fee` entries with `split: 'proportional'`.

## Percentage Calculator

Four everyday questions, one page:

```
% of        What is 80% of 1,500?          -> 1,200
Discount    Take 60% off 5,000             -> you save 3,000, you pay 2,000
Increase    Add 10% to 1,000               -> adds 100, new amount 1,100
%           800 out of 1,000               -> 80%
```

**No Calculate button.** Two boxes and arithmetic that costs nothing, so the
answer appears as you type. The split tools keep their button because they have
a form's worth of input; this one would only be interrupted by it.

The bounds differ per mode rather than globally, because the question changes
what is sensible. A discount is capped at **100%** — you cannot pay less than
nothing — while `300% of 50` is an ordinary question and is allowed. A whole of
zero is refused outright, since every number is an infinite percentage of
nothing.

An empty box means "not filled in yet", never zero: nothing is answered until
both hold a number, rather than replying to a question nobody finished asking.

Results drop trailing zeros — `1,200` rather than `1,200.00`, but `1,200.50`
when the decimals matter (`formatAmount` in `src/shared/lib/money.ts`). That
rounding to two decimals is also where binary-float noise disappears: 70% of
8.1 is not exactly 5.67 in IEEE 754, and the tests pin the displayed answer
rather than the internal one.

`src/features/percentage-calculator/percentage.ts` holds the four pure
functions. No participants, no fees, no `Bill` — this one shares nothing with
the split engine but the formatting.

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

## Search and sharing

Each route has its own title and description in `src/lib/seo.ts`, in both
languages, written for the searches AppHarn exists to answer — `หารค่าอาหาร`,
`หารค่า GrabFood`, `80% ของ 1500`.

Two things make them count:

- **Thai is the default language.** A crawler never taps the toggle, so the
  default decides the only language that ever reaches an indexed page. With
  English as the default, none of those words appeared anywhere on the site.
- **Every route's head is baked into real HTML at build time.**
  `prerenderRouteHeads` in `vite.config.ts` writes `dist/<route>/index.html` for
  each indexed route. Because the file genuinely exists, GitHub Pages answers
  **200** rather than the 404 status the `404.html` fallback returns — and the
  title, description, canonical and OG tags are in the markup before any
  JavaScript runs.

Only the head is generated. The body is the same on every route and React fills
it in on load, so pre-rendering it would be machinery for no gain — there is no
server data to wait for.

At runtime `src/components/page-meta.tsx` keeps the head in step with the router
and the language toggle, using React 19's native metadata hoisting — no helmet
library. `<html lang>` is set by hand, since React does not own that node.

`robots.txt` and `sitemap.xml` are generated from the same route list, so a new
tool with a `seo.ts` entry appears in both without anything else being touched.

`seo.ts` is deliberately import-free: `vite.config.ts` reads it at build time,
and an aliased import would drag the app's path mapping into the build config's
resolution. It declares its own language union, and `seo.test.ts` fails to
compile if that ever drifts from the app's `Lang`.

## Stack

- React 19 + TypeScript + Vite
- React Router (routing)
- Tailwind CSS v4 + shadcn/ui
- React Hook Form + Zod (validation)
- Vitest + Testing Library (unit + UI tests)

## Routes

| Path          | Page                                    |
| ------------- | --------------------------------------- |
| `/`           | Home — the tool list from `tools.ts`     |
| `/split-meal` | Split Meal calculator                   |
| `/split-group-order` | Split Group Order                |
| `/split-group-meal` | Split Group Meal                  |
| `/percentage` | Percentage Calculator                  |
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
- `src/pages/` — one file per page (`home.tsx`, `split-meal.tsx`,
  `split-group-order.tsx`)
- `src/lib/tools.ts` — the tool registry the home page renders
- `src/shared/lib/bill.ts` — the shared calculation engine (unit tested)
- `src/features/split-group-order/` — its form, schema and mapping to a `Bill`
- `src/features/split-group-meal/` — the same, for one restaurant bill
- `src/features/percentage-calculator/` — four modes, pure maths, no `Bill`
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
