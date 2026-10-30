import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Download, Menu } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SIDEBAR_NAV_ITEMS, SOCIAL_ITEMS } from './LeftNav'
import { PortfolioLogoScene } from './ResponsivePortfolioLogo'
import { NAV_ITEMS, useActiveNavSection } from './navigationState'
import styles from './NavBar.module.css'
import ResumePreview from './ResumePreview'

const MOBILE_QUERY = '(max-width: 1100px)'
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex="0"]'
const stopHeroPointer = (event) => event.stopPropagation()

function MobileNavigationDrawer({ activeSection, onClose, onNavigate, onResume, onAfterClose, toggleRef, reduceMotion }) {
  const overlayRef = useRef(null)
  const drawerRef = useRef(null)
  const backRef = useRef(null)

  useEffect(() => {
    const overlay = overlayRef.current
    const drawer = drawerRef.current
    if (!overlay || !drawer) return

    const bodyOverflow = document.body.style.overflow
    const rootOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    // Keep keyboard and assistive-technology navigation inside the modal.
    const background = Array.from(document.body.children)
      .filter((element) => element !== overlay && !['SCRIPT', 'STYLE'].includes(element.tagName))
      .map((element) => ({ element, inert: element.inert }))
    background.forEach(({ element }) => { element.inert = true })
    const focusFrame = window.requestAnimationFrame(() => backRef.current?.focus({ preventScroll: true }))

    const guardFocus = (event) => {
      if (!drawer.contains(event.target)) backRef.current?.focus({ preventScroll: true })
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const controls = Array.from(drawer.querySelectorAll(FOCUSABLE))
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    document.addEventListener('focusin', guardFocus)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('focusin', guardFocus)
      background.forEach(({ element, inert }) => { element.inert = inert })
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = rootOverflow
      if (window.matchMedia(MOBILE_QUERY).matches) toggleRef.current?.focus({ preventScroll: true })
      onAfterClose?.()
    }
  }, [onClose, onAfterClose, toggleRef])

  return (
    <motion.div
      ref={overlayRef}
      className={styles.mobileOverlay}
      data-navigation-overlay="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : .26 }}
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
      onPointerDown={stopHeroPointer}
      onPointerMove={stopHeroPointer}
      onPointerUp={stopHeroPointer}
    >
      <motion.aside
        ref={drawerRef}
        id="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={styles.mobileDrawer}
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={reduceMotion ? { duration: 0 } : { duration: .4, ease: [.22, 1, .36, 1] }}
      >
        <button ref={backRef} type="button" className={styles.drawerBack} aria-label="Close navigation" onClick={onClose}>
          <ArrowLeft aria-hidden="true" size={22} strokeWidth={1.6} />
        </button>
        <a className={styles.drawerLogo} href="#home" aria-label="Karl Lopez — Home" onClick={(event) => onNavigate(event, 'home')}>
          <span aria-hidden="true"><PortfolioLogoScene /></span>
        </a>
        <nav className={styles.mobileNavigation} aria-label="Mobile navigation">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(event) => onNavigate(event, item.id)}
                aria-current={item.id === activeSection ? 'page' : undefined}
                className={styles.mobileLink}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
                <span aria-hidden="true" className={styles.drawerActiveGlow} />
              </a>
            )
          })}
        </nav>
        <div className={styles.drawerFooter}>
          <div className={styles.drawerSocials}>
            {SOCIAL_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <a key={item.label} href={item.href} aria-label={item.label} target="_blank" rel="noopener noreferrer">
                  <Icon size={20} />
                </a>
              )
            })}
          </div>
          <button type="button" onClick={onResume} className={`${styles.resumeButton} ${styles.drawerResume}`}>
            Resume <Download aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
      </motion.aside>
    </motion.div>
  )
}

export default function NavBar() {
  const { activeSection, navigateToSection } = useActiveNavSection()
  const [navVisible, setNavVisible] = useState(true)
  const [mobileViewport, setMobileViewport] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const navRef = useRef(null)
  const menuToggleRef = useRef(null)
  const resumeButtonRef = useRef(null)
  const resumeReturnFocusRef = useRef(null)
  const pendingNavigationRef = useRef(null)
  const reduceMotion = useReducedMotion()
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])
  const closeResume = useCallback(() => setResumeOpen(false), [])
  const finishMobileNavigation = useCallback(() => {
    const section = pendingNavigationRef.current
    pendingNavigationRef.current = null
    if (section) navigateToSection(section)
  }, [navigateToSection])
  const openResume = useCallback(() => {
    pendingNavigationRef.current = null
    resumeReturnFocusRef.current = window.matchMedia(MOBILE_QUERY).matches ? menuToggleRef.current : resumeButtonRef.current
    setMobileMenuOpen(false)
    setNavVisible(true)
    setResumeOpen(true)
  }, [])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 1101px)')
    const closeDesktopMenu = () => {
      setMobileViewport(!desktopQuery.matches)
      if (desktopQuery.matches) setMobileMenuOpen(false)
    }
    closeDesktopMenu()
    desktopQuery.addEventListener('change', closeDesktopMenu)
    return () => desktopQuery.removeEventListener('change', closeDesktopMenu)
  }, [])

  const followNavigation = (event, section) => {
    event.preventDefault()
    if (mobileMenuOpen) {
      // The drawer keeps the page scroll-locked through its exit animation.
      // Its cleanup completes this navigation only after restoring overflow.
      pendingNavigationRef.current = section
      setMobileMenuOpen(false)
      return
    }
    setMobileMenuOpen(false)
    navigateToSection(section)
  }

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const setVar = () => document.documentElement.style.setProperty('--navbar-height', `${nav.offsetHeight}px`)
    setVar()
    const ro = new ResizeObserver(setVar)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let lastScrollY = window.scrollY
    const reveal = () => setNavVisible(true)
    const revealNearNav = (event) => {
      if (event.clientY <= 32) reveal()
    }
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY
      if (currentScrollY <= 24 || delta < -8) {
        setNavVisible(true)
      } else if (delta > 8 && currentScrollY > 72 && !navRef.current?.contains(document.activeElement)) {
        setNavVisible(false)
      }
      lastScrollY = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pointermove', revealNearNav, { passive: true })
    window.addEventListener('navbar:reveal', reveal)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pointermove', revealNearNav)
      window.removeEventListener('navbar:reveal', reveal)
    }
  }, [])

  return (
    <>
      <motion.header
        ref={navRef}
        initial={{ opacity: 0, y: -28 }}
        animate={{ opacity: navVisible || mobileViewport || mobileMenuOpen || resumeOpen ? 1 : 0, y: navVisible || mobileViewport || mobileMenuOpen || resumeOpen ? 0 : '-115%' }}
        transition={reduceMotion ? { duration: 0 } : { duration: .44, ease: [.22, 1, .36, 1] }}
        onMouseEnter={() => setNavVisible(true)}
        onFocusCapture={() => setNavVisible(true)}
        className={styles.header}
      >
        <div className={styles.row}>
          <nav aria-label="Main navigation" className={styles.desktopNavigation}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeSection
              return (
                <motion.a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(event) => followNavigation(event, item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${styles.desktopLink} ${isActive ? styles.activeLink : ''}`}
                  whileHover={{ color: '#ffffff' }}
                >
                  {item.label}
                  <span aria-hidden="true" className={styles.activeGlow} />
                </motion.a>
              )
            })}
          </nav>
          <div className={styles.actions}>
            <motion.button
              ref={resumeButtonRef}
              type="button"
              onClick={openResume}
              aria-haspopup="dialog"
              aria-expanded={resumeOpen}
              aria-controls="resume-preview"
              whileHover={{ scale: 1.04, boxShadow: '0 0 24px rgba(139,92,246,0.35)' }}
              whileTap={{ scale: .94 }}
              className={`${styles.resumeButton} ${styles.headerResume}`}
            >
              {resumeOpen ? 'Download' : 'Resume'} <Download aria-hidden="true" strokeWidth={1.8} />
            </motion.button>
            <button
              ref={menuToggleRef}
              type="button"
              className={styles.menuToggle}
              aria-label="Open navigation"
              aria-controls="mobile-navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => {
                setNavVisible(true)
                setMobileMenuOpen(true)
              }}
            >
              <Menu aria-hidden="true" strokeWidth={1.6} />
            </button>
          </div>
        </div>
      </motion.header>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence mode="wait">
          {mobileMenuOpen && (
            <MobileNavigationDrawer
              key="mobile-navigation"
              activeSection={activeSection}
              onClose={closeMobileMenu}
              onNavigate={followNavigation}
              onResume={openResume}
              onAfterClose={finishMobileNavigation}
              toggleRef={menuToggleRef}
              reduceMotion={reduceMotion}
            />
          )}
          {resumeOpen && !mobileMenuOpen && (
            <ResumePreview key="resume-preview" onClose={closeResume} returnFocusRef={resumeReturnFocusRef} reduceMotion={reduceMotion} />
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
