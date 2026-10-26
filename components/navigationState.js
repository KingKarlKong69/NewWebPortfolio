import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const NAV_ITEMS = [
  { label: 'Home', id: 'home' },
  { label: 'About', id: 'about' },
  { label: 'Projects', id: 'projects' },
  { label: 'Skills', id: 'skills' },
  { label: 'Services', id: 'services' },
  { label: 'Contact', id: 'contact' }
]

export const NAV_EVENT = 'portfolio-nav-change'

const NavigationContext = createContext(null)

const scrollToSectionElement = (element, behavior) => {
  if (!element) return
  if(element.id==='home'){window.scrollTo({top:0,behavior});return}
  if (window.matchMedia('(min-width:1101px) and (prefers-reduced-motion:no-preference)').matches) {
    const runway = element.id === 'about' ? element.querySelector('[data-about-story]') :
      element.id === 'projects' ? element.querySelector('[data-projects-story]') : null
    if (runway) {
      const top = window.scrollY + runway.getBoundingClientRect().top
      const distance = runway.offsetHeight-window.innerHeight*(element.id === 'about' ? 2 : 1)
      const progress = Number(runway.dataset.navProgress || 0)
      window.scrollTo({top:top+Math.max(0,distance)*progress,behavior})
      return
    }
  }
  // A direct Services link lands after its overlapping whiteout, with the
  // opening title still at its initial camera position.
  const entryHold = Number(element.dataset.projectsEntryHold || element.dataset.servicesEntryHold || 0)
  if (entryHold > 0) {
    window.scrollTo({top:window.scrollY + element.getBoundingClientRect().top + entryHold*window.innerHeight/100, behavior})
  } else element.scrollIntoView({behavior, block:'start'})
}

const getHashSection = () => {
  if (typeof window === 'undefined') return 'home'

  const hash = window.location.hash.replace('#', '')
  return NAV_ITEMS.some((item) => item.id === hash) ? hash : 'home'
}

const getExistingSections = () => {
  if (typeof document === 'undefined') return []

  return NAV_ITEMS
    .map((item) => ({ ...item, element: document.getElementById(item.id) }))
    .filter((item) => item.element)
}

const getSectionInView = () => {
  if (typeof window === 'undefined') return 'home'

  const sections = getExistingSections()
  if (!sections.length) return getHashSection()

  const focusY = window.innerHeight * 0.38
  // A pinned earlier scene can occupy the same viewport as the section now
  // covering it. The later matching section owns that part of the page.
  const active = [...sections].reverse().find(({ element }) => {
    if (element.dataset.projectsEntryHold && element.inert) return false
    const rect = element.getBoundingClientRect()
    return rect.top <= focusY && rect.bottom > focusY
  })

  if (active) return active.id

  return sections.reduce((closest, section) => {
    const rect = section.element.getBoundingClientRect()
    const distance = Math.abs(rect.top - focusY)

    if (!closest || distance < closest.distance) {
      return { id: section.id, distance }
    }

    return closest
  }, null)?.id || 'home'
}

function useNavigationController() {
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    let locationFrameId = null
    let hashAnchorObserver = null
    let hashAnchorSection = null

    const releaseHashAnchor = () => {
      hashAnchorSection = null
      hashAnchorObserver?.disconnect()
      hashAnchorObserver = null
      if (locationFrameId) window.cancelAnimationFrame(locationFrameId)
      locationFrameId = null
    }

    const scheduleHashAnchor = () => {
      if (!hashAnchorSection) return
      if (locationFrameId) window.cancelAnimationFrame(locationFrameId)
      locationFrameId = window.requestAnimationFrame(() => {
        locationFrameId = null
        // `auto` inherits the global smooth-scroll rule and briefly activates every
        // WebGL section crossed by a direct hash load. Force a single-frame jump.
        scrollToSectionElement(document.getElementById(hashAnchorSection),'instant')
      })
    }

    const startHashAnchor = (section) => {
      releaseHashAnchor()
      hashAnchorSection = section
      hashAnchorObserver = new ResizeObserver(scheduleHashAnchor)
      hashAnchorObserver.observe(document.body)
      scheduleHashAnchor()
    }

    const syncFromLocation = () => {
      const nextSection = getHashSection()
      setActiveSection(nextSection)

      if (!window.location.hash) return
      window.dispatchEvent(new CustomEvent(NAV_EVENT,{detail:{section:nextSection,shortcut:true}}))
      // Keep the initial hash target anchored while fonts and dynamic sections
      // settle above it. ResizeObserver handles real layout changes without a
      // timeout or synthetic resize event; the first user intent releases it.
      startHashAnchor(nextSection)
    }
    const syncFromEvent = (event) => {
      releaseHashAnchor()
      setActiveSection(event.detail?.section || getHashSection())
    }
    let frameId = null

    const syncFromScroll = () => {
      if (frameId) return

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        const nextSection = getSectionInView()
        setActiveSection((currentSection) => currentSection === nextSection ? currentSection : nextSection)
      })
    }

    syncFromLocation()
    if (!window.location.hash) syncFromScroll()
    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener('popstate', syncFromLocation)
    window.addEventListener(NAV_EVENT, syncFromEvent)
    window.addEventListener('scroll', syncFromScroll, { passive: true })
    window.addEventListener('resize', syncFromScroll)
    window.addEventListener('portfolio:layout', scheduleHashAnchor)
    window.addEventListener('wheel', releaseHashAnchor, { passive: true })
    window.addEventListener('touchstart', releaseHashAnchor, { passive: true })
    window.addEventListener('pointerdown', releaseHashAnchor, { passive: true })
    window.addEventListener('keydown', releaseHashAnchor)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      releaseHashAnchor()
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener('popstate', syncFromLocation)
      window.removeEventListener(NAV_EVENT, syncFromEvent)
      window.removeEventListener('scroll', syncFromScroll)
      window.removeEventListener('resize', syncFromScroll)
      window.removeEventListener('portfolio:layout', scheduleHashAnchor)
      window.removeEventListener('wheel', releaseHashAnchor)
      window.removeEventListener('touchstart', releaseHashAnchor)
      window.removeEventListener('pointerdown', releaseHashAnchor)
      window.removeEventListener('keydown', releaseHashAnchor)
    }
  }, [])

  const navigateToSection = useCallback((section) => {
    setActiveSection(section)

    if (typeof window === 'undefined') return

    const target = document.getElementById(section)

    window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { section, shortcut:true } }))
    if (target) {
      scrollToSectionElement(target,'instant')
      window.history.pushState(null, '', `#${section}`)
    } else if (window.location.hash !== `#${section}`) {
      window.history.pushState(null, '', `#${section}`)
    }

  }, [])

  return useMemo(
    () => ({activeSection, navigateToSection}),
    [activeSection, navigateToSection]
  )
}

export function NavigationProvider({children}) {
  const navigation = useNavigationController()

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useActiveNavSection() {
  const navigation = useContext(NavigationContext)

  if (!navigation) {
    throw new Error('useActiveNavSection must be used within NavigationProvider')
  }

  return navigation
}
