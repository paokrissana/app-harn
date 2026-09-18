import { useNavigate } from 'react-router-dom'
import { WrenchIcon } from 'lucide-react'

import { useI18n } from '@/i18n/context'
import { leaveDevMode } from '@/lib/dev-mode'
import { Button } from '@/components/ui/button'

/**
 * Says why there is more on screen than usual, and offers the way out.
 *
 * Without this, dev mode is a state you can enter from a link and then cannot
 * name or escape — the cards would simply be there, with no hint that anyone
 * else sees something different.
 */
export function DevModeBanner() {
  const { t } = useI18n()
  const navigate = useNavigate()

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm"
    >
      <WrenchIcon className="text-muted-foreground size-4 shrink-0" />
      <p className="text-muted-foreground min-w-0 flex-1 text-balance">
        {t('devModeOn')}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          leaveDevMode()
          // Drop the parameter too, or a refresh would switch it straight back.
          navigate('/', { replace: true })
        }}
      >
        {t('devModeLeave')}
      </Button>
    </div>
  )
}
