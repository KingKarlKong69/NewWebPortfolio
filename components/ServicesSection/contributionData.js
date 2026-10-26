// GitHub's public profile calendar is the source of truth. Levels are visual
// intensity only; a count is accepted only when GitHub supplies that count.
export const GITHUB_PROFILE = 'https://github.com/KingKarlKong69'
export const GITHUB_CONTRIBUTIONS_URL = 'https://github.com/users/KingKarlKong69/contributions'

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'))?.[1] ?? null
}

function plainText(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseContributionCalendar(html) {
  if (typeof html !== 'string' || html.length > 2000000) throw new Error('Invalid calendar response')
  const tooltipCounts = new Map()
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi)) {
    const target = attribute(match[1], 'for')
    const text = plainText(match[2])
    const count = text.match(/\b([\d,]+) contributions?\b/i)
    if (target && (count || /\bNo contributions?\b/i.test(text))) {
      tooltipCounts.set(target, count ? Number(count[1].replace(/,/g, '')) : 0)
    }
  }
  const days = new Map()
  for (const match of html.matchAll(/<(?:td|rect)\b[^>]*\bdata-date=["'][^"']+["'][^>]*>/gi)) {
    const tag = match[0]
    const date = attribute(tag, 'data-date')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) continue
    const supplied = attribute(tag, 'data-count')
    const count = supplied !== null ? Number(supplied) : tooltipCounts.get(attribute(tag, 'id'))
    const level = Number(attribute(tag, 'data-level'))
    // Never derive a claimed count from a color/intensity level.
    if (!Number.isInteger(count) || count < 0 || !Number.isInteger(level) || level < 0 || level > 4) continue
    days.set(date, { date, count, level })
  }
  const ordered = [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
  if (ordered.length < 300 || ordered.length > 400) throw new Error('GitHub calendar is incomplete')
  const first = Date.parse(`${ordered[0].date}T00:00:00Z`)
  for (let i = 0; i < ordered.length; i++) {
    if (Date.parse(`${ordered[i].date}T00:00:00Z`) !== first + i * 86400000) throw new Error('GitHub calendar has missing dates')
  }
  return {
    days: ordered,
    total: ordered.reduce((total, day) => total + day.count, 0),
    from: ordered[0].date,
    to: ordered[ordered.length - 1].date
  }
}

export function calendarWeeks(days) {
  if (!days?.length) return []
  const start = Date.parse(`${days[0].date}T00:00:00Z`)
  const firstSunday = start - new Date(start).getUTCDay() * 86400000
  const last = Date.parse(`${days[days.length - 1].date}T00:00:00Z`)
  const lookup = new Map(days.map(day => [day.date, day]))
  const weeks = []
  for (let weekStart = firstSunday; weekStart <= last; weekStart += 7 * 86400000) {
    weeks.push(Array.from({length: 7}, (_, weekday) => {
      const date = new Date(weekStart + weekday * 86400000).toISOString().slice(0, 10)
      return lookup.get(date) || null
    }))
  }
  return weeks
}
