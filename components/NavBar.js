import { motion, useReducedMotion } from 'framer-motion'
import { Download } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { NAV_ITEMS, useActiveNavSection } from './navigationState'

const HolographicKLLogo = dynamic(() => import('./HolographicKLLogo'), {
  ssr: false
})

export default function NavBar(){
  const { activeSection, navigateToSection } = useActiveNavSection()
  const navItems = NAV_ITEMS
  const mobileNavItems = NAV_ITEMS
  const [navVisible, setNavVisible] = useState(true)
  const navRef = useRef(null)
  const reduceMotion = useReducedMotion()

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
      } else if (delta > 8 && currentScrollY > 72) {
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
      <motion.header
        ref={navRef}
        initial={{opacity:0,y:-28}}
        animate={{opacity: navVisible ? 1 : 0, y: navVisible ? 0 : '-115%'}}
        transition={reduceMotion ? {duration:0} : {duration:0.44, ease:[0.22,1,0.36,1]}}
        onMouseEnter={() => setNavVisible(true)}
        onFocusCapture={() => setNavVisible(true)}
        className="fixed left-0 right-0 top-0 z-50 bg-transparent px-4 py-3 md:pl-24 md:pr-8 md:py-5"
      >
      <div className="pointer-events-none fixed left-3 top-3 z-50 h-[54px] w-[54px] lg:hidden">
        <HolographicKLLogo
          cameraDistance={8.15}
          intensity={1.08}
          showMask={false}
        />
      </div>

      <nav
        aria-label="Mobile navigation"
        className="fixed right-5 top-9 z-50 flex flex-col items-start gap-8 text-[7px] font-bold uppercase tracking-[0.08em] text-gray-400 md:hidden"
      >
        {mobileNavItems.map((item) => {
          const isActive = item.id === activeSection

          return (
            <motion.a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => navigateToSection(item.id)}
              className={`relative cursor-pointer transition-colors ${isActive ? 'text-cyan-200' : 'text-gray-400 hover:text-cyan-200 focus:text-cyan-200'}`}
              whileHover={{x: -2, color:'#A5F3FC'}}
              whileFocus={{x: -2, color:'#A5F3FC'}}
            >
              {item.label}
            </motion.a>
          )
        })}
      </nav>

      <div className="mx-auto grid max-w-[1180px] grid-cols-[1fr_auto] items-center gap-8 px-4 py-3 md:px-6 md:py-3">
        <nav className="hidden md:flex justify-center gap-11 text-[13px] text-gray-300 tracking-wide">
          {navItems.map((item) => {
            const isActive = item.id === activeSection

            return (
              <motion.a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => navigateToSection(item.id)}
                className={`group relative cursor-pointer transition-colors ${isActive ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                whileHover={{color:'#ffffff'}}
              >
                {item.label}
                <motion.span
                  className={`absolute -bottom-4 left-1/2 h-px -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300 to-transparent transition-all duration-300 ${isActive ? 'w-20 opacity-100' : 'w-0 opacity-0 group-hover:w-16 group-hover:opacity-80'}`}
                  style={isActive ? {
                    background: 'linear-gradient(90deg, transparent 0%, rgba(103,232,249,0.28) 28%, rgba(165,243,252,1) 50%, rgba(103,232,249,0.28) 72%, transparent 100%)',
                    boxShadow: '0 0 8px rgba(0,229,255,0.72), 0 0 18px rgba(0,229,255,0.38), 0 0 34px rgba(0,229,255,0.18)'
                  } : undefined}
                />
              </motion.a>
            )
          })}
        </nav>

        <div className="flex items-center justify-end gap-5">
          <motion.button
            whileHover={{scale:1.04,boxShadow: '0 0 24px rgba(139,92,246,0.35)'}}
            whileTap={{scale:0.94}}
            className="hidden md:inline-flex items-center gap-3 rounded-md border border-purple-300/35 bg-transparent px-5 py-3 text-xs font-bold text-gray-200"
          >
            Resume <Download size={14} strokeWidth={1.8} />
          </motion.button>
        </div>
      </div>
      </motion.header>
  )
}
