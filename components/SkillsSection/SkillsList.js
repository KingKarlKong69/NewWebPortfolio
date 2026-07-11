import { animate, remove, set } from 'animejs'
import { useEffect, useRef } from 'react'
import styles from './SkillsSection.module.css'

export default function SkillsList({ category, reducedMotion }) {
  const listRef = useRef(null)
  const isLongList = category.items.length > 8

  useEffect(() => {
    const root = listRef.current
    if (!root) return undefined

    const rows = root.querySelectorAll('[data-skill-row]')
    const fills = root.querySelectorAll('[data-skill-fill]')

    remove(rows)
    remove(fills)

    if (reducedMotion) {
      set(rows, { opacity: 1, translateY: 0 })
      fills.forEach((fill) => set(fill, { scaleX: Number(fill.dataset.value) / 100 }))
      return () => {
        remove(rows)
        remove(fills)
      }
    }

    set(rows, { opacity: 0, translateY: 9 })
    set(fills, { scaleX: 0 })

    animate(rows, {
      opacity: [0, 1],
      translateY: [9, 0],
      delay: (_, index) => index * 48,
      duration: 420,
      ease: 'out(3)'
    })

    animate(fills, {
      scaleX: (_, index, length) => Number(fills[index]?.dataset.value || 0) / 100,
      delay: (_, index) => 100 + index * 58,
      duration: 680,
      ease: 'out(4)'
    })

    return () => {
      remove(rows)
      remove(fills)
    }
  }, [category.id, reducedMotion])

  return (
    <div
      ref={listRef}
      id={`skills-panel-${category.id}`}
      role="tabpanel"
      aria-labelledby={`skills-tab-${category.id}`}
      tabIndex={0}
      className={`${styles.skillList} ${isLongList ? styles.skillListLong : ''} grid content-start gap-x-6 gap-y-4 outline-none xl:gap-y-3 ${isLongList ? 'xl:grid-cols-2' : 'grid-cols-1'}`}
    >
      {category.items.map((skill) => (
        <div key={skill.name} data-skill-row className="group min-w-0">
          <div className="mb-2 flex items-end justify-between gap-3">
            <span className="truncate text-[11px] font-medium text-slate-300 transition-colors group-hover:text-cyan-100 sm:text-[12px]">
              {skill.name}
            </span>
            <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-slate-300 sm:text-[11px]" aria-label={`${skill.value} percent`}>
              {skill.value}%
            </span>
          </div>
          <div className={styles.progressTrack} aria-hidden="true">
            <span
              data-skill-fill
              data-value={skill.value}
              className={styles.progressFill}
              style={{transform: 'scaleX(0)'}}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

