import { useState } from 'react'

import { calculateTip } from '@/shared/lib/percentage'
import { formatAmount } from '@/shared/lib/money'
import { useI18n } from '@/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { NumberField, parseNumber, ResultCard, WorkingRow } from './fields'

/**
 * A tip, and what everyone hands over once it is on.
 *
 * Splitting is part of the same question rather than a separate tool: a tip on a
 * shared bill is almost always followed by "so how much each?", and making that
 * a second page would mean typing the same numbers twice.
 */
export function TipCalculator() {
  const { t } = useI18n()
  const [billRaw, setBillRaw] = useState('')
  const [tipRaw, setTipRaw] = useState('10')
  const [peopleRaw, setPeopleRaw] = useState('1')

  const bill = parseNumber(billRaw)
  const tipPct = parseNumber(tipRaw)
  const people = parseNumber(peopleRaw) ?? 1

  const ready = bill !== null && tipPct !== null && bill >= 0 && tipPct >= 0
  const result = ready ? calculateTip(bill, tipPct, people) : null
  const split = Math.max(Math.floor(people), 1) > 1

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="text-muted-foreground text-sm">{t('calcTipHelp')}</p>

          <NumberField
            id="tipBill"
            label={t('calcBillBeforeTip')}
            unit="฿"
            value={billRaw}
            onChange={setBillRaw}
          />
          <NumberField
            id="tipPct"
            label={t('calcTipRate')}
            unit="%"
            value={tipRaw}
            onChange={setTipRaw}
          />
          <NumberField
            id="tipPeople"
            label={t('calcSplitBetween')}
            unit={null}
            step="1"
            min="1"
            inputMode="numeric"
            value={peopleRaw}
            onChange={setPeopleRaw}
          />
        </CardContent>
      </Card>

      {result && (
        <ResultCard
          headline={split ? t('calcEachPerson') : t('calcTotalWithTip')}
          result={formatAmount(split ? result.each : result.total)}
          copyText={
            split
              ? `${t('calcEachPerson')}: ${formatAmount(result.each)}`
              : `${t('calcTotalWithTip')}: ${formatAmount(result.total)}`
          }
        >
          <WorkingRow
            label={t('calcBillBeforeTip')}
            value={formatAmount(bill!)}
          />
          <WorkingRow
            label={t('calcTipAmount')}
            value={`+ ${formatAmount(result.tip)}`}
          />
          {split && (
            <WorkingRow
              label={t('calcTotalWithTip')}
              value={formatAmount(result.total)}
            />
          )}
        </ResultCard>
      )}
    </div>
  )
}
