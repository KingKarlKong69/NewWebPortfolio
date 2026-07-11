import { animate, remove, set } from 'animejs'
import { ArrowRight, ChartNoAxesCombined, Code2, UserRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import styles from './ProjectsSection.module.css'

export default function ProjectDetails({ project, reducedMotion, onOpenCaseStudy }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    const targets = root.querySelectorAll('[data-project-reveal]')
    remove(targets)

    if (reducedMotion) {
      set(targets, {opacity: 1, translateY: 0})
      return () => remove(targets)
    }

    set(targets, {opacity: 0, translateY: 14})
    animate(targets, {
      opacity: [0, 1],
      translateY: [14, 0],
      delay: (_, index) => index * 62,
      duration: 540,
      ease: 'out(4)'
    })

    return () => remove(targets)
  }, [project.id, reducedMotion])

  return (
    <article
      ref={rootRef}
      id={`project-panel-${project.id}`}
      role="tabpanel"
      aria-labelledby={`project-tab-${project.id}`}
      className={styles.detailsPanel}
    >
      <div data-project-reveal className={styles.projectEyebrow}>
        <span>#{project.number}</span>
        <span aria-hidden="true">—</span>
        <span>{project.eyebrow}</span>
      </div>

      <h3 data-project-reveal className={styles.projectTitle}>{project.title}</h3>
      <p data-project-reveal className={styles.projectDescription}>{project.description}</p>

      <div className={styles.projectMeta}>
        <div data-project-reveal className={styles.metaRow}>
          <span className={`${styles.metaIcon} ${styles.metaIconCyan}`} aria-hidden="true">
            <UserRound size={20} strokeWidth={1.8} />
          </span>
          <span>
            <span className={styles.metaLabel}>Role</span>
            <span className={styles.metaValue}>{project.role || 'Project role pending'}</span>
          </span>
        </div>

        <div data-project-reveal className={styles.metaRow}>
          <span className={`${styles.metaIcon} ${styles.metaIconViolet}`} aria-hidden="true">
            <ChartNoAxesCombined size={20} strokeWidth={1.8} />
          </span>
          <span>
            <span className={styles.metaLabel}>Impact</span>
            <span className={styles.metaValue}>{project.impact || 'Impact details pending'}</span>
          </span>
        </div>

        <div data-project-reveal className={styles.metaRow}>
          <span className={`${styles.metaIcon} ${styles.metaIconBlue}`} aria-hidden="true">
            <Code2 size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.technologyCopy}>
            <span className={styles.metaLabel}>Technologies</span>
            <span className={styles.technologyList}>
              {project.technologies.length > 0
                ? project.technologies.map((technology) => (
                  <span key={technology} className={styles.technologyChip}>{technology}</span>
                ))
                : <span className={styles.pendingTechnology}>Stack details pending</span>}
            </span>
          </span>
        </div>
      </div>

      <button
        data-project-reveal
        type="button"
        className={styles.caseStudyButton}
        onClick={() => onOpenCaseStudy(project)}
      >
        View project details <ArrowRight size={18} aria-hidden="true" />
      </button>
    </article>
  )
}

