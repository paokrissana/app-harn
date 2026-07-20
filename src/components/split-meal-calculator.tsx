import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { CheckIcon, CopyIcon } from 'lucide-react'

import {
  calculateSplit,
  formatTHB,
  settlementSentence,
  type SplitResult,
} from '@/lib/calculator'
import {
  calculatorSchema,
  type CalculatorFormInput,
  type CalculatorFormOutput,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-destructive text-sm">{message}</p>
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function SplitMealCalculator() {
  const [result, setResult] = useState<SplitResult | null>(null)
  const [copied, setCopied] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CalculatorFormInput, unknown, CalculatorFormOutput>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      payer: 'A',
      foodA: '',
      foodB: '',
      serviceChargePct: '10',
      vatPct: '7',
    },
  })

  const onSubmit = (values: CalculatorFormOutput) => {
    setResult(calculateSplit(values))
    setCopied(false)
  }

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(settlementSentence(result))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Bill details</CardTitle>
          <CardDescription>
            Enter each person’s food amount and the charges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="payer">Bill payer</Label>
              <Controller
                control={control}
                name="payer"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="payer" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A</SelectItem>
                      <SelectItem value="B">B</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="foodA">Person A food amount</Label>
                <Input
                  id="foodA"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-invalid={!!errors.foodA}
                  {...register('foodA')}
                />
                <FieldError message={errors.foodA?.message} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="foodB">Person B food amount</Label>
                <Input
                  id="foodB"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-invalid={!!errors.foodB}
                  {...register('foodB')}
                />
                <FieldError message={errors.foodB?.message} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="serviceChargePct">Service charge %</Label>
                <Input
                  id="serviceChargePct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-invalid={!!errors.serviceChargePct}
                  {...register('serviceChargePct')}
                />
                <FieldError message={errors.serviceChargePct?.message} />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="vatPct">VAT %</Label>
                <Input
                  id="vatPct"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-invalid={!!errors.vatPct}
                  {...register('vatPct')}
                />
                <FieldError message={errors.vatPct?.message} />
              </div>
            </div>

            <Button type="submit" className="mt-2 w-full">
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
            <div className="flex flex-col gap-2">
              <SummaryRow label="Food total" value={formatTHB(result.foodTotal)} />
              <SummaryRow
                label="Service charge"
                value={formatTHB(result.serviceCharge)}
              />
              <SummaryRow label="VAT" value={formatTHB(result.vat)} />
              <SummaryRow
                label="Grand total"
                value={formatTHB(result.grandTotal)}
              />
            </div>

            <div className="border-border border-t" />

            <div className="flex flex-col gap-2">
              <SummaryRow
                label="Person A should pay"
                value={formatTHB(result.paymentA)}
              />
              <SummaryRow
                label="Person B should pay"
                value={formatTHB(result.paymentB)}
              />
            </div>

            <div className="bg-muted flex flex-col gap-3 rounded-lg p-4">
              <p className="text-center text-base font-semibold">
                {settlementSentence(result)}
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
