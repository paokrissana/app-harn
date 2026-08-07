# AppHarn

> AppHarn is a collection of calculators that help people split expenses fairly.

---

## Vision

AppHarn is not just a Split Meal Calculator.

The goal is to become a collection of simple tools for splitting money in
everyday situations.

Examples:

- Split Meal
- Split Group Order
- Split Group Meal
- Split Hang Out
- Split Trip
- Split Taxi
- Split Hotel
- Split Rent
- Split Utilities
- Split Shopping

---

## Product Principles

Every feature should be

- Fast
- Accurate
- Mobile First
- Responsive
- Easy to understand
- No login required
- No backend required (for MVP)

Users should be able to finish a calculation in under 30 seconds.

---

## Current MVP

Current completed feature

- Split Meal Calculator
- Split Group Order

Split Meal capabilities

- One side only: your items against a bill someone else paid
- Own items and shared items
- Service Charge
- VAT
- Tip
- Transfer calculation
- Saved bills

Split Meal is single-sided on purpose.

Split Group Order is the multi-participant one: a group, items filed under
whoever added them, who shares each line, delivery fee with its own promos,
several discounts, a payer, and transfers out.

---

## Product Roadmap

### Phase 1

Improve Split Meal

- Dynamic participants
- Discount
- Tip — done
- Rounding
- Copy Result — done

### Phase 2

Split Group Order — shipped, with

- Delivery Fee — split evenly, with its own promos
- Voucher — several, each a percentage of the original food total or a net amount

Still to add

- Service Fee
- Small Order Fee
- Tip
- Cashback

The engine already splits a fee either evenly or in proportion to what each
person ordered, so the three fees above are a row in the form, not new maths.

### Phase 3

Split Trip

Support

- Hotel
- Taxi
- Food
- Flights

### Phase 4

Split Utilities

Support

- Electricity
- Water
- Internet
- Rent

### Phase 5

Receipt OCR

Automatically detect

- Items
- Prices
- Fees

---

## Architecture

### Philosophy

Business logic must never exist inside React components.

Business logic should always be reusable.

UI should only display data.

Every calculator should reuse the same calculation engine whenever possible.

Split Group Order uses the shared engine in `src/shared/lib/bill.ts`. Split Meal
predates it and keeps its own pure logic in `src/lib/calculator.ts` — it is
single-sided, so it barely touches the Bill model. Two locations until it is
migrated.

### Layers

```
Presentation (React)
        ↓
     Feature
        ↓
Calculation Engine
        ↓
    Utilities
```

### Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Vitest
- GitHub Pages

### Folder Structure

```
src/
  features/
    split-group-order/     feature: form, schema, mapping to Bill
  shared/
    components/            reused across features
    lib/                   bill engine, ids
  pages/                   one file per route
  components/              app shell, Split Meal, ui/ primitives
  lib/                     Split Meal logic, tool registry
```

`features/` and `shared/` are where new work goes. `components/` and `lib/` hold
Split Meal and the shared UI primitives, and have not been rearranged.

---

## Shared Domain Model

Split Group Order uses this model. Split Meal came first and stays single-sided,
so it does not.

One addition the real Grab case forced: an item records **who added it** as well
as **who shares it**. A delivery app files a line under whoever tapped it, which
is not always who eats it — so `addedBy` decides where the line appears in the
form, and `sharedBy` decides where the money goes.

### Participant

Properties

- id
- name

### Expense Item

Properties

- id
- title
- amount
- addedBy — whose part of the receipt it sits under, display only
- sharedBy — who splits it, evenly

### Fee

Examples

- Service Charge
- VAT
- Delivery Fee
- Service Fee
- Tip

Properties

- id
- type
- amount

### Discount

Properties

- id
- amount
- strategy

Strategies

- Equal
- Proportional
- Payer Only

### Bill

Contains

- participants
- items
- fees
- discounts
- payer

### Transfer

Properties

- from
- to
- amount

---

## Calculation Engine

The calculation engine should be framework independent.

No React imports.

No UI logic.

Pure functions only.

Every feature should convert its inputs into the common Bill model.

The engine returns

- totals
- participant payments
- transfers

---

## Feature Rules

Each feature should contain

- Input
- Validation
- Calculation
- Result

Features should never duplicate business logic.

---

## UI Guidelines

Mobile First

Responsive

Minimal

One page whenever possible.

Large touch targets.

Good spacing.

Clear typography.

Use cards to separate sections.

---

## Validation Rules

Amounts cannot be negative.

Food total must be greater than zero.

Discount cannot exceed total amount.

At least one participant.

A payer must always exist.

---

## Testing

Business logic must always have unit tests.

Calculation functions should be deterministic.

Edge cases must be covered.

---

## Performance

Avoid unnecessary renders.

Memoize only when necessary.

Do not optimize prematurely.

Keep calculations simple.

---

## Accessibility

Inputs require labels.

Keyboard navigation should work.

Proper aria attributes where needed.

---

## Future Features

Split Meal

Split Group Order

Split Trip

Split Taxi

Split Utilities

Receipt OCR

PromptPay QR

History

Share Link

PWA

Dark Mode

---

## Coding Rules

Use TypeScript strict mode.

Use functional components only.

Keep components small.

Prefer composition over inheritance.

Avoid duplicated code.

Prefer reusable utilities.

Never place calculation logic inside UI components.

---

## Claude Instructions

Before implementing any feature

1. Understand the existing architecture.
2. Reuse existing calculation logic whenever possible.
3. Avoid creating duplicate models.
4. Keep business logic independent from React.
5. Keep UI simple.
6. Prioritize maintainability over clever code.

When implementing a new feature

- Update this document if architecture changes.
- Preserve backward compatibility.
- Do not break existing calculations.
- Add tests for every new calculation rule.

If multiple implementation options exist

Choose the simplest solution that can support future expansion.

Always think of AppHarn as a platform, not a single calculator.
