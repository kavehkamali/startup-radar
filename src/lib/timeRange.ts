/** Start of calendar day UTC-ish (local) for date-only inputs */
export function parseDateInputStart(isoDate: string): Date {
  const d = new Date(isoDate + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function parseDateInputEnd(isoDate: string): Date {
  const d = new Date(isoDate + 'T23:59:59.999')
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export function toInputDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Default window: last 2 calendar years from today (rolling). */
export function defaultTimeRangeEnd(): Date {
  return new Date()
}

export function defaultTimeRangeStart(): Date {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  d.setHours(0, 0, 0, 0)
  return d
}

/** `foundedDate` is `YYYY-MM-DD` (local calendar day). */
export function isWithinFoundedDateRange(foundedDate: string, start: Date, end: Date): boolean {
  const d = parseDateInputStart(foundedDate)
  const t = d.getTime()
  return t >= start.getTime() && t <= end.getTime()
}

/** Month keys `YYYY-MM` from start through end (inclusive of months touched). */
export function monthKeysBetween(start: Date, end: Date): string[] {
  const out: string[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  const last = new Date(end.getFullYear(), end.getMonth(), 1)
  while (cur <= last) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return out
}
