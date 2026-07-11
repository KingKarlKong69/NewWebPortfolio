import { useEffect, useState } from 'react'

export const NAV_ITEMS = [
  { label: 'Home', id: 'home' },
  { label: 'About', id: 'about' },
  { label: 'Projects', id: 'projects' },
  { label: 'Skills', id: 'skills' },
  { label: 'Services', id: 'services' },
  { label: 'Contact', id: 'contact' }
]

const NAV_EVENT = 'portfolio-nav-change'

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
  const active = sections.find(({ element }) => {
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

export function useActiveNavSection() {
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    const syncFromLocation = () => setActiveSection(getHashSection())
    const syncFromEvent = (event) => setActiveSection(event.detail?.section || getHashSection())
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
    syncFromScroll()
    window.addEventListener('hashchange', syncFromLocation)
    window.addEventListener(NAV_EVENT, syncFromEvent)
    window.addEventListener('scroll', syncFromScroll, { passive: true })
    window.addEventListener('resize', syncFromScroll)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.removeEventListener('hashchange', syncFromLocation)
      window.removeEventListener(NAV_EVENT, syncFromEvent)
      window.removeEventListener('scroll', syncFromScroll)
      window.removeEventListener('resize', syncFromScroll)
    }
  }, [])

  const navigateToSection = (section) => {
    setActiveSection(section)

    if (typeof window === 'undefined') return

    const target = document.getElementById(section)

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.pushState(null, '', `#${section}`)
    } else if (window.location.hash !== `#${section}`) {
      window.history.pushState(null, '', `#${section}`)
    }

    window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: { section } }))
  }

  return { activeSection, navigateToSection }
}
