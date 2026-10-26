import { useEffect, useMemo, useRef, useState } from 'react'
import { SKILLS_CHAPTERS, SKILLS_CHECKPOINTS } from './skillsExpeditionData'
import styles from './SkillsExpedition.module.css'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0))
const MARKERS = SKILLS_CHAPTERS.flatMap((chapter, chapterIndex) => chapter.markers.map((marker, markerIndex) => ({ ...marker, chapterIndex, markerIndex, chapterTitle: chapter.title })))
const MARKER_BY_ID = new Map(MARKERS.map(marker => [marker.id, marker]))

// Fragment positions depend on scroll construction, so seeking backward gives
// the same materialization frame. Only the settled corona uses an idle clock.
function setMaterialization(node, progress, phase = 0) {
  const build = clamp(progress)
  const resolve = clamp((build - .2) / .7)
  const fragment = resolve > .015 && resolve < .985 ? Math.sin(Math.PI * resolve) : 0
  const step = Math.floor(resolve * 19)
  node.style.setProperty('--materialize', resolve)
  node.style.setProperty('--fragment', fragment)
  node.style.setProperty('--fragment-x', `${Math.sin(step * 2.73 + phase) * fragment * 13}px`)
  node.style.setProperty('--fragment-y', `${Math.cos(step * 4.39 + phase) * fragment * 4}px`)
  node.style.setProperty('--fragment-cut', `${Math.round(17 + ((step * 29 + phase * 11) % 61))}%`)
  node.style.setProperty('--resolve-opacity', resolve > .025 ? (resolve > .985 ? 1 : .55 + ((step + Math.round(phase)) % 3) * .15) : 0)
}

// Three.js supplies actual terrain anchors. DOM icons remain sharp, accessible,
// and attached to beam tips; one readout serves hover, focus, and tap selection.
export default function SkillsExpedition({ motionRef, sceneRef }) {
  const rootRef = useRef(null)
  const markersRef = useRef(new Map())
  const summitsRef = useRef(new Map())
  const checkpointsRef = useRef(new Map())
  const checkpointLinesRef = useRef(new Map())
  const endingRef = useRef(null)
  const progressRef = useRef(null)
  const announcementRef = useRef(null)
  const readoutRef = useRef(null)
  const connectorRef = useRef(null)
  const selectedRef = useRef(null)
  const lastChapterRef = useRef(-1)
  const updateRef = useRef(null)
  const [selectedId, setSelectedId] = useState(null)
  const selected = useMemo(() => MARKER_BY_ID.get(selectedId), [selectedId])

  const select = (id, pinned = false) => {
    selectedRef.current = id ? { id, pinned } : null
    setSelectedId(id)
    updateRef.current?.()
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const hideSelection = () => {
      if (!selectedRef.current) return
      selectedRef.current = null
      setSelectedId(null)
    }
    const position = (node, anchor, enabled, minimumOpacity = .02, wide = false) => {
      if (!node) return false
      const opacity = clamp(anchor?.opacity)
      const valid = anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y)
      const inFrame = valid && (wide
        ? anchor.x > -.7 && anchor.x < 1.7 && anchor.y > -.2 && anchor.y < 1.2
        : anchor.x > .105 && anchor.x < .97 && anchor.y > .12 && anchor.y < .91)
      const visible = Boolean(enabled && anchor?.visible && opacity > minimumOpacity && inFrame)
      node.dataset.visible = String(visible)
      node.style.setProperty('--anchor-opacity', visible ? opacity : 0)
      if (valid) {
        node.style.left = `${anchor.x * 100}%`
        node.style.top = `${anchor.y * 100}%`
      }
      node.setAttribute('aria-hidden', String(!visible))
      const interactive = visible && opacity > .65
      node.inert = node.tagName === 'BUTTON' ? !interactive : !visible
      if (node.tagName === 'BUTTON') node.tabIndex = interactive ? 0 : -1
      return visible
    }
    const update = () => {
      const motion = motionRef.current || {}
      const projections = motion.skillsProjection
      const active = Boolean(motion.active && motion.skillsReveal > .65 && projections)
      const chapterIndex = clamp(Math.round(motion.chapterIndex || 0), 0, SKILLS_CHAPTERS.length - 1)
      const ending = clamp(motion.endingReveal)
      const checkpointReveal = clamp(motion.checkpointReveal)
      const checkpointIndex = Number.isFinite(motion.checkpointIndex) ? motion.checkpointIndex : -1
      root.dataset.active = String(active)
      root.dataset.ending = String(ending > .4)
      root.style.setProperty('--checkpoint-dim', active ? clamp(motion.checkpointDim) : 0)
      root.setAttribute('aria-hidden', String(!active))
      root.inert = !active

      if (chapterIndex !== lastChapterRef.current) {
        lastChapterRef.current = chapterIndex
        hideSelection()
        if (announcementRef.current) announcementRef.current.textContent = active ? `${chapterIndex + 1} of ${SKILLS_CHAPTERS.length}. ${SKILLS_CHAPTERS[chapterIndex].title}.` : ''
      }
      if (!active || checkpointReveal > .2) hideSelection()
      const selectedId = selectedRef.current?.id
      let selectedAnchor = null
      const hideMissing = (nodes, anchors) => {
        const present = new Set((anchors || []).map(anchor => anchor.id))
        nodes.forEach((node, id) => { if (!present.has(id)) position(node, null, false) })
      }
      hideMissing(markersRef.current, projections?.markers)
      hideMissing(summitsRef.current, projections?.summits)
      hideMissing(checkpointsRef.current, projections?.checkpoints)

      projections?.markers?.forEach(anchor => {
        const node = markersRef.current.get(anchor.id)
        const marker = MARKER_BY_ID.get(anchor.id)
        const visible = position(node, anchor, active && ending < .65 && checkpointReveal < .4)
        if (!node) return
        node.dataset.selected = String(selectedId === anchor.id)
        node.dataset.dimmed = String(Boolean(selectedId && selectedId !== anchor.id))
        node.setAttribute('aria-expanded', String(selectedId === anchor.id))
        setMaterialization(node, anchor.build ?? anchor.opacity, (marker?.markerIndex || 0) * 1.37)
        if (selectedId === anchor.id) {
          if (visible && marker?.chapterIndex === chapterIndex) selectedAnchor = anchor
          else hideSelection()
        }
      })
      if (selectedId && !selectedAnchor) hideSelection()
      projections?.summits?.forEach(anchor => {
        const node = summitsRef.current.get(anchor.id)
        position(node, anchor, active && ending < .6 && checkpointReveal < .35)
        if (node) setMaterialization(node, anchor.opacity, 2)
      })

      checkpointLinesRef.current.forEach(node => { if (node) node.style.opacity = '0' })
      projections?.checkpoints?.forEach(anchor => {
        const node = checkpointsRef.current.get(anchor.id)
        const index = SKILLS_CHECKPOINTS.findIndex(checkpoint => checkpoint.id === anchor.id)
        const captionAnchor = { ...anchor, opacity: clamp(Math.min(anchor.opacity, checkpointReveal)) }
        const shown = position(node, captionAnchor, active && index === checkpointIndex && ending < .3, .015)
        if (!node) return
        setMaterialization(node, checkpointReveal, index * 1.53)
        if (!shown) return
        // The beam stays in the world; its large caption occupies a clear sky
        // reading zone and a fine connector preserves their spatial relation.
        const left = .47
        const top = .34
        node.style.left = `${left * 100}%`
        node.style.top = `${top * 100}%`
        const connector = checkpointLinesRef.current.get(anchor.id)
        if (connector) {
          connector.setAttribute('d', `M ${anchor.x * 1000} ${anchor.y * 1000} L ${anchor.x * 1000} ${(top + .035) * 1000} L ${(left - .013) * 1000} ${(top + .035) * 1000}`)
          connector.style.opacity = String(captionAnchor.opacity * .75)
        }
      })

      position(endingRef.current, projections?.ending, active && ending > .01, .01, true)
      if (endingRef.current) setMaterialization(endingRef.current, ending, 3)

      if (progressRef.current) {
        progressRef.current.style.opacity = active ? String((1 - ending) * clamp(motion.chapterActivation) * (1 - checkpointReveal)) : '0'
        progressRef.current.querySelector('[data-chapter-number]').textContent = String(chapterIndex + 1).padStart(2, '0')
        progressRef.current.querySelector('[data-chapter-name]').textContent = SKILLS_CHAPTERS[chapterIndex].title
        progressRef.current.style.setProperty('--expedition-progress', clamp(motion.expeditionProgress))
      }

      const readout = readoutRef.current
      const connector = connectorRef.current
      if (readout) {
        const visible = Boolean(active && selectedAnchor)
        readout.dataset.visible = String(visible)
        readout.setAttribute('aria-hidden', String(!visible))
        if (visible) {
          const width = sceneRef?.current?.clientWidth || window.innerWidth
          const height = sceneRef?.current?.clientHeight || window.innerHeight
          const readoutWidth = Math.min(330, width * .25)
          const preferRight = selectedAnchor.x < .64
          const left = clamp(selectedAnchor.x + (preferRight ? .065 : -.065 - readoutWidth / width), .42, .96 - readoutWidth / width)
          const top = clamp(selectedAnchor.y - 165 / height, .23, .47)
          readout.style.left = `${left * 100}%`
          readout.style.top = `${top * 100}%`
          if (connector) {
            const endX = preferRight ? left : left + readoutWidth / width
            const endY = top + 14 / height
            const elbowX = selectedAnchor.x + (preferRight ? .032 : -.032)
            connector.setAttribute('d', `M ${selectedAnchor.x * 1000} ${selectedAnchor.y * 1000} L ${elbowX * 1000} ${selectedAnchor.y * 1000} L ${endX * 1000} ${endY * 1000}`)
          }
        }
      }
      if (connector) connector.style.opacity = active && selectedAnchor ? '.8' : '0'
    }
    updateRef.current = update
    window.addEventListener('skills:projection', update)
    window.addEventListener('projects:motion', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      updateRef.current = null
      window.removeEventListener('skills:projection', update)
      window.removeEventListener('projects:motion', update)
      window.removeEventListener('resize', update)
    }
  }, [motionRef, sceneRef])

  useEffect(() => { updateRef.current?.() }, [selectedId])

  const markerImage = marker => marker.icon
    ? <img src={marker.icon} alt="" width="48" height="48" decoding="async" draggable="false" />
    : <span>{marker.abbreviation || marker.label.split(/\W+/).map(word => word[0]).join('').slice(0, 3)}</span>

  return <section ref={rootRef} className={styles.expedition} aria-label="Skills mountain expedition" aria-hidden="true" data-active="false" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); select(null) }
  }}>
    <p ref={announcementRef} className={styles.srOnly} aria-live="polite" aria-atomic="true" />
    <div className={styles.checkpointShade} aria-hidden="true" />
    <svg className={styles.connector} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path ref={connectorRef} vectorEffect="non-scaling-stroke" />
      {SKILLS_CHECKPOINTS.map(checkpoint => <path key={checkpoint.id} ref={node => { if (node) checkpointLinesRef.current.set(checkpoint.id, node); else checkpointLinesRef.current.delete(checkpoint.id) }} vectorEffect="non-scaling-stroke" />)}
    </svg>

    {SKILLS_CHAPTERS.map((chapter, index) => <div key={chapter.id} ref={node => { if (node) summitsRef.current.set(chapter.id, node); else summitsRef.current.delete(chapter.id) }} className={styles.summit} aria-hidden="true" data-visible="false">
      <p><span>{String(index + 1).padStart(2, '0')} /</span> {chapter.title}</p>
      <small>{chapter.subtitle}</small>
      <span className={styles.summitPin} aria-hidden="true" />
    </div>)}

    {MARKERS.map((marker, index) => <button key={marker.id} ref={node => { if (node) markersRef.current.set(marker.id, node); else markersRef.current.delete(marker.id) }} type="button" className={`${styles.marker} ${marker.icon ? '' : styles.textMarker}`} style={{ '--corona-phase': `${-index * 7.31}s`, '--corona-duration': `${46 + index % 7 * 4}s` }} data-marker-id={marker.id} data-monochrome={marker.monochrome || undefined} data-visible="false" aria-label={`${marker.label}: ${marker.description}`} aria-controls="skills-marker-readout" aria-expanded="false" aria-hidden="true" tabIndex={-1}
      onPointerEnter={event => { if (event.pointerType !== 'touch') select(marker.id) }}
      onPointerLeave={() => {
        if (selectedRef.current?.id === marker.id && !selectedRef.current.pinned && document.activeElement !== markersRef.current.get(marker.id)) select(null)
      }}
      onFocus={() => select(marker.id)}
      onBlur={() => { if (selectedRef.current?.id === marker.id) select(null) }}
      onClick={() => select(marker.id, true)}>
      <span className={styles.markerAura} aria-hidden="true"><i /><i /></span>
      <span className={styles.icon} aria-hidden="true">{markerImage(marker)}</span>
      <span className={`${styles.icon} ${styles.iconFragment} ${styles.fragmentCyan}`} aria-hidden="true">{markerImage(marker)}</span>
      <span className={`${styles.icon} ${styles.iconFragment} ${styles.fragmentViolet}`} aria-hidden="true">{markerImage(marker)}</span>
    </button>)}

    {SKILLS_CHECKPOINTS.map((checkpoint, index) => <div key={checkpoint.id} ref={node => { if (node) checkpointsRef.current.set(checkpoint.id, node); else checkpointsRef.current.delete(checkpoint.id) }} className={styles.checkpoint} data-visible="false" aria-hidden="true">
      <span className={styles.checkpointNumber}>0{index + 1} / PROCESS</span>
      <h3>{checkpoint.title}</h3>
      <p>{checkpoint.subtitle}</p>
    </div>)}

    <div ref={readoutRef} className={styles.readout} id="skills-marker-readout" data-visible="false" aria-hidden="true" role="status" aria-live="polite" aria-atomic="true">
      {selected && <><h3>{selected.label}</h3><p>{selected.description}</p>{selected.tags?.length > 0 && <small>{selected.tags.join(' · ')}</small>}</>}
    </div>

    <div ref={progressRef} className={styles.progress} aria-hidden="true"><span data-chapter-number>01</span><i /><span data-chapter-name>{SKILLS_CHAPTERS[0].title}</span><small>SCROLL TO EXPLORE <span>↔</span></small></div>
    <div ref={endingRef} className={styles.ending} data-visible="false" aria-hidden="true"><p>// ALWAYS IN PROGRESS</p><h2>THE TOOLSET WILL<br />KEEP <span>EVOLVING.</span></h2><p>Always learning. Always experimenting.<br />Always building.</p></div>
  </section>
}
