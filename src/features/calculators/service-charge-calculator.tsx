import { useState } from 'react'

import { restaurantCharges } from '@/shared/lib/percentage'
import { formatAmount } from '@/shared/lib/money'
import { useI18n } from '@/i18n/context'
import { Card, CardContent } from '@/components/ui/card'
import { NumberField, parseNumber, ResultCard, WorkingRow } from './fields'

/**
 * What a restaurant bill actually comes to.
 *
 * The point is the **order**: service charge goes on the food, then VAT goes on
 * both. That is why 10% and 7% is not 17% — on ฿1,000 the real total is ฿1,177,
 * and adding a flat 17% lands ฿7 short. The working is shown line by line so
 * the difference is visible rather than asserted.
 */
export function ServiceChargeCalculator() {
  const { t } = useI18n()
  const [subtotalRaw, setSubtotalRaw] = useState('')
  const [serviceRaw, setServiceRaw] = useState('10')
  const [vatRaw, setVatRaw] = useState('7')

  const subtotal = parseNumber(subtotalRaw)
  const servicePct = parseNumber(serviceRaw)
  const vatPct = parseNumber(vatRaw)

  const ready =
    subtotal !== null &&
    servicePct !== null &&
    vatPct !== null &&
    subtotal >= 0 &&
    servicePct >= 0 &&
    vatPct >= 0

  const charges = ready
    ? restaurantCharges(subtotal, servicePct, vatPct)
    : null

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <p className="text-muted-foreground text-sm">
            {t('calcServiceHelp')}
          </p>

          <NumberField
            id="scSubtotal"
            label={t('calcSubtotal')}
            unit="฿"
            value={subtotalRaw}
            onChange={setSubtotalRaw}
          />
          <NumberField
            id="scService"
            label={t('calcServiceRate')}
            unit="%"
            value={serviceRaw}
            onChange={setServiceRaw}
          />
          <NumberField
            id="scVat"
            label={t('calcVatRate')}
            unit="%"
            value={vatRaw}
            onChange={setVatRaw}
          />
        </CardContent>
      </Card>

      {charges && (
        <ResultCard
          headline={t('calcBillTotal')}
          result={formatAmount(charges.total)}
          copyText={`${t('calcBillTotal')}: ${formatAmount(charges.total)}`}
        >
          <WorkingRow
            label={t('calcSubtotal')}
            value={formatAmount(subtotal!)}
          />
          <WorkingRow
            label={t('calcServiceAmount')}
            value={`+ ${formatAmount(charges.serviceCharge)}`}
          />
          <WorkingRow
            label={t('calcVatAmount')}
            value={`+ ${formatAmount(charges.vat)}`}
          />
        </ResultCard>
      )}
    </div>
  )
}
