import {motion} from 'framer-motion'
import {Download, ExternalLink, X} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import styles from './ResumePreview.module.css'

const PAGES = [1, 2]
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]'

export default function ResumePreview({onClose, returnFocusRef, reduceMotion}) {
  const overlayRef = useRef(null)
  const panelRef = useRef(null)
  const closeRef = useRef(null)
  const scrollRef = useRef(null)
  const pagesRef = useRef([])
  const [activePage, setActivePage] = useState(1)

  useEffect(() => {
    const overlay = overlayRef.current
    const panel = panelRef.current
    const root = document.documentElement
    const body = document.body
    const overflow = [body.style.overflow, root.style.overflow]
    const padding = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - root.clientWidth
    body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + scrollbarWidth}px`
    body.style.overflow = root.style.overflow = 'hidden'
    const background = Array.from(body.children)
      .filter(element => element !== overlay && !['SCRIPT', 'STYLE'].includes(element.tagName))
      .map(element => ({element, inert: element.inert}))
    background.forEach(({element}) => { element.inert = true })
    closeRef.current?.focus({preventScroll: true})

    const guardFocus = event => {
      if (!panel.contains(event.target)) closeRef.current?.focus({preventScroll: true})
    }
    const handleKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(panel.querySelectorAll(FOCUSABLE))
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey, true)
    document.addEventListener('focusin', guardFocus)
    return () => {
      document.removeEventListener('keydown', handleKey, true)
      document.removeEventListener('focusin', guardFocus)
      background.forEach(({element, inert}) => { element.inert = inert })
      body.style.overflow = overflow[0]
      root.style.overflow = overflow[1]
      body.style.paddingRight = padding
      returnFocusRef.current?.focus({preventScroll: true})
    }
  }, [onClose, returnFocusRef])

  useEffect(() => {
    const scroller = scrollRef.current
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
      if (visible[0]) setActivePage(Number(visible[0].target.dataset.page))
    }, {root: scroller, threshold: [0, .2, .4, .6, .8, 1]})
    pagesRef.current.forEach(page => page && observer.observe(page))
    return () => observer.disconnect()
  }, [])

  const showPage = page => {
    const scroller = scrollRef.current
    const target = pagesRef.current[page - 1]
    if (!scroller || !target) return
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24
    scroller.scrollTo({top, behavior: reduceMotion ? 'auto' : 'smooth'})
    setActivePage(page)
  }

  return <div ref={overlayRef} className={styles.overlay} data-resume-overlay="true"
    onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()}
    onPointerUp={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
    onTouchMove={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <motion.div className={styles.backdrop} aria-hidden="true" onClick={onClose}
      initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
      transition={{duration: reduceMotion ? .1 : .45}} />
    <motion.aside ref={panelRef} id="resume-preview" role="dialog" aria-modal="true"
      aria-labelledby="resume-preview-title" aria-describedby="resume-preview-description" className={styles.panel}
      initial={{x: reduceMotion ? 0 : '100%', opacity: 0}} animate={{x: 0, opacity: 1}}
      exit={{x: reduceMotion ? 0 : '100%', opacity: 0}}
      transition={{duration: reduceMotion ? .1 : .55, ease: [.22, 1, .36, 1]}}>
      <header className={styles.toolbar}>
        <div><h2 id="resume-preview-title">Resume</h2><p id="resume-preview-description">Karl Lopez <span> / {PAGES.length} pages</span></p></div>
        <div className={styles.actions}>
          <a className={styles.download} href="/the-resume.pdf" download="Karl-Lopez-Resume.pdf">Download <Download size={16} aria-hidden="true" /></a>
          <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Close resume preview"><X size={21} aria-hidden="true" /></button>
        </div>
      </header>
      <div className={styles.viewer}>
        <nav className={styles.thumbnails} aria-label="Resume pages">
          {PAGES.map(page => <button key={page} type="button" onClick={() => showPage(page)}
            aria-label={`Show resume page ${page}`} aria-current={activePage === page ? 'page' : undefined}>
            <img src={`/resume/page-${page}.webp`} alt="" width="1391" height="1800" draggable="false" />
            <span>{String(page).padStart(2, '0')}</span>
          </button>)}
        </nav>
        <div ref={scrollRef} className={styles.pages} tabIndex={0} role="region" aria-label="Scrollable resume preview">
          {PAGES.map(page => <figure key={page} ref={element => { pagesRef.current[page - 1] = element }} data-page={page}>
            <img src={`/resume/page-${page}.webp`} alt={`Karl Lopez's resume, page ${page}. Open the PDF below for selectable text and document links.`} width="1391" height="1800" draggable="false" />
            <figcaption>PAGE {page} / {PAGES.length}</figcaption>
          </figure>)}
          <a className={styles.original} href="/the-resume.pdf" target="_blank" rel="noopener noreferrer">Open original PDF <ExternalLink size={14} aria-hidden="true" /></a>
        </div>
      </div>
    </motion.aside>
  </div>
}
