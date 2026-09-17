# AppHarn — Project Guide

> A collection of simple tools for splitting money and calculating everyday
> expenses.

**Mission:** help people split and calculate money fairly with the least effort.

Open a page, enter numbers, get a clear answer. That is the whole product.

This file is the single source of truth for what AppHarn is, how it is built,
and the decisions already taken. `README.md` explains how the shipped features
actually work. There is no third document.

---

## 1. Product principles

- Simple before sophisticated
- Fast — a calculation finishes in under 30 seconds
- Accurate and deterministic
- Mobile first, responsive
- Easy to understand without doing maths
- Free
- No login
- No backend or database unless a feature genuinely needs one
- Results easy to copy and share
- Avoid over-engineering

---

## 2. Current state

Three tools are built and live:

| Tool | Route | What it answers |
| --- | --- | --- |
| Split Meal | `/split-meal` | What *I* owe when somebody else paid the whole bill |
| Split Group Order | `/split-group-order` | What everyone owes *me* after I ordered delivery |
| Split Group Meal | `/split-group-meal` | Everyone's share of one restaurant bill |

Five more appear on the home page as dimmed "coming soon" cards: Split Taxi,
Split Trip, Split Rent, Split Shopping, Split Utilities.

Split Meal and Split Group Order point in **opposite directions** — money out
versus money back. That is deliberate and is what distinguishes them.

Split Group Order carries a beta badge: its maths reconciles, but it has fewer
fees than the spec calls for.

---

## 3. Roadmap

### Next

1. **Percentage Calculator** — `% of`, discount, increase, relation. Four pure
   functions, no participants, no Bill model. Also the first tool that serves
   the search terms in §9.
2. **SEO pass** — per-route titles and descriptions, once two calculators exist.
3. **Finish Split Group Order** — service fee, small-order fee, tip, and the
   Equal and Payer-Only discount strategies. The engine already splits a fee
   evenly or proportionally, so these are rows in a form, not new maths.
4. **Journey Split** — segment-based fare splitting (see below).

### Later

Split Trip, Split Hotel, Split Rent, Split Utilities, Split Shopping, and the
standalone calculators: Discount, VAT, Service Charge, Tip.

### Product expansion, not scheduled

Share links, history beyond Split Meal, receipt OCR, PromptPay QR, PWA, trip
mode, favourite groups.

### Journey Split needs its own engine

Journey Split divides a taxi fare by **meter segments**, not equally: three
passengers from ฿35 to ฿145, two from ฿145 to ฿245, one to the end. Each person
pays for the stretch they were aboard.

`src/shared/lib/bill.ts` has no notion of sequence or of a participant being
present for only part of a bill — every item is shared by a fixed set of people.
So this is a genuinely different shape and needs a design before any code.
Reusing `Bill` here would be forcing it.

---

## 4. Decisions on record

Settled, so they are not re-litigated. Change them deliberately, not by
accident.

**Routes are flat.** `/split-group-order`, not `/split/group-order`. The specs
defer to existing conventions and these are shipped and indexed. New tools
follow the flat scheme.

**A fee splits according to its nature, not a global default.**

- `even` — the fee buys the whole order regardless of who ate what. A delivery
  fee buys the trip; a small-order fee buys the right to order at all.
- `proportional` — the fee scales with what each person ordered. A percentage
  service charge, VAT, a percentage tip.

Do not add a global "default fee sharing" setting. The fee itself decides.

**Money is plain JavaScript numbers.** No decimal library. Rounding is absorbed
by the payer so displayed shares always sum to what was actually paid, and no
drift has been observed. Revisit only if a real discrepancy appears.

**Reconcile to what was paid, never to what an app says.** Grab's per-person
figures will disagree once informal sharing is applied — it splits delivery
gross and cannot know who shared what. Matching Grab would mean collecting more
than the bill. The order total is the only figure that must agree.

**Split Meal keeps its own logic.** It predates the shared engine, is
single-sided, and barely touches the Bill model. `src/lib/calculator.ts` stays
until there is a reason to migrate it. Two locations, knowingly.

---

## 5. Architecture

```
Presentation (React)
        ↓
     Feature
        ↓
Calculation Engine
        ↓
    Utilities
```

Business logic never lives inside React components. Components collect input,
validate it, call a calculation function, and display the result.

Calculation code is framework independent — no React imports, no UI logic, pure
functions only. Every feature converts its own form into the shared `Bill`
model and hands that to the engine.

### Folder structure

```
src/
  features/
    split-group-order/     form, schema, mapping to Bill
    split-group-meal/      the same, for one restaurant bill
  shared/
    components/            reused across features
    lib/                   bill.ts (the engine), money.ts, id.ts
  pages/                   one file per route
  components/              app shell, Split Meal, ui/ primitives
  lib/                     Split Meal logic, tool registry
```

`features/` and `shared/` are where new work goes. `components/` and `lib/`
hold Split Meal and the shared UI primitives and have not been rearranged.

---

## 6. Shared domain model

In `src/shared/lib/bill.ts`. Do not create a second money model.

**Participant** — `id`, `name`.

**BillItem** — `id`, `title`, `amount`, `addedBy`, `sharedBy`.

The split between `addedBy` and `sharedBy` is the insight a real Grab order
forced: a delivery app files a line under whoever tapped it, which is not always
who eats it. `addedBy` decides where the line appears in the form; `sharedBy`
decides where the money goes.

**Fee** — `id`, `label`, `amount`, `split` (`even` or `proportional`), optional
`promos`. A promo attached to a fee comes off that fee before it is split, so a
free-delivery voucher can never reach the food.

**Discount** — `id`, `kind` (`percent` or `amount`), `value`. Percentages come
off the *original* food total, so two promos do not compound — that is how a
receipt lists them.

**Bill** — participants, items, fees, discounts, `payerId`, optional
`headcount` for a group larger than the people listed.

**Transfer** — `from`, `to`, `amount`.

**SharedPlate** — a line with more than one name on it, and what each of the
others owes whoever it sits under.

---

## 7. Calculation rules

Functions must be pure, deterministic, unit tested, and explicit about
rounding.

- Everyone but the payer is rounded to whole Baht; the payer carries the odd
  change, so shares always sum to the real bill.
- Nothing can discount below zero.
- A total must never go negative.
- Displayed per-person figures must add up to the displayed total. Always.

When adding a split feature: inspect the existing logic first, reuse the models,
extend shared code only when the abstraction is genuinely reusable, and never
copy calculation code between features.

---

## 8. Tech stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · shadcn/ui · React
Hook Form · Zod · Vitest + Testing Library · **GitHub Pages**.

Deployment is GitHub Pages via `.github/workflows/deploy.yml`, which runs on
every push to `main`. Not Vercel.

Do not replace the stack or add a framework without a strong reason.

---

## 9. SEO and discoverability

Feature pages should target real searches, most of them Thai:

```
หารค่าอาหาร · หารค่าอาหารหลายคน · หารค่า GrabFood
คิด VAT 7% · คิด Service Charge
80% ของ 1500 · ลด 60% เหลือเท่าไหร่ · ค่าแท็กซี่หารกัน
```

Currently every route serves one static `<title>App Harn</title>` with no
description. That is the gap.

---

## 10. UX guidelines

- Works especially well on a phone
- Few fields on screen at once
- Natural-language labels — `What is [80] % of [1,500]?`
- The primary result is visually obvious
- Useful defaults (Thai service charge 10%, VAT 7%)
- No unnecessary modals
- Validation shown next to the input it concerns
- Copy Result wherever it is useful

Show the working, not just the number:

```
80% of ฿1,500 = ฿1,200        not        1200
```

---

## 11. Coding rules

Strict TypeScript. Functional components. Small and composable. Meaningful
names. No duplicated logic. No abstractions for hypothetical future use. Follow
the formatting and conventions already in the file you are editing.

Never break an existing route or change existing behaviour without a reason.

---

## 12. Testing

Calculation rules are the priority. Every calculation feature needs tests for
normal cases, zero values where valid, decimals, boundaries, invalid input,
rounding, and combinations of fees and discounts.

Tests must be deterministic. The suite, typecheck and lint all pass before a
commit.

---

## 13. Working agreement

Before implementing:

1. Read this file.
2. Inspect the actual code — do not assume it matches the docs.
3. Identify what can be reused.
4. Make a short plan.
5. Build the smallest clean solution.
6. Add or update tests.
7. Check existing features still work.
8. Update this file if the architecture or a decision changes.

Do not: rewrite unrelated code, add a backend or auth, duplicate the engine,
build abstractions for imagined futures, or change behaviour without saying why.

The priority is a working, maintainable MVP. Think of AppHarn as a platform,
not a single calculator — but build one calculator at a time.
