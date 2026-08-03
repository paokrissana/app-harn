import { calculatePayback, type PaybackInput } from '@/lib/calculator'
import type { Lang } from '@/i18n/translations'

const STORAGE_KEY = 'bill-history'
const STORAGE_VERSION = 1

/**
 * Every calculation is saved, so the list grows quickly. Keep it short enough
 * to take in at a glance — past this the oldest bills fall off quietly, with
 * no warning and no way back.
 */
export const MAX_RECORDS = 20

/** One saved bill: what was entered, plus when it was kept and last changed. */
export interface BillRecord {
  id: string
  /** Typed by the user, or generated from the items when left blank. */
  name: string
  /** ISO timestamp of the first save. */
  createdAt: string
  /** ISO timestamp of the last edit — equal to createdAt until edited. */
  updatedAt: string
  /** The inputs, so the bill can be reopened in the form and recalculated. */
  input: PaybackInput
}

interface StoredHistory {
  version: number
  records: BillRecord[]
}

/** Anything named — form rows hold strings, records hold parsed plates. */
interface Named {
  name: string
}

function looksLikeRecord(value: unknown): value is BillRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<BillRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    typeof record.input === 'object' &&
    record.input !== null &&
    Array.isArray(record.input.items)
  )
}

/**
 * Read the saved bills. Anything unreadable — corrupt JSON, an older shape, a
 * browser that refuses storage — is treated as "no history" rather than an
 * error, since the calculator itself works fine without it.
 */
export function loadHistory(): BillRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as StoredHistory
    if (parsed?.version !== STORAGE_VERSION || !Array.isArray(parsed.records)) {
      return []
    }
    return parsed.records.filter(looksLikeRecord)
  } catch {
    return []
  }
}

/** Persist the bills, silently giving up if storage is full or blocked. */
export function saveHistory(records: BillRecord[]): void {
  const payload: StoredHistory = { version: STORAGE_VERSION, records }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Out of quota or private mode: history is a nicety, not worth a crash.
  }
}

function newId(): string {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`
}

/** Add a bill to the front of the list, dropping the oldest past the cap. */
export function addRecord(
  records: BillRecord[],
  input: PaybackInput,
  name: string,
  now = new Date(),
): BillRecord[] {
  const timestamp = now.toISOString()
  const record: BillRecord = {
    id: newId(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    input,
  }
  return [record, ...records].slice(0, MAX_RECORDS)
}

/**
 * Overwrite a bill that was reopened in the form, keeping its place and
 * original date and stamping when it changed.
 */
export function updateRecord(
  records: BillRecord[],
  id: string,
  input: PaybackInput,
  name: string,
  now = new Date(),
): BillRecord[] {
  return records.map((record) =>
    record.id === id
      ? { ...record, name, input, updatedAt: now.toISOString() }
      : record,
  )
}

export function removeRecord(records: BillRecord[], id: string): BillRecord[] {
  return records.filter((record) => record.id !== id)
}

/** What the user paid on a saved bill — derived, never stored, so it can't drift. */
export function recordTotal(record: BillRecord): number {
  return calculatePayback(record.input).youPay
}

/**
 * A name for a bill left unnamed: the first dish that has one, plus a count of
 * everything else ordered — e.g. `Pad Thai +2`.
 */
export function suggestBillName(
  items: Named[],
  sharedItems: Named[],
  fallback: string,
): string {
  const all = [...items, ...sharedItems]
  const named = all.find((item) => item.name.trim() !== '')
  if (!named) return fallback

  const others = all.length - 1
  return others > 0 ? `${named.name.trim()} +${others}` : named.name.trim()
}

function localeOf(lang: Lang): string {
  return lang === 'th' ? 'th-TH' : 'en-GB'
}

/** Whole calendar days from now to then — today is 0, yesterday -1. */
function calendarDaysApart(from: Date, to: Date): number {
  const midnight = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

  return Math.round((midnight(to) - midnight(from)) / 86_400_000)
}

/**
 * How long ago a bill was, in words: `today at 14:30`, `yesterday at 20:05`,
 * `3 days ago`, `last week`, `2 weeks ago`, and a plain date beyond a month.
 * Intl supplies the wording, so Thai comes for free. Lower case as Intl gives
 * it — the caller capitalises where the phrase starts a sentence.
 */
export function formatRelative(
  iso: string,
  lang: Lang,
  now = new Date(),
): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const locale = localeOf(lang)
  const days = calendarDaysApart(now, date)
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  // Today and yesterday carry the time — that is what you actually want to know.
  if (days === 0 || days === -1) {
    const time = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
    const day = relative.format(days, 'day')

    return lang === 'th' ? `${day} ${time}` : `${day} at ${time}`
  }

  if (days < 0 && days >= -6) return relative.format(days, 'day')

  const weeks = Math.floor(Math.abs(days) / 7)
  if (days < 0 && weeks <= 4) return relative.format(-weeks, 'week')

  // Older than about a month — or somehow in the future — so just say when.
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

/** The whole timestamp, spelled out for a tooltip. */
export function formatFullDateTime(iso: string, lang: Lang): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(localeOf(lang), {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}
