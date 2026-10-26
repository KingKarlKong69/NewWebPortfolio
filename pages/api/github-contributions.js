import { GITHUB_CONTRIBUTIONS_URL, GITHUB_PROFILE, parseContributionCalendar } from '../../components/ServicesSection/contributionData'
import verifiedSnapshot from '../../components/ServicesSection/githubContributionsSnapshot.json'

// Verified public calendar, kept as a dated offline fallback, never synthetic.
let cachedCalendar = verifiedSnapshot
let pendingCalendar = null
const CACHE_LIFETIME = 60 * 60 * 1000

async function loadCalendar() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6500)
  try {
    // Fixed primary-source URL; no user URL, credentials, or GitHub token.
    const response = await fetch(GITHUB_CONTRIBUTIONS_URL, {
      headers: {Accept: 'text/html', 'User-Agent': 'KarlLopezPortfolio/1.0'},
      signal: controller.signal
    })
    if (!response.ok) throw new Error('GitHub is unavailable')
    const calendar = parseContributionCalendar(await response.text())
    cachedCalendar = {...calendar, profile: GITHUB_PROFILE, fetchedAt: new Date().toISOString()}
    return cachedCalendar
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({error: 'Method not allowed'})
  }
  if (cachedCalendar && Date.now() - Date.parse(cachedCalendar.fetchedAt) < CACHE_LIFETIME) {
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return response.status(200).json(cachedCalendar)
  }
  try {
    if (!pendingCalendar) pendingCalendar = loadCalendar().finally(() => { pendingCalendar = null })
    const calendar = await pendingCalendar
    response.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    return response.status(200).json(calendar)
  } catch {
    // A verified cached calendar stays explicitly dated if GitHub is offline.
    if (cachedCalendar) return response.status(200).json({...cachedCalendar, stale: true})
    response.setHeader('Cache-Control', 'public, s-maxage=60')
    return response.status(503).json({error: 'Activity is temporarily unavailable', profile: GITHUB_PROFILE})
  }
}
