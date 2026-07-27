import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A switch built on a native checkbox — no extra dependency, and it plugs
 * straight into react-hook-form's `register` as a boolean field.
 *
 * The real input sits invisibly on top of the track so it keeps native
 * keyboard, focus and label behaviour; the track and thumb are siblings so
 * Tailwind's `peer-checked:` can style them.
 */
function Switch({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <span
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center',
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        data-slot="switch"
        className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span className="border-input bg-input peer-focus-visible:ring-ring/50 peer-checked:bg-primary peer-checked:border-primary pointer-events-none absolute inset-0 rounded-full border shadow-xs transition-colors peer-focus-visible:ring-[3px] peer-disabled:opacity-50" />
      <span className="bg-background dark:bg-foreground pointer-events-none absolute left-0.5 size-4 rounded-full shadow-sm transition-transform peer-checked:translate-x-4 peer-disabled:opacity-50" />
    </span>
  )
}

export { Switch }
