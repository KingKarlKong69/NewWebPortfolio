import { ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useRef } from 'react'
import styles from './SkillsSection.module.css'

export default function SkillsCategoryTabs({ categories, activeId, onSelect }) {
  const tabRefs = useRef([])

  const focusAndSelect = (index) => {
    const normalizedIndex = (index + categories.length) % categories.length
    const category = categories[normalizedIndex]
    onSelect(category.id)
    tabRefs.current[normalizedIndex]?.focus()
  }

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      focusAndSelect(index + 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      focusAndSelect(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusAndSelect(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusAndSelect(categories.length - 1)
    }
  }

  return (
    <div
      className={`${styles.categoryRail} flex w-full max-w-full gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-3 lg:overflow-visible lg:pb-0`}
      role="tablist"
      aria-label="Skill categories"
      aria-orientation="vertical"
    >
      {categories.map((category, index) => {
        const isActive = category.id === activeId
        const Icon = category.Icon

        return (
          <button
            key={category.id}
            ref={(node) => { tabRefs.current[index] = node }}
            id={`skills-tab-${category.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`skills-panel-${category.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(category.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${styles.categoryTab} ${isActive ? styles.categoryTabActive : ''} group relative flex min-h-[58px] min-w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2 py-2.5 text-center transition-colors duration-300 lg:min-h-[58px] lg:w-full lg:min-w-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-left`}
          >
            {isActive && (
              <motion.span
                layoutId="skills-active-category"
                className={styles.activeCategoryGlow}
                transition={{type: 'spring', stiffness: 360, damping: 32}}
              />
            )}
            <Icon
              aria-hidden="true"
              size={18}
              strokeWidth={isActive ? 2.2 : 1.6}
              className={`relative z-10 shrink-0 ${isActive ? 'text-cyan-200' : 'text-slate-500 group-hover:text-cyan-300'}`}
            />
            <span className={`relative z-10 whitespace-nowrap font-mono text-[9px] font-semibold tracking-[-0.02em] sm:text-[10px] lg:text-[11px] ${isActive ? 'text-cyan-50' : 'text-slate-400 group-hover:text-slate-200'}`}>
              {category.label}
            </span>
            <ChevronRight
              aria-hidden="true"
              size={14}
              className={`relative z-10 ml-auto hidden lg:block ${isActive ? 'translate-x-0 text-cyan-300' : '-translate-x-1 text-slate-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`}
            />
            <span aria-hidden="true" className={`${styles.tabIndicator} ${isActive ? styles.tabIndicatorActive : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
