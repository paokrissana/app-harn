import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import {
  CheckIcon,
  CopyIcon,
  FilePlus2Icon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'

import {
  calculatePayback,
  formatTHB,
  type PaybackInput,
  type PaybackResult,
  type TipMode,
} from '@/lib/calculator'
import {
  addRecord,
  loadHistory,
  removeRecord,
  saveHistory,
  suggestBillName,
  updateRecord,
  type BillRecord,
} from '@/lib/history'
import {
  createPaybackSchema,
  type PaybackFormInput,
  type PaybackFormOutput,
} from '@/lib/schema'
import { useI18n } from '@/i18n/context'
import { cn } from '@/lib/utils'
import { BillHistory } from '@/components/bill-history'
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

const PAYER = 'A'

const EMPTY_FORM: PaybackFormInput = {
  name: '',
  totalBill: '',
  items: [{ name: '', price: '' }],
  sharedItems: [],
  serviceChargeEnabled: true,
  serviceChargePct: '10',
  vatEnabled: true,
  vatPct: '7',
  // Off by default: unlike service charge and VAT, most bills have no tip.
  tipEnabled: false,
  tipMode: 'percent',
  tipValue: '10',
}

/** Put a saved bill back into the form — every box takes text. */
function toFormValues(record: BillRecord): PaybackFormInput {
  const { input } = record
  return {
    name: record.name,
    totalBill: String(input.totalBill),
    items: input.items.map((item) => ({
      name: item.name,
      price: String(item.price),
    })),
    sharedItems: input.sharedItems.map((item) => ({
      name: item.name,
      price: String(item.price),
      shares: String(item.shares),
    })),
    serviceChargeEnabled: input.serviceChargeEnabled ?? true,
    serviceChargePct: String(input.serviceChargePct),
    vatEnabled: input.vatEnabled ?? true,
    vatPct: String(input.vatPct),
    // Bills saved before tips existed simply have none.
    tipEnabled: input.tipEnabled ?? false,
    tipMode: input.tipMode ?? 'percent',
    tipValue: input.tipEnabled
      ? String(input.tipValue ?? 0)
      : EMPTY_FORM.tipValue,
  }
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

/** A field laid out as: label on the left, input on the right. */
function FieldRow({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-x-3 gap-y-1">
      <Label htmlFor={htmlFor} className="leading-tight">
        {label}
      </Label>
      <div>{children}</div>
      {error && (
        <p className="text-destructive col-start-2 text-sm">{error}</p>
      )}
    </div>
  )
}

/**
 * A percentage field that can be switched off: toggle and label on the left,
 * a narrow input on the right that greys out when the charge does not apply.
 */
function ChargeRow({
  label,
  htmlFor,
  enabled,
  error,
  toggle,
  control,
  children,
}: {
  label: string
  htmlFor: string
  enabled: boolean
  error?: string
  toggle: ReactNode
  /** Optional extra control between the label and the box, e.g. % / ฿. */
  control?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {toggle}
        <Label
          htmlFor={htmlFor}
          className={cn(
            'flex-1 leading-tight',
            !enabled && 'text-muted-foreground',
          )}
        >
          {label}
        </Label>
        {control}
        <div className="w-24">{children}</div>
      </div>
      {error && <p className="text-destructive text-right text-sm">{error}</p>}
    </div>
  )
}

/** Switch a tip between a percentage of the bill and a flat sum in Baht. */
function TipModeToggle({
  mode,
  disabled,
  onChange,
}: {
  mode: TipMode
  disabled: boolean
  onChange: (mode: TipMode) => void
}) {
  const { t } = useI18n()

  const option = (value: TipMode, symbol: string, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === value}
      disabled={disabled}
      onClick={() => onChange(value)}
      className={cn(
        'h-7 w-8 text-sm font-medium transition-colors disabled:opacity-50',
        mode === value
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {symbol}
    </button>
  )

  return (
    <div
      role="group"
      aria-label={t('tipMode')}
      className={cn(
        'border-input flex shrink-0 overflow-hidden rounded-md border',
        disabled && 'opacity-50',
      )}
    >
      {option('percent', '%', t('tipAsPercent'))}
      {option('amount', '฿', t('tipAsAmount'))}
    </div>
  )
}

function MoneyInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        ฿
      </span>
      <Input className={cn('pl-7', className)} {...props} />
    </div>
  )
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          muted
            ? 'text-muted-foreground tabular-nums'
            : 'font-medium tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  )
}

export function SplitMealCalculator() {
  const { t } = useI18n()
  const [result, setResult] = useState<PaybackResult | null>(null)
  const [copied, setCopied] = useState(false)

  const schema = useMemo(() => createPaybackSchema(t), [t])

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaybackFormInput, unknown, PaybackFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_FORM,
  })

  const ownPlates = useFieldArray({ control, name: 'items' })
  const sharedPlates = useFieldArray({ control, name: 'sharedItems' })

  const serviceChargeEnabled = useWatch({
    control,
    name: 'serviceChargeEnabled',
  })
  const vatEnabled = useWatch({ control, name: 'vatEnabled' })
  const tipEnabled = useWatch({ control, name: 'tipEnabled' })
  const tipMode = useWatch({ control, name: 'tipMode' })
  const watchedItems = useWatch({ control, name: 'items' })
  const watchedShared = useWatch({ control, name: 'sharedItems' })

  const [records, setRecords] = useState<BillRecord[]>(loadHistory)
  /** The saved bill currently open in the form, if any. */
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    saveHistory(records)
  }, [records])

  const suggestedName = suggestBillName(
    watchedItems ?? [],
    watchedShared ?? [],
    t('billNameFallback'),
  )

  const editing = records.find((record) => record.id === editingId) ?? null

  const onSubmit = (values: PaybackFormOutput) => {
    setResult(calculatePayback(values))
    setCopied(false)

    const input: PaybackInput = {
      totalBill: values.totalBill,
      items: values.items,
      sharedItems: values.sharedItems,
      serviceChargeEnabled: values.serviceChargeEnabled,
      serviceChargePct: values.serviceChargePct,
      vatEnabled: values.vatEnabled,
      vatPct: values.vatPct,
      tipEnabled: values.tipEnabled,
      tipMode: values.tipMode,
      tipValue: values.tipValue,
    }
    const name = values.name || suggestedName

    // Reopened bills are overwritten; anything else is a new line in the list.
    setRecords((current) =>
      editingId
        ? updateRecord(current, editingId, input, name)
        : addRecord(current, input, name),
    )
  }

  const handleEditRecord = (record: BillRecord) => {
    reset(toFormValues(record))
    setEditingId(record.id)
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDeleteRecord = (id: string) => {
    setRecords((current) => removeRecord(current, id))
    if (id === editingId) setEditingId(null)
  }

  const handleClearRecords = () => {
    setRecords([])
    setEditingId(null)
  }

  const handleNewBill = () => {
    reset(EMPTY_FORM)
    setEditingId(null)
    setResult(null)
  }

  const settlement = result
    ? t('settlement', { amount: formatTHB(result.youPay), payer: PAYER })
    : ''

  const handleCopy = async () => {
    if (!settlement) return
    await navigator.clipboard.writeText(settlement)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const itemsError = errors.items?.root?.message ?? errors.items?.message

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            {editing && (
              <div className="border-primary/20 bg-primary/10 flex items-center gap-3 rounded-lg border p-3">
                <p className="text-muted-foreground flex-1 text-sm text-balance">
                  {t('editingBill', { name: editing.name })}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNewBill}
                >
                  <FilePlus2Icon />
                  {t('newBill')}
                </Button>
              </div>
            )}

            <FieldRow label={t('billName')} htmlFor="name">
              <Input
                id="name"
                placeholder={suggestedName}
                {...register('name')}
              />
            </FieldRow>

            {/* Your own plates */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>{t('yourPlates')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => ownPlates.append({ name: '', price: '' })}
                >
                  <PlusIcon />
                  {t('addPlate')}
                </Button>
              </div>

              {ownPlates.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      {t('plate')} {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={ownPlates.fields.length === 1}
                      onClick={() => ownPlates.remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <FieldRow label={t('dishName')}>
                    <Input
                      aria-label={`Item ${index + 1} name`}
                      placeholder={`${t('dishPlaceholder')} ${index + 1}`}
                      {...register(`items.${index}.name`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label={t('price')}
                    error={errors.items?.[index]?.price?.message}
                  >
                    <MoneyInput
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Item ${index + 1} price`}
                      aria-invalid={!!errors.items?.[index]?.price}
                      {...register(`items.${index}.price`)}
                    />
                  </FieldRow>
                </div>
              ))}
              <FieldError message={itemsError} />
            </div>

            {/* Shared plates */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('sharedPlates')}</Label>
                  <p className="text-muted-foreground text-xs">
                    {t('sharedHelp')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    sharedPlates.append({ name: '', price: '', shares: '2' })
                  }
                >
                  <PlusIcon />
                  {t('addShared')}
                </Button>
              </div>

              {sharedPlates.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      {t('sharedDish')} {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove shared item ${index + 1}`}
                      onClick={() => sharedPlates.remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <FieldRow label={t('dishName')}>
                    <Input
                      aria-label={`Shared item ${index + 1} name`}
                      placeholder={`${t('sharedDish')} ${index + 1}`}
                      {...register(`sharedItems.${index}.name`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label={t('price')}
                    error={errors.sharedItems?.[index]?.price?.message}
                  >
                    <MoneyInput
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Shared item ${index + 1} price`}
                      aria-invalid={!!errors.sharedItems?.[index]?.price}
                      {...register(`sharedItems.${index}.price`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label={t('sharedBy')}
                    error={errors.sharedItems?.[index]?.shares?.message}
                  >
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      inputMode="numeric"
                      placeholder={t('peoplePlaceholder')}
                      aria-label={`Shared item ${index + 1} people sharing`}
                      aria-invalid={!!errors.sharedItems?.[index]?.shares}
                      {...register(`sharedItems.${index}.shares`)}
                    />
                  </FieldRow>
                </div>
              ))}
            </div>

            {/* Charges — each one can be switched off entirely */}
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <span className="text-muted-foreground text-sm font-medium">
                {t('charges')}
              </span>

              <ChargeRow
                label={t('serviceChargePct')}
                htmlFor="serviceChargePct"
                enabled={serviceChargeEnabled}
                error={errors.serviceChargePct?.message}
                toggle={
                  <Switch
                    aria-label={t('includeServiceCharge')}
                    {...register('serviceChargeEnabled')}
                  />
                }
              >
                <Input
                  id="serviceChargePct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  disabled={!serviceChargeEnabled}
                  aria-invalid={!!errors.serviceChargePct}
                  {...register('serviceChargePct')}
                />
              </ChargeRow>

              <ChargeRow
                label={t('vatPct')}
                htmlFor="vatPct"
                enabled={vatEnabled}
                error={errors.vatPct?.message}
                toggle={
                  <Switch
                    aria-label={t('includeVat')}
                    {...register('vatEnabled')}
                  />
                }
              >
                <Input
                  id="vatPct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  disabled={!vatEnabled}
                  aria-invalid={!!errors.vatPct}
                  {...register('vatPct')}
                />
              </ChargeRow>

              <ChargeRow
                label={t('tip')}
                htmlFor="tipValue"
                enabled={tipEnabled}
                error={errors.tipValue?.message}
                toggle={
                  <Switch
                    aria-label={t('includeTip')}
                    {...register('tipEnabled')}
                  />
                }
                control={
                  <TipModeToggle
                    mode={tipMode}
                    disabled={!tipEnabled}
                    onChange={(mode) => setValue('tipMode', mode)}
                  />
                }
              >
                {tipMode === 'amount' ? (
                  <MoneyInput
                    id="tipValue"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    disabled={!tipEnabled}
                    aria-invalid={!!errors.tipValue}
                    {...register('tipValue')}
                  />
                ) : (
                  <Input
                    id="tipValue"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    disabled={!tipEnabled}
                    aria-invalid={!!errors.tipValue}
                    {...register('tipValue')}
                  />
                )}
              </ChargeRow>
            </div>

            {/* Last, like the bottom line of the receipt — reference only */}
            <FieldRow
              label={t('totalBill')}
              htmlFor="totalBill"
              error={errors.totalBill?.message}
            >
              <MoneyInput
                id="totalBill"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={!!errors.totalBill}
                {...register('totalBill')}
              />
            </FieldRow>

            <Button type="submit" className="w-full">
              {t('calculate')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>{t('result')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SummaryRow
              label={t('totalBillRef')}
              value={formatTHB(result.totalBill)}
              muted
            />

            <div className="border-border border-t" />

            <div
              role="group"
              aria-label={t('breakdown')}
              className="flex flex-col gap-2"
            >
              <SummaryRow
                label={t('yourPlates')}
                value={formatTHB(result.yourOwnFood)}
              />
              {result.yourSharedFood > 0 && (
                <SummaryRow
                  label={t('sharedShareRow')}
                  value={formatTHB(result.yourSharedFood)}
                />
              )}
              <SummaryRow
                label={t('yourFood')}
                value={formatTHB(result.yourFood)}
              />
              {result.serviceChargeApplied && (
                <SummaryRow
                  label={t('serviceChargeRow')}
                  value={formatTHB(result.serviceCharge)}
                />
              )}
              {result.vatApplied && (
                <SummaryRow label={t('vatRow')} value={formatTHB(result.vat)} />
              )}
              {result.tipApplied && (
                <SummaryRow label={t('tipRow')} value={formatTHB(result.tip)} />
              )}
            </div>

            <div className="border-primary/20 bg-primary/10 flex flex-col items-center gap-2 rounded-xl border p-5 text-center">
              <span className="text-muted-foreground text-sm font-medium">
                {t('youPay', { payer: PAYER })}
              </span>
              <span className="text-primary text-4xl font-extrabold tracking-tight tabular-nums">
                {formatTHB(result.youPay)}
              </span>
              <p className="text-muted-foreground text-sm text-balance">
                {settlement}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t('copied') : t('copyResult')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <BillHistory
        records={records}
        editingId={editingId}
        onEdit={handleEditRecord}
        onDelete={handleDeleteRecord}
        onClear={handleClearRecords}
      />
    </div>
  )
}
