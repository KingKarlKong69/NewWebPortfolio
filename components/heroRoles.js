export const HERO_ROLES = [
  'Back-end Developer',
  'Front-end Developer',
  'AI-Native Developer',
  'Junior DevOps',
  'UI/UX Designer',
  'Mobile App Developer',
  'Research Lead',
  'IT Support',
  'Database Administrator',
  'Research Lead',
  'Aspiring 3D Web Developer'
]

const TYPE_MS = 60
const ERASE_MS = 32
const HOLD_MS = 1900
const GAP_MS = 280
const durations = HERO_ROLES.map(role => role.length * (TYPE_MS + ERASE_MS) + HOLD_MS + GAP_MS)
const cycleDuration = durations.reduce((total, duration) => total + duration, 0)

export function getHeroRoleFrame(elapsed) {
  let local = Math.max(0, elapsed) % cycleDuration
  let index = 0
  while (local >= durations[index]) local -= durations[index++]
  const role = HERO_ROLES[index]
  const typedAt = role.length * TYPE_MS
  const eraseAt = typedAt + HOLD_MS
  const erasedAt = eraseAt + role.length * ERASE_MS
  const text = local < typedAt
    ? role.slice(0, Math.floor(local / TYPE_MS))
    : local < eraseAt
      ? role
      : local < erasedAt
        ? role.slice(0, role.length - Math.floor((local - eraseAt) / ERASE_MS))
        : ''
  return { text, index, role }
}
