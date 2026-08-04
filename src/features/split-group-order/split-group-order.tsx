import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { formatTHB } from '@/lib/calculator'
import { calculateBill, type BillResult } from '@/shared/lib/bill'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
import {
  ValueKindToggle,
  type ValueKind,
} from '@/shared/components/value-kind-toggle'
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
import {
  createGroupOrderSchema,
  toBill,
  type GroupOrderFormInput,
  type GroupOrderFormOutput,
} from './schema'
import {
  displayName,
  emptyOrder,
  newItem,
  newPerson,
  newPromo,
  toggleSharer,
  withoutPerson,
} from './order-form'

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

/** A tappable name — used for who shares a line and for who paid. */
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

/** One promo line: a % / ฿ switch, the number, and a way to drop it. */
function PromoRow({
  kind,
  kindLabel,
  onKindChange,
  inputProps,
  error,
  onRemove,
  removeLabel,
}: {
  kind: ValueKind
  kindLabel: string
  onKindChange: (kind: ValueKind) => void
  inputProps: ComponentProps<'input'>
  error?: string
  onRemove: () => void
  removeLabel: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <ValueKindToggle
          kind={kind}
          label={kindLabel}
          onChange={onKindChange}
        />
        <div className="flex-1">
          {kind === 'amount' ? (
            <MoneyInput {...inputProps} />
          ) : (
            <Input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              {...inputProps}
            />
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      <FieldError message={error} />
    </div>
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

export function SplitGroupOrder() {
  const { t } = useI18n()
  const [result, setResult] = useState<BillResult | null>(null)
  const [copied, setCopied] = useState(false)

  const schema = useMemo(() => createGroupOrderSchema(t), [t])

  const {
    register,
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
    formState: { errors },
  } = useForm<GroupOrderFormInput, unknown, GroupOrderFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: emptyOrder(),
  })

  const people = useFieldArray({ control, name: 'people' })
  const items = useFieldArray({ control, name: 'items' })
  const discounts = useFieldArray({ control, name: 'discounts' })
  const promos = useFieldArray({ control, name: 'deliveryPromos' })

  const watchedPeople = useWatch({ control, name: 'people' }) ?? []
  const watchedItems = useWatch({ control, name: 'items' }) ?? []
  const watchedDiscounts = useWatch({ control, name: 'discounts' }) ?? []
  const watchedPromos = useWatch({ control, name: 'deliveryPromos' }) ?? []
  const payerId = useWatch({ control, name: 'payerId' }) ?? ''
  const headcount = Number(useWatch({ control, name: 'headcount' })) || 0

  /** Everyone, with a placeholder for whoever has not been named yet. */
  const named = watchedPeople.map((person, index) => ({
    id: person.id,
    name: displayName(person.name, index, t('goPersonPlaceholder')),
  }))
  const nameOf = (id: string) =>
    named.find((person) => person.id === id)?.name ?? ''

  const onSubmit = (values: GroupOrderFormOutput) => {
    setResult(calculateBill(toBill(values)))
    setCopied(false)
  }

  const removePerson = (personId: string) => {
    // Their lines and every reference to them have to go at the same time.
    reset(withoutPerson(getValues(), personId))
    setResult(null)
  }

  const addPerson = () => {
    people.append(newPerson())
    // The group is at least as big as the list, so the count follows it up.
    const listed = people.fields.length + 1
    if ((Number(getValues('headcount')) || 0) < listed) {
      setValue('headcount', String(listed))
    }
  }

  const setSharers = (index: number, sharedBy: string[]) =>
    setValue(`items.${index}.sharedBy`, sharedBy, { shouldValidate: true })

  const owedLines = result
    ? result.participants.filter((share) => share.participantId !== payerId)
    : []

  const summary = result
    ? [
        `${t('goOrderTotal')}: ${formatTHB(result.grandTotal)}`,
        ...owedLines.map((share) =>
          t('goCopySummary', {
            name: nameOf(share.participantId),
            amount: formatTHB(share.total),
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
        {/* Who's in */}
        <Section title={t('goPeople')}>
          {people.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`${t('goPersonPlaceholder')} ${index + 1}`}
                  placeholder={`${t('goPersonPlaceholder')} ${index + 1}`}
                  aria-invalid={!!errors.people?.[index]?.name}
                  {...register(`people.${index}.name`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('goRemovePerson', {
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
            {t('goAddPerson')}
          </Button>

          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="headcount" className="flex-1">
                {t('goHeadcount')}
              </Label>
              <div className="w-20 shrink-0">
                <Input
                  id="headcount"
                  type="number"
                  step="1"
                  min="1"
                  inputMode="numeric"
                  aria-invalid={!!errors.headcount}
                  {...register('headcount')}
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              {t('goHeadcountHelp')}
            </p>
            <FieldError message={errors.headcount?.message} />
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Label>{t('goWhoPaid')}</Label>
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

        {/* What was ordered, filed the way the delivery app files it */}
        <Section title={t('goItems')} description={t('goSubtitle')}>
          {named.map((person) => (
            <div
              key={person.id}
              className="flex flex-col gap-3 rounded-lg border p-3"
            >
              <span className="text-sm font-semibold">{person.name}</span>

              {items.fields.map((field, index) => {
                const item = watchedItems[index]
                if (!item || item.addedBy !== person.id) return null

                const label = item.title.trim() || `${index + 1}`
                return (
                  <div key={field.id} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`${t('goItemPlaceholder')} ${index + 1}`}
                        placeholder={t('goItemPlaceholder')}
                        {...register(`items.${index}.title`)}
                      />
                      <div className="w-28 shrink-0">
                        <MoneyInput
                          aria-label={`${t('goItemPlaceholder')} ${index + 1} ${t('price')}`}
                          aria-invalid={!!errors.items?.[index]?.price}
                          {...register(`items.${index}.price`)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t('goRemoveItem', { title: label })}
                        onClick={() => items.remove(index)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {t('goSharedWith')}
                      </span>
                      {named.map((sharer) => (
                        <PersonPill
                          key={sharer.id}
                          name={sharer.name}
                          label={`${label}: ${sharer.name}`}
                          pressed={item.sharedBy.includes(sharer.id)}
                          onClick={() =>
                            setSharers(
                              index,
                              toggleSharer(item.sharedBy, sharer.id),
                            )
                          }
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSharers(
                            index,
                            named.map((sharer) => sharer.id),
                          )
                        }
                      >
                        {t('goEveryone')}
                      </Button>
                    </div>

                    <FieldError
                      message={errors.items?.[index]?.price?.message}
                    />
                    <FieldError
                      message={
                        errors.items?.[index]?.sharedBy?.root?.message ??
                        errors.items?.[index]?.sharedBy?.message
                      }
                    />
                  </div>
                )
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => items.append(newItem(person.id))}
              >
                <PlusIcon />
                {t('goAddItemFor', { name: person.name })}
              </Button>
            </div>
          ))}
          <FieldError
            message={errors.items?.root?.message ?? errors.items?.message}
          />
        </Section>

        {/* Delivery, its own promos, and the food discounts */}
        <Section title={t('goFees')}>
          <div className="flex items-center gap-2">
            <Label htmlFor="deliveryFee" className="flex-1">
              {t('goDeliveryFee')}
            </Label>
            <div className="w-28 shrink-0">
              <MoneyInput
                id="deliveryFee"
                aria-invalid={!!errors.deliveryFee}
                {...register('deliveryFee')}
              />
            </div>
          </div>
          <FieldError message={errors.deliveryFee?.message} />

          <div className="flex flex-col gap-2">
            <Label>{t('goDeliveryPromo')}</Label>
            {promos.fields.map((field, index) => (
              <PromoRow
                key={field.id}
                kind={watchedPromos[index]?.kind ?? 'percent'}
                kindLabel={`${t('goDeliveryPromo')} ${index + 1}: ${t('goPromoKind')}`}
                onKindChange={(kind) =>
                  setValue(`deliveryPromos.${index}.kind`, kind)
                }
                inputProps={{
                  'aria-label': `${t('goDeliveryPromo')} ${index + 1}`,
                  'aria-invalid': !!errors.deliveryPromos?.[index]?.value,
                  ...register(`deliveryPromos.${index}.value`),
                }}
                error={errors.deliveryPromos?.[index]?.value?.message}
                onRemove={() => promos.remove(index)}
                removeLabel={t('goRemovePromo')}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => promos.append(newPromo())}
            >
              <PlusIcon />
              {t('goAddDeliveryPromo')}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t('goDiscounts')}</Label>
            {discounts.fields.map((field, index) => (
              <PromoRow
                key={field.id}
                kind={watchedDiscounts[index]?.kind ?? 'percent'}
                kindLabel={`${t('goDiscounts')} ${index + 1}: ${t('goPromoKind')}`}
                onKindChange={(kind) =>
                  setValue(`discounts.${index}.kind`, kind)
                }
                inputProps={{
                  'aria-label': `${t('goDiscounts')} ${index + 1}`,
                  'aria-invalid': !!errors.discounts?.[index]?.value,
                  ...register(`discounts.${index}.value`),
                }}
                error={errors.discounts?.[index]?.value?.message}
                onRemove={() => discounts.remove(index)}
                removeLabel={t('goRemovePromo')}
              />
            ))}
            <FieldError
              message={
                errors.discounts?.root?.message ?? errors.discounts?.message
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => discounts.append(newPromo())}
            >
              <PlusIcon />
              {t('goAddDiscount')}
            </Button>
          </div>
        </Section>

        <Button type="submit" className="w-full">
          {t('calculate')}
        </Button>
      </form>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('goResult')}</CardTitle>
            <CardDescription>
              {t('goOrderTotal')}: {formatTHB(result.grandTotal)}
            </CardDescription>
            {headcount > named.length && (
              <CardDescription>
                {t('goPartialGroup', {
                  listed: named.length,
                  total: headcount,
                })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul aria-label={t('goResult')} className="flex flex-col gap-2">
              {result.participants.map((share) => (
                <li
                  key={share.participantId}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border p-3',
                    share.participantId === payerId && 'bg-primary/5',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {nameOf(share.participantId)}
                    {share.participantId === payerId && (
                      <span className="text-muted-foreground font-normal">
                        {' '}
                        — {t('goPaid')}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatTHB(share.total)}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-end"
              onClick={handleCopy}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('copied') : t('goCopyAll')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
