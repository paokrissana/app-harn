import { useState, type ComponentProps, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { calculateBill, type BillResult } from '@/shared/lib/bill'
import { formatBaht } from '@/shared/lib/money'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
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
import {
  createGroupMealSchema,
  toBill,
  type GroupMealFormInput,
  type GroupMealFormOutput,
} from './schema'
import {
  displayName,
  emptyMeal,
  newDish,
  toggleEater,
  withPerson,
  withoutPerson,
} from './meal-form'

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
        placeholder="0.00"
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

/** A tappable name — used for who ate a dish and for who paid. */
function PersonPill({
  name,
  pressed,
  onClick,
  label,
}: {
  name: string
  pressed: boolean
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
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
  label,
  htmlFor,
  enabled,
  toggle,
  error,
  children,
}: {
  label: string
  htmlFor: string
  enabled: boolean
  toggle: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {toggle}
        <Label
          htmlFor={htmlFor}
          className={cn('flex-1', !enabled && 'text-muted-foreground')}
        >
          {label}
        </Label>
        <div className="w-20 shrink-0">{children}</div>
      </div>
      <FieldError message={error} />
    </div>
  )
}

export function SplitGroupMeal() {
  const [result, setResult] = useState<BillResult | null>(null)
  const [copied, setCopied] = useState(false)
  const { t } = useI18n()

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<GroupMealFormInput, unknown, GroupMealFormOutput>({
    resolver: zodResolver(createGroupMealSchema(t)),
    defaultValues: emptyMeal(),
  })

  const people = useFieldArray({ control, name: 'people' })
  const dishes = useFieldArray({ control, name: 'dishes' })

  const watchedPeople = useWatch({ control, name: 'people' }) ?? []
  const watchedDishes = useWatch({ control, name: 'dishes' }) ?? []
  const payerId = useWatch({ control, name: 'payerId' }) ?? ''
  const serviceChargeEnabled = useWatch({
    control,
    name: 'serviceChargeEnabled',
  })
  const vatEnabled = useWatch({ control, name: 'vatEnabled' })

  /** Everyone, with a placeholder for whoever has not been named yet. */
  const named = watchedPeople.map((person, index) => ({
    id: person.id,
    name: displayName(person.name, index, t('gmPersonPlaceholder')),
  }))
  const nameOf = (id: string) =>
    named.find((person) => person.id === id)?.name ?? ''

  const onSubmit = (values: GroupMealFormOutput) => {
    setResult(calculateBill(toBill(values)))
    setCopied(false)
  }

  // Both of these rewrite dishes as well as people, so they go through reset.
  const addPerson = () => reset(withPerson(getValues()))
  const removePerson = (personId: string) => {
    reset(withoutPerson(getValues(), personId))
    setResult(null)
  }

  const addDish = () =>
    dishes.append(newDish(watchedPeople.map((person) => person.id)))

  const setEaters = (index: number, sharedBy: string[]) =>
    setValue(`dishes.${index}.sharedBy`, sharedBy, { shouldValidate: true })

  const owedLines = result
    ? result.participants.filter((share) => share.participantId !== payerId)
    : []

  const summary = result
    ? [
        `${t('gmBillTotal')}: ${formatBaht(result.grandTotal)}`,
        ...owedLines.map((share) =>
          t('gmCopySummary', {
            name: nameOf(share.participantId),
            amount: formatBaht(share.total),
          }),
        ),
      ].join('\n')
    : ''

  const handleCopy = async () => {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* Who is at the table */}
        <Section title={t('gmPeople')}>
          {people.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`${t('gmPersonPlaceholder')} ${index + 1}`}
                  placeholder={`${t('gmPersonPlaceholder')} ${index + 1}`}
                  aria-invalid={!!errors.people?.[index]?.name}
                  {...register(`people.${index}.name`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('gmRemovePerson', {
                    name: named[index]?.name ?? '',
                  })}
                  disabled={people.fields.length <= 2}
                  onClick={() => removePerson(getValues(`people.${index}.id`))}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <FieldError message={errors.people?.[index]?.name?.message} />
            </div>
          ))}
          <FieldError
            message={errors.people?.root?.message ?? errors.people?.message}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addPerson}
          >
            <PlusIcon />
            {t('gmAddPerson')}
          </Button>

          <div className="flex flex-col gap-2 pt-1">
            <Label>{t('gmWhoPaid')}</Label>
            <div className="flex flex-wrap gap-2">
              {named.map((person) => (
                <PersonPill
                  key={person.id}
                  name={person.name}
                  pressed={person.id === payerId}
                  onClick={() =>
                    setValue('payerId', person.id, { shouldValidate: true })
                  }
                />
              ))}
            </div>
            <FieldError message={errors.payerId?.message} />
          </div>
        </Section>

        {/* The dishes, shared by the whole table unless told otherwise */}
        <Section title={t('gmDishes')} description={t('gmDishesHelp')}>
          {dishes.fields.map((field, index) => {
            const dish = watchedDishes[index]
            if (!dish) return null
            const label = dish.title.trim() || `${t('gmDish')} ${index + 1}`
            const everyone = dish.sharedBy.length === named.length

            return (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`${t('gmDish')} ${index + 1}`}
                    placeholder={t('gmDishPlaceholder')}
                    {...register(`dishes.${index}.title`)}
                  />
                  <div className="w-28 shrink-0">
                    <MoneyInput
                      aria-label={`${t('gmDish')} ${index + 1} ${t('gmPrice')}`}
                      aria-invalid={!!errors.dishes?.[index]?.price}
                      {...register(`dishes.${index}.price`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('gmRemoveDish', { title: label })}
                    onClick={() => dishes.remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <FieldError message={errors.dishes?.[index]?.price?.message} />

                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {t('gmWhoAte')}
                    </span>
                    {named.map((person) => (
                      <PersonPill
                        key={person.id}
                        name={person.name}
                        label={`${label}: ${person.name}`}
                        pressed={dish.sharedBy.includes(person.id)}
                        onClick={() =>
                          setEaters(
                            index,
                            toggleEater(dish.sharedBy, person.id),
                          )
                        }
                      />
                    ))}
                    {!everyone && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEaters(
                            index,
                            named.map((person) => person.id),
                          )
                        }
                      >
                        {t('gmEveryone')}
                      </Button>
                    )}
                  </div>
                  <FieldError
                    message={
                      errors.dishes?.[index]?.sharedBy?.root?.message ??
                      errors.dishes?.[index]?.sharedBy?.message
                    }
                  />
                </div>
              </div>
            )
          })}
          <FieldError
            message={errors.dishes?.root?.message ?? errors.dishes?.message}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={addDish}
          >
            <PlusIcon />
            {t('gmAddDish')}
          </Button>
        </Section>

        {/* What the restaurant adds at the bottom of the bill */}
        <Section title={t('gmCharges')}>
          <ChargeRow
            label={t('gmServiceCharge')}
            htmlFor="gmServiceChargePct"
            enabled={serviceChargeEnabled}
            error={errors.serviceChargePct?.message}
            toggle={
              <Switch
                aria-label={t('gmIncludeServiceCharge')}
                {...register('serviceChargeEnabled')}
              />
            }
          >
            <Input
              id="gmServiceChargePct"
              type="number"
              step="any"
              inputMode="decimal"
              disabled={!serviceChargeEnabled}
              aria-invalid={!!errors.serviceChargePct}
              {...register('serviceChargePct')}
            />
          </ChargeRow>

          <ChargeRow
            label={t('gmVat')}
            htmlFor="gmVatPct"
            enabled={vatEnabled}
            error={errors.vatPct?.message}
            toggle={
              <Switch
                aria-label={t('gmIncludeVat')}
                {...register('vatEnabled')}
              />
            }
          >
            <Input
              id="gmVatPct"
              type="number"
              step="any"
              inputMode="decimal"
              disabled={!vatEnabled}
              aria-invalid={!!errors.vatPct}
              {...register('vatPct')}
            />
          </ChargeRow>

          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="gmTotalBill" className="flex-1">
                {t('gmTotalBill')}
              </Label>
              <div className="w-28 shrink-0">
                <MoneyInput
                  id="gmTotalBill"
                  aria-invalid={!!errors.totalBill}
                  {...register('totalBill')}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('gmTotalBillHelp')}
            </p>
            <FieldError message={errors.totalBill?.message} />
          </div>
        </Section>

        <Button type="submit" size="lg">
          {t('calculate')}
        </Button>
      </form>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('gmResult')}</CardTitle>
            <CardDescription>
              {t('gmBillTotal')}: {formatBaht(result.grandTotal)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul aria-label={t('gmResult')} className="flex flex-col gap-2">
              {result.participants.map((share) => (
                <li
                  key={share.participantId}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3',
                    share.participantId === payerId && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {nameOf(share.participantId)}
                      {share.participantId === payerId && (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          — {t('gmPaid')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatBaht(share.total)}
                    </span>
                  </div>

                  {/* The working, so a wrong figure can be spotted. */}
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t('gmRowFood')} {formatBaht(share.food, false)}
                    {share.fees > 0 && (
                      <>
                        {' · '}
                        {t('gmRowCharges')} {formatBaht(share.fees, false)}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground text-xs">
              {t('gmReconciles', { amount: formatBaht(result.grandTotal) })}
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('gmCopyAll')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
