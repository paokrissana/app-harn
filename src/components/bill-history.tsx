import { useState } from 'react'
import { PencilIcon, Trash2Icon } from 'lucide-react'

import { formatTHB } from '@/lib/calculator'
import {
  formatFullDateTime,
  formatRelative,
  recordTotal,
  type BillRecord,
} from '@/lib/history'
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

/** Intl hands back "today at 14:30"; this line starts a sentence. */
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function BillHistory({
  records,
  editingId,
  onEdit,
  onDelete,
  onClear,
}: {
  records: BillRecord[]
  editingId: string | null
  onEdit: (record: BillRecord) => void
  onDelete: (id: string) => void
  onClear: () => void
}) {
  const { t, lang } = useI18n()
  // Clearing everything is one tap away from a lot of lost bills, so ask twice.
  const [confirmingClear, setConfirmingClear] = useState(false)

  if (records.length === 0) return null

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      window.setTimeout(() => setConfirmingClear(false), 3000)
      return
    }
    setConfirmingClear(false)
    onClear()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('history')}</CardTitle>
        <CardDescription>{t('historyDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ul aria-label={t('history')} className="flex flex-col gap-2">
          {records.map((record) => (
            <li
              key={record.id}
              className={cn(
                'flex items-center gap-2 rounded-lg border p-3',
                record.id === editingId && 'border-primary bg-primary/5',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{record.name}</p>
                <p className="text-muted-foreground text-xs">
                  {/* Hover any of these for the exact date and time. */}
                  <span
                    className="cursor-help"
                    title={formatFullDateTime(record.createdAt, lang)}
                  >
                    {sentenceCase(formatRelative(record.createdAt, lang))}
                  </span>
                  {record.updatedAt !== record.createdAt && (
                    <span
                      className="cursor-help"
                      title={formatFullDateTime(record.updatedAt, lang)}
                    >
                      {` · ${t('edited')} ${formatRelative(record.updatedAt, lang)}`}
                    </span>
                  )}
                </p>
              </div>

              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatTHB(recordTotal(record))}
              </span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${t('editBill')}: ${record.name}`}
                onClick={() => onEdit(record)}
              >
                <PencilIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${t('deleteBill')}: ${record.name}`}
                onClick={() => onDelete(record.id)}
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('self-end', confirmingClear && 'text-destructive')}
          onClick={handleClear}
        >
          {confirmingClear ? t('confirmClear') : t('clearAll')}
        </Button>
      </CardContent>
    </Card>
  )
}
