import {
  BikeIcon,
  CarTaxiFrontIcon,
  HouseIcon,
  LuggageIcon,
  ShoppingBagIcon,
  UtensilsCrossedIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react'

import type { TranslationKey } from '@/i18n/translations'

/** One AppHarn tool. `path` is null while the tool is still just an intention. */
export interface Tool {
  id: string
  path: string | null
  icon: LucideIcon
  nameKey: TranslationKey
  descKey: TranslationKey
}

/** Every tool from PROJECT.md, built or not, in the order the home page lists them. */
export const TOOLS: Tool[] = [
  {
    id: 'split-meal',
    path: '/split-meal',
    icon: UtensilsCrossedIcon,
    nameKey: 'toolMealName',
    descKey: 'toolMealDesc',
  },
  {
    id: 'split-group-order',
    path: '/split-group-order',
    icon: BikeIcon,
    nameKey: 'toolGroupOrderName',
    descKey: 'toolGroupOrderDesc',
  },
  {
    id: 'split-taxi',
    path: null,
    icon: CarTaxiFrontIcon,
    nameKey: 'toolTaxiName',
    descKey: 'toolTaxiDesc',
  },
  {
    id: 'split-trip',
    path: null,
    icon: LuggageIcon,
    nameKey: 'toolTripName',
    descKey: 'toolTripDesc',
  },
  {
    id: 'split-rent',
    path: null,
    icon: HouseIcon,
    nameKey: 'toolRentName',
    descKey: 'toolRentDesc',
  },
  {
    id: 'split-shopping',
    path: null,
    icon: ShoppingBagIcon,
    nameKey: 'toolShoppingName',
    descKey: 'toolShoppingDesc',
  },
  {
    id: 'split-utilities',
    path: null,
    icon: ZapIcon,
    nameKey: 'toolUtilitiesName',
    descKey: 'toolUtilitiesDesc',
  },
]
