import { useState } from 'react'

import { addVat, removeVat } from '@/shared/lib/percentage'
import { formatAmount } from '@/shared/lib/money'
import { useI18n } from '@/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import {
  ModeTabs,
  NumberField,
  parseNumber,
  ResultCard,
  WorkingRow,
} from './fields'

const MODES = ['add', 'remove'] as const
type Mode = (typeof MODES)[number]

/**
 * VAT, both ways.
 *
 * Adding it is easy arithmetic anyone can do. Taking it back out is the reason
 * this page exists: ฿107 including 7% VAT is ฿100 before it, not ฿99.51, and
 * subtracting the percentage is the mistake almost everyone makes.
 */
export function VatCalculator() {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('add')
  const [amountRaw, setAmountRaw] = useState('')
  const [vatRaw, setVatRaw] = useState('7')

  const amount = parseNumber(amountRaw)
  const vatPct = parseNumber(vatRaw)
  const ready = amount !== null && vatPct !== null && amount >= 0 && vatPct >= 0

  const answer = () => {
    if (!ready) return null

    if (mode === 'add') {
      const { vat, total } = addVat(amount, vatPct)
      return {
        working: [
          { label: t('calcBeforeVat'), value: formatAmount(amount) },
          { label: t('calcVatAmount'), value: formatAmount(vat) },
        ],
        headline: t('calcTotalWithVat'),
        result: formatAmount(total),
      }
    }

    const { net, vat } = removeVat(amount, vatPct)
    return {
      working: [
        { label: t('calcTotalWithVat'), value: formatAmount(amount) },
        { label: t('calcVatAmount'), value: formatAmount(vat) },
      ],
      headline: t('calcBeforeVat'),
      result: formatAmount(net),
    }
  }

  const shown = answer()

  return (
    <div className="flex flex-col gap-5">
      <ModeTabs
        label={t('calcVatModes')}
        modes={MODES}
        current={mode}
        onChange={setMode}
        labelFor={(m) => (m === 'add' ? t('calcAddVat') : t('calcRemoveVat'))}
      />

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="text-muted-foreground text-sm">
            {mode === 'add' ? t('calcAddVatHelp') : t('calcRemoveVatHelp')}
          </p>

          <NumberField
            id="vatAmount"
            label={mode === 'add' ? t('calcBeforeVat') : t('calcTotalWithVat')}
            unit="฿"
            value={amountRaw}
            onChange={setAmountRaw}
          />
          <NumberField
            id="vatPct"
            label={t('calcVatRate')}
            unit="%"
            value={vatRaw}
            onChange={setVatRaw}
          />
        </CardContent>
      </Card>

      {shown && (
        <ResultCard
          headline={shown.headline}
          result={shown.result}
          copyText={`${shown.headline}: ${shown.result}`}
        >
          {shown.working.map((row) => (
            <WorkingRow key={row.label} label={row.label} value={row.value} />
          ))}
        </ResultCard>
      )}
    </div>
  )
}
