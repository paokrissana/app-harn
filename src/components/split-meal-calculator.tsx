import { useState, type ReactNode } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { CheckIcon, CopyIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import {
  calculatePayback,
  formatTHB,
  paybackSentence,
  type PaybackResult,
} from '@/lib/calculator'
import {
  paybackSchema,
  type PaybackFormInput,
  type PaybackFormOutput,
} from '@/lib/schema'
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Label htmlFor={htmlFor} className="w-28 shrink-0">
          {label}
        </Label>
        <div className="flex-1">{children}</div>
      </div>
      {error && (
        <p className="text-destructive pl-[7.75rem] text-sm">{error}</p>
      )}
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
  const [result, setResult] = useState<PaybackResult | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PaybackFormInput, unknown, PaybackFormOutput>({
    resolver: zodResolver(paybackSchema),
    defaultValues: {
      totalBill: '',
      items: [{ name: '', price: '' }],
      sharedItems: [],
      serviceChargePct: '10',
      vatPct: '7',
    },
  })

  const ownPlates = useFieldArray({ control, name: 'items' })
  const sharedPlates = useFieldArray({ control, name: 'sharedItems' })

  const onSubmit = (values: PaybackFormOutput) => {
    setResult(calculatePayback(values))
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(paybackSentence(result))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const itemsError = errors.items?.root?.message ?? errors.items?.message

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>What you owe</CardTitle>
          <CardDescription>
            Add your plates and any shared dishes, then service charge and VAT.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-5"
          >
            <FieldRow
              label="Total bill"
              htmlFor="totalBill"
              error={errors.totalBill?.message}
            >
              <Input
                id="totalBill"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0.00"
                aria-invalid={!!errors.totalBill}
                {...register('totalBill')}
              />
            </FieldRow>

            {/* Your own plates */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Your plates</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => ownPlates.append({ name: '', price: '' })}
                >
                  <PlusIcon />
                  Add plate
                </Button>
              </div>

              {ownPlates.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Plate {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove plate ${index + 1}`}
                      disabled={ownPlates.fields.length === 1}
                      onClick={() => ownPlates.remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <FieldRow label="Dish name">
                    <Input
                      aria-label={`Plate ${index + 1} name`}
                      placeholder={`Dish ${index + 1}`}
                      {...register(`items.${index}.name`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Price"
                    error={errors.items?.[index]?.price?.message}
                  >
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Plate ${index + 1} price`}
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
                  <Label>Shared plates</Label>
                  <p className="text-muted-foreground text-xs">
                    You pay price ÷ number of people sharing.
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
                  Add shared
                </Button>
              </div>

              {sharedPlates.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm font-medium">
                      Shared dish {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove shared dish ${index + 1}`}
                      onClick={() => sharedPlates.remove(index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                  <FieldRow label="Dish name">
                    <Input
                      aria-label={`Shared dish ${index + 1} name`}
                      placeholder={`Shared dish ${index + 1}`}
                      {...register(`sharedItems.${index}.name`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Price"
                    error={errors.sharedItems?.[index]?.price?.message}
                  >
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      placeholder="0.00"
                      aria-label={`Shared dish ${index + 1} price`}
                      aria-invalid={!!errors.sharedItems?.[index]?.price}
                      {...register(`sharedItems.${index}.price`)}
                    />
                  </FieldRow>
                  <FieldRow
                    label="Shared by"
                    error={errors.sharedItems?.[index]?.shares?.message}
                  >
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      inputMode="numeric"
                      placeholder="people"
                      aria-label={`Shared dish ${index + 1} people sharing`}
                      aria-invalid={!!errors.sharedItems?.[index]?.shares}
                      {...register(`sharedItems.${index}.shares`)}
                    />
                  </FieldRow>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <FieldRow
                label="Service charge %"
                htmlFor="serviceChargePct"
                error={errors.serviceChargePct?.message}
              >
                <Input
                  id="serviceChargePct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-invalid={!!errors.serviceChargePct}
                  {...register('serviceChargePct')}
                />
              </FieldRow>

              <FieldRow
                label="VAT %"
                htmlFor="vatPct"
                error={errors.vatPct?.message}
              >
                <Input
                  id="vatPct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-invalid={!!errors.vatPct}
                  {...register('vatPct')}
                />
              </FieldRow>
            </div>

            <Button type="submit" className="w-full">
              Calculate
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <SummaryRow
              label="Total bill (reference)"
              value={formatTHB(result.totalBill)}
              muted
            />

            <div className="border-border border-t" />

            <div className="flex flex-col gap-2">
              <SummaryRow
                label="Your plates"
                value={formatTHB(result.yourOwnFood)}
              />
              {result.yourSharedFood > 0 && (
                <SummaryRow
                  label="Shared plates (your share)"
                  value={formatTHB(result.yourSharedFood)}
                />
              )}
              <SummaryRow label="Your food" value={formatTHB(result.yourFood)} />
              <SummaryRow
                label="Service charge"
                value={formatTHB(result.serviceCharge)}
              />
              <SummaryRow label="VAT" value={formatTHB(result.vat)} />
            </div>

            <div className="bg-muted flex flex-col gap-3 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">You pay A</span>
                <span className="text-lg font-bold tabular-nums">
                  {formatTHB(result.youPay)}
                </span>
              </div>
              <p className="text-muted-foreground text-center text-sm">
                {paybackSentence(result)}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-center"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? 'Copied' : 'Copy result'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
