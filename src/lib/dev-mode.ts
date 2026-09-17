/**
 * Dev mode: the switch that reveals work in progress.
 *
 * The home page lists tools that do not exist yet, which is useful while
 * building and clutter for everyone else — five dimmed cards nobody can tap.
 * Dev mode hides them by default and brings them back on demand.
 *
 * The switch is a URL parameter that sticks, rather than a console command or a
 * build flag, for one reason each: a console command cannot be run on the phone
 * you would actually demo on, and a build flag could never be turned on by
 * somebody you sent a link to.
 *
 *   ?devMode=on   turn it on, and remember
 *   ?devMode=off  turn it off, and forget
 *
 * Tools that are merely in beta are **not** hidden. They work, their numbers
 * reconcile, and the beta badge already says to check them — and Split Group
 * Order is the page carrying the GrabFood search. Hiding a working tool costs
 * more than the badge does.
 */

const STORAGE_KEY = 'dev-mode'
const PARAM = 'devMode'

/** Read the flag, treating unreadable storage as off rather than an error. */
function stored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/** Remember the choice, silently giving up if storage is blocked. */
function remember(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'on')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Private mode or no quota: dev mode lasts the session instead. Fine.
  }
}

/**
 * Whether dev mode is on, given the current query string.
 *
 * `?devMode=` wins and is remembered; without it the stored answer stands. Any
 * value other than `on` turns it off, so a typo fails closed rather than
 * leaving somebody stuck in a mode they cannot name.
 */
export function resolveDevMode(search: string): boolean {
  const param = new URLSearchParams(search).get(PARAM)
  if (param === null) return stored()

  const on = param === 'on'
  remember(on)
  return on
}

/** Turn it off from inside the app, for the banner's own button. */
export function leaveDevMode(): void {
  remember(false)
}
