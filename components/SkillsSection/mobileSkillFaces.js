import {SKILLS_CHAPTERS} from './skillsExpeditionData'

export const MOBILE_SKILLS_PER_FACE = 5
export const MOBILE_SKILL_FACES = Object.freeze(SKILLS_CHAPTERS.flatMap((chapter, chapterIndex) => {
  const pageCount = Math.ceil(chapter.markers.length / MOBILE_SKILLS_PER_FACE)
  return Array.from({length: pageCount}, (_, pageIndex) => Object.freeze({
    chapterIndex, pageIndex, pageCount,
    id: `${chapter.id}-${pageIndex + 1}`,
    markerIds: Object.freeze(chapter.markers.slice(pageIndex * MOBILE_SKILLS_PER_FACE, (pageIndex + 1) * MOBILE_SKILLS_PER_FACE).map(marker => marker.id))
  }))
}).map((face, index) => Object.freeze({...face, index})))

export function mobileSkillFace(index = 0) {
  const safe = Number.isFinite(index) ? Math.round(index) : 0
  return MOBILE_SKILL_FACES[Math.max(0, Math.min(MOBILE_SKILL_FACES.length - 1, safe))]
}

// Surface locations are kept below the category heading, spread across the
// visible icy face. The world projects these positions with the same camera
// that renders the mountain; the icons never need vertical support beams.
export function mobileFaceIconLayout(count) {
  const locations = count <= 3
    ? [[.78,.57],[.48,.75],[.75,.89]]
    : [[.82,.48],[.62,.61],[.85,.72],[.43,.80],[.68,.91]]
  return locations.slice(0, Math.max(0, Math.min(MOBILE_SKILLS_PER_FACE, count)))
}
