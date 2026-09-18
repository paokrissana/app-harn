import { useState, type ComponentProps, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'

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
import { calculateJourney, type JourneyResult } from './journey'
import {
  createJourneySchema,
  toJourney,
  type JourneyFormInput,
  type JourneyFormOutput,
} from './schema'
import {
  displayName,
  emptyJourney,
  newDrop,
  newFee,
  newPassenger,
  withoutPassenger,
} from './journey-form'

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

/** A tappable name — used for who got out and for who paid. */
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

export function JourneySplit() {
  const [result, setResult] = useState<JourneyResult | null>(null)
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
  } = useForm<JourneyFormInput, unknown, JourneyFormOutput>({
    resolver: zodResolver(createJourneySchema(t)),
    defaultValues: emptyJourney(),
  })

  const passengers = useFieldArray({ control, name: 'passengers' })
  const drops = useFieldArray({ control, name: 'drops' })
  const fees = useFieldArray({ control, name: 'fees' })

  const watchedPassengers = useWatch({ control, name: 'passengers' }) ?? []
  const watchedDrops = useWatch({ control, name: 'drops' }) ?? []
  const watchedFees = useWatch({ control, name: 'fees' }) ?? []
  const payerId = useWatch({ control, name: 'payerId' }) ?? ''

  /** Everyone, with a placeholder for whoever has not been named yet. */
  const named = watchedPassengers.map((passenger, index) => ({
    id: passenger.id,
    name: displayName(passenger.name, index, t('jsPassengerPlaceholder')),
  }))
  const nameOf = (id: string) =>
    named.find((passenger) => passenger.id === id)?.name ?? ''

  const onSubmit = (values: JourneyFormOutput) => {
    setResult(calculateJourney(toJourney(values)))
    setCopied(false)
  }

  const removePassenger = (passengerId: string) => {
    // Their drop and every reference to them has to go at the same time.
    reset(withoutPassenger(getValues(), passengerId))
    setResult(null)
  }

  const owedLines = result
    ? result.passengers.filter((share) => share.passengerId !== payerId)
    : []

  const summary = result
    ? [
        `${t('jsJourneyTotal')}: ${formatBaht(result.grandTotal)}`,
        ...owedLines.map((share) =>
          t('jsCopySummary', {
            name: nameOf(share.passengerId),
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
        {/* Who set off */}
        <Section title={t('jsPassengers')}>
          {passengers.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`${t('jsPassengerPlaceholder')} ${index + 1}`}
                  placeholder={`${t('jsPassengerPlaceholder')} ${index + 1}`}
                  aria-invalid={!!errors.passengers?.[index]?.name}
                  {...register(`passengers.${index}.name`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('jsRemovePassenger', {
                    name: named[index]?.name ?? '',
                  })}
                  disabled={passengers.fields.length <= 2}
                  onClick={() =>
                    removePassenger(getValues(`passengers.${index}.id`))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
              <FieldError
                message={errors.passengers?.[index]?.name?.message}
              />
            </div>
          ))}
          <FieldError
            message={
              errors.passengers?.root?.message ?? errors.passengers?.message
            }
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => passengers.append(newPassenger())}
          >
            <PlusIcon />
            {t('jsAddPassenger')}
          </Button>

          <div className="flex flex-col gap-2 pt-1">
            <Label>{t('jsWhoPaid')}</Label>
            <div className="flex flex-wrap gap-2">
              {named.map((passenger) => (
                <PersonPill
                  key={passenger.id}
                  name={passenger.name}
                  pressed={passenger.id === payerId}
                  onClick={() =>
                    setValue('payerId', passenger.id, { shouldValidate: true })
                  }
                />
              ))}
            </div>
            <FieldError message={errors.payerId?.message} />
          </div>
        </Section>

        {/* The meter, start and end */}
        <Section title={t('jsMeter')} description={t('jsMeterHelp')}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="startMeter" className="flex-1">
                {t('jsStartMeter')}
              </Label>
              <div className="w-28 shrink-0">
                <MoneyInput
                  id="startMeter"
                  aria-invalid={!!errors.startMeter}
                  {...register('startMeter')}
                />
              </div>
            </div>
            <FieldError message={errors.startMeter?.message} />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="endMeter" className="flex-1">
                {t('jsEndMeter')}
              </Label>
              <div className="w-28 shrink-0">
                <MoneyInput
                  id="endMeter"
                  aria-invalid={!!errors.endMeter}
                  {...register('endMeter')}
                />
              </div>
            </div>
            <FieldError message={errors.endMeter?.message} />
          </div>
        </Section>

        {/* Who got out where — the part that makes this not an even split */}
        <Section title={t('jsDrops')} description={t('jsDropsHelp')}>
          {drops.fields.map((field, index) => {
            const drop = watchedDrops[index]
            if (!drop) return null

            return (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    {t('jsDropWho')}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {named.map((passenger) => (
                      <PersonPill
                        key={passenger.id}
                        name={passenger.name}
                        label={`${t('jsDropNumber', { number: index + 1 })}: ${passenger.name}`}
                        pressed={drop.passengerId === passenger.id}
                        onClick={() =>
                          setValue(
                            `drops.${index}.passengerId`,
                            passenger.id,
                            { shouldValidate: true },
                          )
                        }
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('jsRemoveDrop', { number: index + 1 })}
                    onClick={() => drops.remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <FieldError
                  message={errors.drops?.[index]?.passengerId?.message}
                />

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`drop-${index}`}
                    className="text-muted-foreground flex-1 text-xs font-normal"
                  >
                    {t('jsDropMeter')}
                  </Label>
                  <div className="w-28 shrink-0">
                    <MoneyInput
                      id={`drop-${index}`}
                      aria-label={`${t('jsDropMeter')} ${index + 1}`}
                      aria-invalid={!!errors.drops?.[index]?.meter}
                      {...register(`drops.${index}.meter`)}
                    />
                  </div>
                </div>
                <FieldError message={errors.drops?.[index]?.meter?.message} />
              </div>
            )
          })}
          <FieldError
            message={errors.drops?.root?.message ?? errors.drops?.message}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => drops.append(newDrop())}
          >
            <PlusIcon />
            {t('jsAddDrop')}
          </Button>
        </Section>

        {/* Tolls, parking, anything on top of the meter */}
        <Section title={t('jsExtras')}>
          {fees.fields.map((field, index) => {
            const fee = watchedFees[index]
            if (!fee) return null
            const label = fee.label.trim() || `${t('jsExtras')} ${index + 1}`

            return (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-lg border p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`${t('jsExtraLabel')} ${index + 1}`}
                    placeholder={t('jsExtraPlaceholder')}
                    {...register(`fees.${index}.label`)}
                  />
                  <div className="w-28 shrink-0">
                    <MoneyInput
                      aria-label={`${t('jsExtraAmount')} ${index + 1}`}
                      aria-invalid={!!errors.fees?.[index]?.amount}
                      {...register(`fees.${index}.amount`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('jsRemoveExtra', { label })}
                    onClick={() => fees.remove(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <FieldError message={errors.fees?.[index]?.amount?.message} />

                <div
                  role="group"
                  aria-label={`${label}: ${t('jsSplitLabel')}`}
                  className="flex flex-wrap gap-1"
                >
                  {(['everyone', 'remaining'] as const).map((split) => (
                    <button
                      key={split}
                      type="button"
                      aria-pressed={fee.split === split}
                      onClick={() => setValue(`fees.${index}.split`, split)}
                      className={cn(
                        'focus-visible:ring-ring/50 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]',
                        fee.split === split
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {split === 'everyone'
                        ? t('jsSplitEveryone')
                        : t('jsSplitRemaining')}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => fees.append(newFee())}
          >
            <PlusIcon />
            {t('jsAddExtra')}
          </Button>
        </Section>

        <Button type="submit" size="lg">
          {t('calculate')}
        </Button>
      </form>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('jsResult')}</CardTitle>
            <CardDescription>
              {t('jsJourneyTotal')}: {formatBaht(result.grandTotal)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul aria-label={t('jsResult')} className="flex flex-col gap-2">
              {result.passengers.map((share) => (
                <li
                  key={share.passengerId}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-3',
                    share.passengerId === payerId && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {nameOf(share.passengerId)}
                      {share.passengerId === payerId && (
                        <span className="text-muted-foreground font-normal">
                          {' '}
                          — {t('jsPaid')}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {formatBaht(share.total)}
                    </span>
                  </div>

                  <p className="text-muted-foreground text-xs tabular-nums">
                    {t('jsMeterRow')} {formatBaht(share.fare, false)}
                    {share.fees > 0 && (
                      <>
                        {' · '}
                        {t('jsExtrasRow')} {formatBaht(share.fees, false)}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>

            <p className="text-muted-foreground text-xs">
              {t('jsReconciles', { amount: formatBaht(result.grandTotal) })}
            </p>

            {/*
              The stretch breakdown is the point of the tool: one number per
              person is not checkable, but "110 ÷ 3, and you were in for it" is.
            */}
            <section className="flex flex-col gap-2 border-t pt-3">
              <h3 className="text-sm font-medium">{t('jsSegments')}</h3>
              <ul className="flex flex-col gap-1.5">
                {result.segments.map((segment) => (
                  <li
                    key={`${segment.from}-${segment.to}`}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="tabular-nums">
                      {formatBaht(segment.from, false)} →{' '}
                      {formatBaht(segment.to, false)}
                    </span>
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-right">
                      {segment.aboard.map(nameOf).join(' · ')}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {t('jsSegmentShare', {
                        fare: formatBaht(segment.fare, false),
                        count: segment.aboard.length,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('jsCopyAll')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
