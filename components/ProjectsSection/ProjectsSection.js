import dynamic from 'next/dynamic'
import { motion, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ProjectDetails from './ProjectDetails'
import ProjectNavigation from './ProjectNavigation'
import { PROJECTS } from './projectsData'
import styles from './ProjectsSection.module.css'

const AUTO_PROJECT_DELAY = 4000
const MANUAL_PROJECT_DELAY = 8000
const SCREENSHOT_DELAY = 3000

const ProjectLaptopScene = dynamic(() => import('./ProjectLaptopScene'), {
  ssr: false,
  loading: () => <div className={styles.laptopLoading} aria-hidden="true" />
})

function ProjectDialog({ project, onClose }) {
  const dialogRef = useRef(null)
  const [screenshots, setScreenshots] = useState([])
  const [activeScreenshot, setActiveScreenshot] = useState(0)
  const [isLoadingScreenshots, setIsLoadingScreenshots] = useState(false)

  useEffect(() => {
    if (!project) return undefined

    const controller = new AbortController()
    setScreenshots([])
    setActiveScreenshot(0)
    setIsLoadingScreenshots(true)

    fetch(`/api/projects/${encodeURIComponent(project.id)}`, {signal: controller.signal})
      .then((response) => response.ok ? response.json() : {images: []})
      .then(({images}) => {
        if (controller.signal.aborted) return
        const discoveredImages = Array.isArray(images) ? images : []
        setScreenshots(discoveredImages.length > 0
          ? discoveredImages
          : (project.screenshotAvailable && project.screenshot ? [project.screenshot] : []))
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setScreenshots(project.screenshotAvailable && project.screenshot ? [project.screenshot] : [])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingScreenshots(false)
      })

    return () => controller.abort()
  }, [project])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !project) return undefined
    if (!dialog.open) dialog.showModal()
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose, project])

  useEffect(() => {
    if (!project || screenshots.length <= 1) return undefined
    const timeout = window.setTimeout(() => {
      setActiveScreenshot((index) => (index + 1) % screenshots.length)
    }, SCREENSHOT_DELAY)
    return () => window.clearTimeout(timeout)
  }, [activeScreenshot, project, screenshots.length])

  const moveScreenshot = (direction) => {
    setActiveScreenshot((index) => (index + direction + screenshots.length) % screenshots.length)
  }

  if (!project) return null

  return (
    <dialog ref={dialogRef} className={styles.projectDialog} aria-labelledby="project-dialog-title">
      <button type="button" className={styles.dialogClose} onClick={() => dialogRef.current?.close()} aria-label="Close project details">
        <X size={20} />
      </button>
      <div className={styles.dialogPreview} style={{'--project-accent': project.accent, '--project-secondary': project.secondaryAccent}}>
        {isLoadingScreenshots
          ? <div className={styles.dialogPlaceholder}><span>Loading screens…</span></div>
          : screenshots.length > 0
            ? <img src={screenshots[activeScreenshot]} alt={`${project.title} screen ${activeScreenshot + 1} of ${screenshots.length}`} />
          : (
            <div className={styles.dialogPlaceholder} role="img" aria-label={`Preview placeholder for ${project.title}`}>
              <span>{project.shortTitle}</span>
              <small>Add screenshots to public/projects/{project.id}/</small>
            </div>
          )}
      </div>
      {screenshots.length > 1 && (
        <div className={styles.dialogGalleryControls} aria-label="Project screenshots">
          <button type="button" onClick={() => moveScreenshot(-1)}>Previous</button>
          <span aria-live="polite">{activeScreenshot + 1} / {screenshots.length}</span>
          <button type="button" onClick={() => moveScreenshot(1)}>Next</button>
        </div>
      )}
      <p className={styles.dialogEyebrow}>Project {project.number}</p>
      <h3 id="project-dialog-title">{project.title}</h3>
      <p>{project.description}</p>
      <dl className={styles.dialogFacts}>
        <div><dt>Role</dt><dd>{project.role || 'Pending project information'}</dd></div>
        <div><dt>Impact</dt><dd>{project.impact || 'Pending project information'}</dd></div>
      </dl>
    </dialog>
  )
}

export default function ProjectsSection() {
  const sectionRef = useRef(null)
  const firstProjectRef = useRef(null)
  const nextProjectDelayRef = useRef(AUTO_PROJECT_DELAY)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isInView, setIsInView] = useState(false)
  const [hasEntered, setHasEntered] = useState(false)
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [dialogProject, setDialogProject] = useState(null)
  const reducedMotion = useReducedMotion()
  const activeProject = PROJECTS[activeIndex]

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting)
      if (entry.isIntersecting) setHasEntered(true)
    }, {threshold: 0.08, rootMargin: '15% 0px 15% 0px'})
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  const closeDialog = useCallback(() => setDialogProject(null), [])

  useEffect(() => {
    if (!isInView || dialogProject || PROJECTS.length <= 1) return undefined

    const timeout = window.setTimeout(() => {
      nextProjectDelayRef.current = AUTO_PROJECT_DELAY
      setActiveIndex((currentIndex) => (currentIndex + 1) % PROJECTS.length)
    }, nextProjectDelayRef.current)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, dialogProject, isInView, scheduleVersion])

  const selectProject = useCallback((projectIndex) => {
    nextProjectDelayRef.current = MANUAL_PROJECT_DELAY
    setScheduleVersion((version) => version + 1)
    setActiveIndex((currentIndex) => currentIndex === projectIndex ? currentIndex : projectIndex)
  }, [])

  return (
    <motion.section
      ref={sectionRef}
      id="projects"
      aria-labelledby="projects-heading"
      initial={reducedMotion ? false : {opacity: 0, y: 38}}
      whileInView={{opacity: 1, y: 0}}
      viewport={{once: false, amount: 0.07}}
      transition={reducedMotion ? {duration: 0} : {duration: 0.8, ease: [0.22, 1, 0.36, 1]}}
      className={styles.section}
    >
      <div className={styles.orbitBackdrop} aria-hidden="true">
        <span /><span /><span />
      </div>

      <div className={styles.sectionInner}>
        <header className={styles.sectionHeader}>
          <div className={styles.headingGroup}>
            <h2 id="projects-heading">Projects</h2>
          </div>
        </header>

        <div id="projects-showcase" className={styles.showcasePanel}>
          <ProjectNavigation
            ref={firstProjectRef}
            projects={PROJECTS}
            activeIndex={activeIndex}
            onSelect={selectProject}
          />

          <ProjectDetails
            key={activeProject.id}
            project={activeProject}
            reducedMotion={reducedMotion}
            onOpenCaseStudy={setDialogProject}
          />

          <div className={styles.laptopStage}>
            <div className={styles.stageOrbital} aria-hidden="true" />
            <ProjectLaptopScene
              projects={PROJECTS}
              activeIndex={activeIndex}
              active={isInView}
              mounted={hasEntered}
              reducedMotion={Boolean(reducedMotion)}
            />
            <div className={styles.screenCaption} aria-live="polite">
              <span>Loaded interface</span>
              <strong>{activeProject.shortTitle}</strong>
            </div>
          </div>
        </div>
      </div>

      <ProjectDialog project={dialogProject} onClose={closeDialog} />
    </motion.section>
  )
}
