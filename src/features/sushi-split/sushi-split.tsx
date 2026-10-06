import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import {
  CheckIcon,
  CopyIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react'

import { formatBaht } from '@/shared/lib/money'
import { newId } from '@/shared/lib/id'
import { useI18n } from '@/i18n/context'
import type { TranslationKey } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import { ValueKindToggle } from '@/shared/components/value-kind-toggle'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PRESET_RESTAURANTS } from './restaurants'
import {
  addDiner,
  addPlate,
  changeCount,
  foodSoFar,
  isUnpriced,
  linesFor,
  OTHER,
  PLATE_COLORS,
  plateCount,
  priceOf,
  removeDiner,
  removePlate,
  startSession,
  switchRestaurant,
  toRestaurant,
  updatePlate,
  type PlateColor,
  type SushiSession,
} from './session'
import { calculateSushiSplit, createSushiSchema } from './schema'
import {
  clearSession,
  forgetRestaurant,
  loadRestaurants,
  loadSession,
  saveRestaurant,
  saveSession,
} from './storage'

/** What each colour looks like on screen. Visual only — the label always shows. */
const SWATCH: Record<PlateColor, string> = {
  red: '#dc2626',
  orange: '#ea580c',
  yellow: '#eab308',
  green: '#16a34a',
  blue: '#2563eb',
  purple: '#9333ea',
  pink: '#ec4899',
  brown: '#92400e',
  black: '#111827',
  white: '#ffffff',
  silver: '#9ca3af',
  gold: '#ca8a04',
}

const COLOR_NAME: Record<PlateColor, TranslationKey> = {
  red: 'ssColorRed',
  orange: 'ssColorOrange',
  yellow: 'ssColorYellow',
  green: 'ssColorGreen',
  blue: 'ssColorBlue',
  purple: 'ssColorPurple',
  pink: 'ssColorPink',
  brown: 'ssColorBrown',
  black: 'ssColorBlack',
  white: 'ssColorWhite',
  silver: 'ssColorSilver',
  gold: 'ssColorGold',
}

function Swatch({ color }: { color: PlateColor | null }) {
  return (
    <span
      aria-hidden
      className="border-border size-5 shrink-0 rounded-full border"
      style={{ background: color ? SWATCH[color] : 'transparent' }}
    />
  )
}

function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        ฿
      </span>
      <Input
        type="number"
        step="any"
        inputMode="decimal"
        placeholder="0"
        className={cn('pl-7', className)}
        {...props}
      />
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

function PersonPill({
  name,
  pressed,
  onClick,
}: {
  name: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'focus-visible:ring-ring/50 h-8 rounded-full border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input text-muted-foreground hover:bg-accent',
      )}
    >
      {name}
    </button>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

/** A percentage that can be switched off, greying out when it is. */
function ChargeRow({
  id,
  label,
  toggleLabel,
  enabled,
  onToggle,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  toggleLabel: string
  enabled: boolean
  onToggle: (on: boolean) => void
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Switch
          aria-label={toggleLabel}
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <Label
          htmlFor={id}
          className={cn('flex-1', !enabled && 'text-muted-foreground')}
        >
          {label}
        </Label>
        <div className="w-20 shrink-0">
          <Input
            id={id}
            type="number"
            step="any"
            inputMode="decimal"
            disabled={!enabled}
            aria-invalid={!!error}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </div>
      <FieldError message={error} />
    </div>
  )
}

export function SushiSplit() {
  const { t } = useI18n()
  const nameOf = (color: PlateColor) => t(COLOR_NAME[color])

  const [saved, setSaved] = useState(loadRestaurants)
  const [session, setSession] = useState<SushiSession>(
    () => loadSession() ?? startSession(null, nameOf),
  )
  const [attempted, setAttempted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Kept on the device as it changes, so a refresh mid-meal costs nothing.
  useEffect(() => saveSession(session), [session])

  /*
   * The built-in restaurants, each replaced by the diner's own saved prices
   * when there are some — so "Sushiro" appears once, with their prices, rather
   * than twice. Then the restaurants they typed in themselves.
   */
  const presetIds = new Set(PRESET_RESTAURANTS.map((r) => r.id))
  const presets = PRESET_RESTAURANTS.map(
    (preset) => saved.find((r) => r.id === preset.id) ?? preset,
  )
  const customs = saved.filter((r) => !presetIds.has(r.id))
  const restaurants = [...presets, ...customs]

  const isSaved = saved.some((r) => r.id === session.restaurantId)
  const isPreset = presetIds.has(session.restaurantId)
  const current = restaurants.find((r) => r.id === session.restaurantId)
  // A built-in restaurant nobody has priced yet: say so, rather than leave
  // blank boxes looking like a fault.
  const needsPrices = !!current && isUnpriced(current)

  const schema = useMemo(() => createSushiSchema(t), [t])
  const parsed = attempted ? schema.safeParse(session) : null

  /** The first message for each field, keyed by its path. */
  const errors: Record<string, string> = {}
  if (parsed && !parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.')
      errors[path] ??= issue.message
    }
  }

  // Worked out from the session itself, so any edit after Calculate updates it.
  const result = parsed?.success ? calculateSushiSplit(parsed.data) : null

  const update = (next: (s: SushiSession) => SushiSession) => {
    setSession(next)
    setCopied(false)
    setJustSaved(false)
  }

  const named = session.diners.map((diner, index) => ({
    id: diner.id,
    name: diner.name.trim() || `${t('ssDinerPlaceholder')} ${index + 1}`,
  }))
  const nameOfDiner = (id: string) =>
    named.find((diner) => diner.id === id)?.name ?? ''

  const pricesReady =
    session.restaurantName.trim() !== '' &&
    session.plates.length > 0 &&
    session.plates.every((p) => p.label.trim() !== '' && priceOf(p) !== null)

  const chooseRestaurant = (id: string) => {
    const restaurant = restaurants.find((r) => r.id === id) ?? null
    update((s) => switchRestaurant(s, restaurant, nameOf))
  }

  const keepRestaurant = () => {
    /*
     * A built-in restaurant keeps its own id, so the saved prices sit on top of
     * it instead of beside it. Saving again updates the same entry. Only a
     * restaurant typed in from scratch needs a new id.
     */
    const id = isPreset || isSaved ? session.restaurantId : newId()
    setSaved((list) => saveRestaurant(list, toRestaurant(session, id)))
    setSession((s) => ({ ...s, restaurantId: id }))
    setJustSaved(true)
  }

  const forget = () => {
    setSaved((list) => forgetRestaurant(list, session.restaurantId))
    /*
     * A built-in restaurant is still in the list after its saved prices go, so
     * the session stays pointed at it. One typed in by hand is gone entirely.
     * Either way the session keeps its own copy of the prices — nothing on
     * screen moves until the next meal.
     */
    if (!isPreset) setSession((s) => ({ ...s, restaurantId: OTHER }))
  }

  const startOver = () => {
    clearSession()
    const same = restaurants.find((r) => r.id === session.restaurantId) ?? null
    setSession(startSession(same, nameOf))
    setAttempted(false)
    setCopied(false)
  }

  const copyText = result
    ? [
        `🍣 ${t('ssCopyHeading', { name: session.restaurantName.trim() })}`,
        '',
        ...result.bill.participants.flatMap((share) => [
          nameOfDiner(share.participantId),
          `${t('ssRowFood')} ${formatBaht(share.food)}`,
          `${t('ssRowTotal')} ${formatBaht(share.total)}`,
          '',
        ]),
        `${t('ssFoodTotal')}: ${formatBaht(result.charges.food)}`,
        ...(result.charges.discount > 0
          ? [`${t('ssDiscount')}: −${formatBaht(result.charges.discount)}`]
          : []),
        `${t('ssServiceCharge')}: ${formatBaht(result.charges.serviceCharge)}`,
        `${t('ssVat')}: ${formatBaht(result.charges.vat)}`,
        `${t('ssGrandTotal')}: ${formatBaht(result.charges.grandTotal)}`,
      ].join('\n')
    : ''

  const handleCopy = async () => {
    if (!copyText) return
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Where — and that restaurant's own prices */}
      <Section title={t('ssWhere')} description={t('ssWhereHelp')}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="ssRestaurant">{t('ssRestaurant')}</Label>
          <select
            id="ssRestaurant"
            value={
              restaurants.some((r) => r.id === session.restaurantId)
                ? session.restaurantId
                : OTHER
            }
            onChange={(event) => chooseRestaurant(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
          >
            <optgroup label={t('ssPresetGroup')}>
              {presets.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </optgroup>
            {customs.length > 0 && (
              <optgroup label={t('ssSavedGroup')}>
                {customs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
            <option value={OTHER}>{t('ssOther')}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="ssRestaurantName">{t('ssRestaurantName')}</Label>
          <Input
            id="ssRestaurantName"
            placeholder={t('ssRestaurantNamePlaceholder')}
            // A built-in restaurant's name is known; renaming it would leave
            // its saved prices under a name that no longer matches the list.
            readOnly={isPreset}
            className={cn(isPreset && 'bg-muted text-muted-foreground')}
            aria-invalid={!!errors.restaurantName}
            value={session.restaurantName}
            onChange={(event) =>
              update((s) => ({ ...s, restaurantName: event.target.value }))
            }
          />
          <FieldError message={errors.restaurantName} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t('ssPlatePrices')}</Label>
          {needsPrices && (
            <p className="rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
              {t('ssNoPricesYet', { name: session.restaurantName })}
            </p>
          )}
          {session.plates.map((plate, index) => {
            const label = plate.label.trim() || `${t('ssPlate')} ${index + 1}`

            return (
              <div
                key={plate.id}
                className="flex flex-col gap-2 rounded-lg border p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Swatch color={plate.color} />
                  <Input
                    aria-label={`${t('ssPlate')} ${index + 1}`}
                    placeholder={t('ssPlateLabelPlaceholder')}
                    aria-invalid={!!errors[`plates.${index}.label`]}
                    value={plate.label}
                    onChange={(event) =>
                      update((s) =>
                        updatePlate(s, plate.id, { label: event.target.value }),
                      )
                    }
                  />
                  <div className="w-24 shrink-0">
                    <MoneyInput
                      aria-label={t('ssPriceOf', { plate: label })}
                      aria-invalid={!!errors[`plates.${index}.price`]}
                      value={plate.price}
                      onChange={(event) =>
                        update((s) =>
                          updatePlate(s, plate.id, { price: event.target.value }),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('ssRemovePlate', { plate: label })}
                    disabled={session.plates.length <= 1}
                    onClick={() => update((s) => removePlate(s, plate.id))}
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                <select
                  aria-label={t('ssColourOf', { plate: label })}
                  value={plate.color ?? ''}
                  onChange={(event) =>
                    update((s) =>
                      updatePlate(s, plate.id, {
                        color: (event.target.value || null) as PlateColor | null,
                      }),
                    )
                  }
                  className="border-input bg-background text-muted-foreground h-8 w-fit rounded-md border px-2 text-xs outline-none"
                >
                  <option value="">{t('ssNoColour')}</option>
                  {PLATE_COLORS.map((color) => (
                    <option key={color} value={color}>
                      {t(COLOR_NAME[color])}
                    </option>
                  ))}
                </select>

                <FieldError
                  message={
                    errors[`plates.${index}.label`] ??
                    errors[`plates.${index}.price`]
                  }
                />
              </div>
            )
          })}
          <FieldError message={errors.plates} />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update(addPlate)}
            >
              <PlusIcon />
              {t('ssAddPlate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!pricesReady}
              onClick={keepRestaurant}
            >
              {justSaved ? <CheckIcon /> : null}
              {justSaved
                ? t('ssSaved')
                : isSaved
                  ? t('ssUpdateRestaurant')
                  : isPreset
                    ? t('ssSavePrices')
                    : t('ssSaveRestaurant')}
            </Button>
            {isSaved && (
              <Button type="button" variant="ghost" size="sm" onClick={forget}>
                {isPreset ? t('ssClearSavedPrices') : t('ssForgetRestaurant')}
              </Button>
            )}
          </div>
        </div>
      </Section>

      {/* 2. Who is eating, and who is paying */}
      <Section title={t('ssWho')}>
        {session.diners.map((diner, index) => (
          <div key={diner.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`${t('ssDinerPlaceholder')} ${index + 1}`}
                placeholder={`${t('ssDinerPlaceholder')} ${index + 1}`}
                aria-invalid={!!errors[`diners.${index}.name`]}
                value={diner.name}
                onChange={(event) =>
                  update((s) => ({
                    ...s,
                    diners: s.diners.map((d) =>
                      d.id === diner.id ? { ...d, name: event.target.value } : d,
                    ),
                  }))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('ssRemoveDiner', { name: named[index].name })}
                disabled={session.diners.length <= 1}
                onClick={() => update((s) => removeDiner(s, diner.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <FieldError message={errors[`diners.${index}.name`]} />
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => update(addDiner)}
        >
          <PlusIcon />
          {t('ssAddDiner')}
        </Button>

        <div className="flex flex-col gap-2 pt-1">
          <Label>{t('ssWhoPaid')}</Label>
          <div className="flex flex-wrap gap-2">
            {named.map((diner) => (
              <PersonPill
                key={diner.id}
                name={diner.name}
                pressed={diner.id === session.payerId}
                onClick={() => update((s) => ({ ...s, payerId: diner.id }))}
              />
            ))}
          </div>
          <FieldError message={errors.payerId} />
        </div>
      </Section>

      {/*
        3. The plates — the part people tap dozens of times. Big buttons, the
        count between them, and the running total always in view on each card.
      */}
      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t('ssCount')}</h2>
        {session.diners.map((diner, dinerIndex) => {
          const name = named[dinerIndex].name
          const plates = plateCount(diner)

          return (
            <Card key={diner.id}>
              <CardHeader>
                <CardTitle className="text-base">{name}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {session.plates.map((plate, plateIndex) => {
                  const quantity = diner.counts[plate.id] ?? 0
                  const label =
                    plate.label.trim() || `${t('ssPlate')} ${plateIndex + 1}`
                  const price = priceOf(plate)

                  return (
                    <div
                      key={plate.id}
                      className="flex items-center gap-3 rounded-lg border p-2"
                    >
                      <Swatch color={plate.color} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{label}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {price === null ? '—' : `฿${price}`}
                          {quantity > 0 && price !== null && (
                            <> · ฿{quantity * price}</>
                          )}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11 shrink-0"
                        aria-label={t('ssDecrease', { plate: label, name })}
                        disabled={quantity === 0}
                        onClick={() =>
                          update((s) => changeCount(s, diner.id, plate.id, -1))
                        }
                      >
                        <MinusIcon />
                      </Button>
                      <span
                        aria-live="polite"
                        aria-label={t('ssCountOf', { plate: label, name })}
                        className="w-7 text-center text-lg font-semibold tabular-nums"
                      >
                        {quantity}
                      </span>
                      <Button
                        type="button"
                        className="size-11 shrink-0"
                        aria-label={t('ssIncrease', { plate: label, name })}
                        onClick={() =>
                          update((s) => changeCount(s, diner.id, plate.id, 1))
                        }
                      >
                        <PlusIcon />
                      </Button>
                    </div>
                  )
                })}

                <p className="flex items-baseline justify-between border-t pt-2 text-sm">
                  <span className="text-muted-foreground">
                    {t('ssPlateCount', { count: plates })}
                  </span>
                  <span
                    aria-label={t('ssFoodOf', { name })}
                    className="font-semibold tabular-nums"
                  >
                    {formatBaht(foodSoFar(diner, session.plates))}
                  </span>
                </p>
              </CardContent>
            </Card>
          )
        })}
        <FieldError message={errors.diners} />
      </div>

      {/* 4. What the restaurant adds, and anything taken off */}
      <Section title={t('ssCharges')} description={t('ssChargesHelp')}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="ssDiscount" className="flex-1">
              {t('ssDiscount')}
            </Label>
            <ValueKindToggle
              kind={session.discountKind}
              label={t('ssDiscountKind')}
              onChange={(kind) => update((s) => ({ ...s, discountKind: kind }))}
            />
            <div className="w-24 shrink-0">
              <Input
                id="ssDiscount"
                type="number"
                step="any"
                inputMode="decimal"
                aria-invalid={!!errors.discountValue}
                value={session.discountValue}
                onChange={(event) =>
                  update((s) => ({ ...s, discountValue: event.target.value }))
                }
              />
            </div>
          </div>
          <FieldError message={errors.discountValue} />
        </div>

        <ChargeRow
          id="ssServicePct"
          label={t('ssServiceChargePct')}
          toggleLabel={t('ssIncludeServiceCharge')}
          enabled={session.serviceChargeEnabled}
          onToggle={(on) =>
            update((s) => ({ ...s, serviceChargeEnabled: on }))
          }
          value={session.serviceChargePct}
          onChange={(value) =>
            update((s) => ({ ...s, serviceChargePct: value }))
          }
          error={errors.serviceChargePct}
        />
        <ChargeRow
          id="ssVatPct"
          label={t('ssVatPct')}
          toggleLabel={t('ssIncludeVat')}
          enabled={session.vatEnabled}
          onToggle={(on) => update((s) => ({ ...s, vatEnabled: on }))}
          value={session.vatPct}
          onChange={(value) => update((s) => ({ ...s, vatPct: value }))}
          error={errors.vatPct}
        />
      </Section>

      <div className="flex gap-2">
        <Button
          type="button"
          size="lg"
          className="flex-1"
          onClick={() => setAttempted(true)}
        >
          {t('calculate')}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={startOver}
          aria-label={t('ssStartOver')}
        >
          <RotateCcwIcon />
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('ssResult')}</CardTitle>
            <CardDescription>{session.restaurantName.trim()}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* The bill, in the order it was worked out — discount first. */}
            <div className="flex flex-col gap-1 text-sm tabular-nums">
              <SummaryRow label={t('ssFoodTotal')} value={result.charges.food} />
              {result.charges.discount > 0 && (
                <SummaryRow
                  label={t('ssDiscount')}
                  value={-result.charges.discount}
                />
              )}
              <SummaryRow
                label={t('ssServiceCharge')}
                value={result.charges.serviceCharge}
              />
              <SummaryRow label={t('ssVat')} value={result.charges.vat} />
              <p className="flex justify-between border-t pt-1 font-semibold">
                <span>{t('ssGrandTotal')}</span>
                <span>{formatBaht(result.charges.grandTotal)}</span>
              </p>
            </div>

            <ul aria-label={t('ssResult')} className="flex flex-col gap-2">
              {result.bill.participants.map((share) => {
                const diner = session.diners.find(
                  (d) => d.id === share.participantId,
                )!
                const isPayer = share.participantId === session.payerId

                return (
                  <li
                    key={share.participantId}
                    className={cn(
                      'flex flex-col gap-1 rounded-lg border p-3',
                      isPayer && 'bg-primary/5',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {nameOfDiner(share.participantId)}
                        {isPayer && (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            — {t('ssPaid')}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatBaht(share.total)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {t('ssRowFood')} {formatBaht(share.food, false)}
                      {' · '}
                      {t('ssRowFees')} {formatBaht(share.fees, false)}
                      {share.discount > 0 && (
                        <>
                          {' · '}
                          {t('ssRowDiscount')} −
                          {formatBaht(share.discount, false)}
                        </>
                      )}
                    </p>

                    {/* Which plates make up their food, for checking. */}
                    <details className="text-xs">
                      <summary className="text-muted-foreground cursor-pointer">
                        {t('ssShowPlates')}
                      </summary>
                      <ul className="mt-1 flex flex-col gap-0.5 tabular-nums">
                        {linesFor(diner, session.plates).map((line) => (
                          <li
                            key={line.plate.id}
                            className="flex items-center gap-2"
                          >
                            <Swatch color={line.plate.color} />
                            <span className="flex-1">
                              {line.plate.label} × {line.quantity}
                            </span>
                            <span>{formatBaht(line.subtotal, false)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </li>
                )
              })}
            </ul>

            {result.bill.transfers.length > 0 && (
              <div className="flex flex-col gap-1 text-sm">
                {result.bill.transfers.map((transfer) => (
                  <p key={transfer.from}>
                    {t('ssOwes', {
                      from: nameOfDiner(transfer.from),
                      to: nameOfDiner(transfer.to),
                      amount: formatBaht(transfer.amount),
                    })}
                  </p>
                ))}
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              {t('ssReconciles', {
                amount: formatBaht(result.charges.grandTotal),
              })}
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('copyResult')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>
        {value < 0 ? '−' : ''}
        {formatBaht(Math.abs(value))}
      </span>
    </p>
  )
}
