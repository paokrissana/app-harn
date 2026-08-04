import { Link } from 'react-router-dom'
import { ArrowLeftIcon, TriangleAlertIcon } from 'lucide-react'

import { useI18n } from '@/i18n/context'
import { SplitGroupOrder } from '@/features/split-group-order/split-group-order'

export function SplitGroupOrderPage() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 inline-flex w-fit items-center gap-1 rounded-md text-sm outline-none focus-visible:ring-[3px]"
        >
          <ArrowLeftIcon className="size-4" />
          {t('allTools')}
        </Link>

        <h1 className="text-2xl font-extrabold tracking-tight">
          {t('toolGroupOrderName')}
        </h1>
        <p className="text-muted-foreground text-sm text-balance">
          {t('toolGroupOrderDesc')}
        </p>
      </div>

      {/* Says so before anyone trusts a number, not after. */}
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
      >
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
        <p className="text-balance">{t('betaNotice')}</p>
      </div>

      <SplitGroupOrder />
    </div>
  )
}
