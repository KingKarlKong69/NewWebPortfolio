import { forwardRef, useRef } from 'react'
import styles from './ProjectsSection.module.css'

const ProjectNavigation = forwardRef(function ProjectNavigation(
  { projects, activeIndex, onSelect },
  forwardedRef
) {
  const buttonRefs = useRef([])

  const focusAndSelect = (index) => {
    const normalizedIndex = (index + projects.length) % projects.length
    buttonRefs.current[normalizedIndex]?.focus()
    onSelect(normalizedIndex)
  }

  const handleKeyDown = (event, index) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusAndSelect(index + 1)
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusAndSelect(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusAndSelect(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusAndSelect(projects.length - 1)
    }
  }

  return (
    <div className={styles.navigationRail} role="tablist" aria-label="Featured projects">
      <span className={styles.railLine} aria-hidden="true" />
      {projects.map((project, index) => {
        const isActive = index === activeIndex

        return (
          <button
            key={project.id}
            ref={(node) => {
              buttonRefs.current[index] = node
              if (index === 0 && forwardedRef) {
                if (typeof forwardedRef === 'function') forwardedRef(node)
                else forwardedRef.current = node
              }
            }}
            id={`project-tab-${project.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`project-panel-${project.id}`}
            aria-label={`Project ${project.number}: ${project.title}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`${styles.projectSelector} ${isActive ? styles.projectSelectorActive : ''}`}
          >
            <span className={styles.projectNode} aria-hidden="true" />
            <span className={styles.projectNumber}>{project.number}</span>
            <span className={styles.mobileProjectName}>{project.shortTitle}</span>
          </button>
        )
      })}
    </div>
  )
})

export default ProjectNavigation

