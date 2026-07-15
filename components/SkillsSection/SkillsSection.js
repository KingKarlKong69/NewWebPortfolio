import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SkillsCategoryTabs from './SkillsCategoryTabs'
import SkillsList from './SkillsList'
import SkillsStatusPanel from './SkillsStatusPanel'
import { SKILL_CATEGORIES } from './skillsData'
import styles from './SkillsSection.module.css'

const SkillsRadarChart = dynamic(() => import('./SkillsRadarChart'), {
  ssr: false,
  loading: () => <div className="mx-auto aspect-square w-full max-w-[390px] animate-pulse rounded-full border border-cyan-300/10 bg-cyan-300/[0.02]" />
})

const AUTO_CATEGORY_DELAY = 4000
const MANUAL_CATEGORY_DELAY = 8000

export default function SkillsSection() {
  const sectionRef = useRef(null)
  const nextCategoryDelayRef = useRef(AUTO_CATEGORY_DELAY)
  const [activeCategoryId, setActiveCategoryId] = useState(SKILL_CATEGORIES[0].id)
  const [isInView, setIsInView] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const reducedMotion = useReducedMotion()

  const activeCategory = useMemo(
    () => SKILL_CATEGORIES.find((category) => category.id === activeCategoryId) || SKILL_CATEGORIES[0],
    [activeCategoryId]
  )

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)
      if (entry.isIntersecting) setHasEntered(true)
    }, {rootMargin: '18% 0px 18% 0px', threshold: 0.08})
    observer.observe(section)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isInView || SKILL_CATEGORIES.length <= 1) return undefined

    const timeout = window.setTimeout(() => {
      nextCategoryDelayRef.current = AUTO_CATEGORY_DELAY
      setActiveCategoryId((currentId) => {
        const currentIndex = SKILL_CATEGORIES.findIndex((category) => category.id === currentId)
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % SKILL_CATEGORIES.length : 0
        return SKILL_CATEGORIES[nextIndex].id
      })
    }, nextCategoryDelayRef.current)

    return () => window.clearTimeout(timeout)
  }, [activeCategoryId, isInView, scheduleVersion])

  const selectCategory = useCallback((categoryId) => {
    nextCategoryDelayRef.current = MANUAL_CATEGORY_DELAY
    setScheduleVersion((version) => version + 1)
    setActiveCategoryId((currentId) => currentId === categoryId ? currentId : categoryId)
  }, [])

  const entrance = reducedMotion
    ? {duration: 0}
    : {duration: 0.72, ease: [0.22, 1, 0.36, 1]}

  return (
    <motion.section
      ref={sectionRef}
      id="skills"
      aria-labelledby="skills-heading"
      initial={reducedMotion ? false : {opacity: 0, y: 34}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: false, amount: 0.08}}
      transition={entrance}
      className={`${styles.section} relative mt-8 scroll-mt-[104px] overflow-hidden px-4 py-20 sm:mt-[2.4rem] sm:px-7 sm:py-24 lg:mt-[1.4rem] lg:min-h-screen lg:px-8 lg:py-14 lg:pl-[106px] xl:px-12 xl:pl-[116px]`}
    >
      <div className="relative z-10 mx-auto max-w-[1500px]">
        <motion.header
          initial={reducedMotion ? false : {opacity: 0, x: -18}}
          whileInView={{opacity: 1, x: 0}}
          viewport={{once: false, amount: 0.5}}
          transition={reducedMotion ? {duration: 0} : {delay: 0.08, duration: 0.55}}
          className="mb-8 flex items-start justify-between gap-5 lg:mb-7"
        >
          <div>
            <h2 id="skills-heading" className="font-montserrat text-[32px] font-black uppercase leading-none tracking-[0.13em] text-white sm:text-[42px] lg:text-[50px]">
              Skills
            </h2>
            <p className="mt-3 max-w-[560px] text-[12px] font-light leading-relaxed text-slate-400 sm:text-[14px]">
              Technical capabilities and professional strengths, mapped through an interactive performance matrix.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-md border border-emerald-300/10 bg-emerald-300/[0.025] px-3 py-2 font-mono text-[8px] uppercase tracking-[0.12em] text-emerald-300/70 sm:flex">
            <Activity size={12} aria-hidden="true" /> Interface online
          </div>
        </motion.header>

        <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[190px_minmax(290px,0.9fr)_minmax(300px,1fr)] lg:gap-6 xl:grid-cols-[205px_minmax(320px,0.88fr)_minmax(360px,1fr)_250px] xl:gap-7 2xl:grid-cols-[220px_390px_minmax(420px,1fr)_270px]">
          <motion.div
            initial={reducedMotion ? false : {opacity: 0, x: -22}}
            whileInView={{opacity: 1, x: 0}}
            viewport={{once: false, amount: 0.35}}
            transition={reducedMotion ? {duration: 0} : {delay: 0.12, duration: 0.58}}
            className="min-w-0 max-w-full"
          >
            <SkillsCategoryTabs
              categories={SKILL_CATEGORIES}
              activeId={activeCategory.id}
              onSelect={selectCategory}
            />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : {opacity: 0, scale: 0.9}}
            whileInView={{opacity: 1, scale: 1}}
            viewport={{once: false, amount: 0.25}}
            transition={reducedMotion ? {duration: 0} : {delay: 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1]}}
            className="flex min-h-[310px] min-w-0 max-w-full items-center justify-center lg:min-h-[380px]"
          >
            <SkillsRadarChart
              category={activeCategory}
              active={isInView}
              reducedMotion={Boolean(reducedMotion)}
              renderWebGL={hasEntered}
            />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : {opacity: 0, x: 20}}
            whileInView={{opacity: 1, x: 0}}
            viewport={{once: false, amount: 0.25}}
            transition={reducedMotion ? {duration: 0} : {delay: 0.22, duration: 0.62}}
            className={`${styles.panel} min-w-0 rounded-xl border p-4 sm:p-5 lg:min-h-[380px]`}
          >
            <div className="mb-5 flex items-center justify-between border-b border-cyan-300/10 pb-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-cyan-300/55">Selected category</p>
                <h3 className="mt-1 text-[14px] font-semibold text-slate-100">{activeCategory.label}</h3>
              </div>
              <span className="font-mono text-[9px] text-cyan-300/65">{String(activeCategory.items.length).padStart(2, '0')} POINTS</span>
            </div>
            <SkillsList category={activeCategory} reducedMotion={Boolean(reducedMotion)} />
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : {opacity: 0, x: 22}}
            whileInView={{opacity: 1, x: 0}}
            viewport={{once: false, amount: 0.25}}
            transition={reducedMotion ? {duration: 0} : {delay: 0.28, duration: 0.62}}
            className="lg:col-start-3 xl:col-auto"
          >
            <SkillsStatusPanel
              category={activeCategory}
              active={isInView}
              reducedMotion={Boolean(reducedMotion)}
            />
          </motion.div>
        </div>

        <p className="sr-only" aria-live="polite">
          {activeCategory.label} selected. {activeCategory.items.length} skills shown.
        </p>
      </div>
    </motion.section>
  )
}
