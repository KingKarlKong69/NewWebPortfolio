import { Activity, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import styles from './SkillsSection.module.css'

export default function SkillsStatusPanel({ category, active, reducedMotion }) {
  const rows = [
    { label: category.label, value: 'ACTIVE' },
    { label: 'Data points', value: String(category.items.length).padStart(2, '0') },
    { label: 'Radar system', value: 'ONLINE' },
    { label: 'Animation', value: reducedMotion ? 'REDUCED' : 'SYNCED' },
    { label: 'Performance', value: 'STABLE' }
  ]

  return (
    <aside className={`${styles.panel} ${styles.statusPanel} relative overflow-hidden rounded-xl border p-4 sm:p-5`} aria-label="Skills system status">
      <span aria-hidden="true" className={styles.panelCorner} />
      <div className="mb-3 flex items-center gap-3 border-b border-cyan-300/10 pb-3">
        <Activity size={16} strokeWidth={1.8} className="text-cyan-300" aria-hidden="true" />
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300 sm:text-[11px]">
          System Status
        </h3>
      </div>

      <div className="divide-y divide-cyan-300/[0.07]">
        {rows.map((row, index) => (
          <motion.div
            key={`${category.id}-${row.label}`}
            initial={reducedMotion ? false : {opacity: 0, x: 8}}
            animate={{opacity: 1, x: 0}}
            transition={{delay: reducedMotion ? 0 : index * 0.05, duration: reducedMotion ? 0 : 0.32}}
            className="flex min-h-[39px] items-center justify-between gap-3 py-2"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={`${styles.statusDot} ${active ? styles.statusDotActive : ''}`} aria-hidden="true" />
              <span className="truncate font-mono text-[8px] uppercase tracking-[0.04em] text-slate-400 sm:text-[9px]">
                {row.label}
              </span>
            </span>
            <span className="shrink-0 font-mono text-[8px] font-semibold text-emerald-300 sm:text-[9px]">
              {row.value}
            </span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-cyan-300/10 pt-3 text-[9px] text-slate-600">
        <span>Last synchronized: now</span>
        <motion.span
          animate={!reducedMotion && active ? {rotate: 360} : {rotate: 0}}
          transition={!reducedMotion && active ? {duration: 4.5, ease: 'linear', repeat: Infinity} : {duration: 0}}
          className="inline-flex text-cyan-400"
        >
          <RefreshCw size={14} strokeWidth={1.7} aria-hidden="true" />
        </motion.span>
      </div>
    </aside>
  )
}

