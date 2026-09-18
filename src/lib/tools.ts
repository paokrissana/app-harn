import {
  BikeIcon,
  CarTaxiFrontIcon,
  HandPlatterIcon,
  HandCoinsIcon,
  HouseIcon,
  PercentIcon,
  LuggageIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  UtensilsCrossedIcon,
  UtensilsIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react'

import type { TranslationKey } from '@/i18n/translations'

/**
 * What kind of question a tool answers.
 *
 * `split` — how a cost is divided between people.
 * `calculator` — a number worked out on its own, nobody else involved.
 *
 * The home page groups by this: eight cards of two different kinds do not read
 * as one list, and somebody after "what is 7% VAT" is not shopping for a way to
 * split dinner.
 */
export type ToolKind = 'split' | 'calculator'

/** One AppHarn tool. `path` is null while the tool is still just an intention. */
export interface Tool {
  id: string
  kind: ToolKind
  path: string | null
  icon: LucideIcon
  nameKey: TranslationKey
  descKey: TranslationKey
  /** Usable, but the maths is still being worked on — says so on the card. */
  beta?: boolean
}

/** Every tool from CLAUDE.md, built or not, in the order the home page lists them. */
export const TOOLS: Tool[] = [
  {
    id: 'split-meal',
    kind: 'split',
    path: '/split-meal',
    icon: UtensilsCrossedIcon,
    nameKey: 'toolMealName',
    descKey: 'toolMealDesc',
  },
  {
    id: 'percentage',
    kind: 'calculator',
    path: '/percentage',
    icon: PercentIcon,
    nameKey: 'toolPercentageName',
    descKey: 'toolPercentageDesc',
  },
  {
    id: 'vat',
    kind: 'calculator',
    path: '/vat',
    icon: ReceiptTextIcon,
    nameKey: 'toolVatName',
    descKey: 'toolVatDesc',
  },
  {
    id: 'service-charge',
    kind: 'calculator',
    path: '/service-charge',
    icon: UtensilsIcon,
    nameKey: 'toolServiceName',
    descKey: 'toolServiceDesc',
  },
  {
    id: 'tip',
    kind: 'calculator',
    path: '/tip',
    icon: HandCoinsIcon,
    nameKey: 'toolTipName',
    descKey: 'toolTipDesc',
  },
  {
    id: 'split-taxi',
    kind: 'split',
    path: '/split-taxi',
    icon: CarTaxiFrontIcon,
    nameKey: 'toolTaxiName',
    descKey: 'toolTaxiDesc',
    beta: true,
  },
  {
    id: 'split-group-order',
    kind: 'split',
    path: '/split-group-order',
    icon: BikeIcon,
    nameKey: 'toolGroupOrderName',
    descKey: 'toolGroupOrderDesc',
    beta: true,
  },
  {
    id: 'split-group-meal',
    kind: 'split',
    path: '/split-group-meal',
    icon: HandPlatterIcon,
    nameKey: 'toolGroupMealName',
    descKey: 'toolGroupMealDesc',
    beta: true,
  },
  {
    id: 'split-trip',
    kind: 'split',
    path: null,
    icon: LuggageIcon,
    nameKey: 'toolTripName',
    descKey: 'toolTripDesc',
  },
  {
    id: 'split-rent',
    kind: 'split',
    path: null,
    icon: HouseIcon,
    nameKey: 'toolRentName',
    descKey: 'toolRentDesc',
  },
  {
    id: 'split-shopping',
    kind: 'split',
    path: null,
    icon: ShoppingBagIcon,
    nameKey: 'toolShoppingName',
    descKey: 'toolShoppingDesc',
  },
  {
    id: 'split-utilities',
    kind: 'split',
    path: null,
    icon: ZapIcon,
    nameKey: 'toolUtilitiesName',
    descKey: 'toolUtilitiesDesc',
  },
]
