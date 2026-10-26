import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import styles from './ResponsivePortfolioLogo.module.css'
import {useActiveNavSection} from './navigationState'

const HolographicKLLogo = dynamic(() => import('./HolographicKLLogo'), {
  ssr: false
})

const DESKTOP_LOGO_QUERY = '(min-width: 1101px)'

export function PortfolioLogoScene() {
  return (
    <HolographicKLLogo
      cameraDistance={8.15}
      intensity={1.08}
      sceneScale={0.8}
      showMask={false}
    />
  )
}

export default function ResponsivePortfolioLogo() {
  const {navigateToSection}=useActiveNavSection()
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_LOGO_QUERY)
    const syncLayout = () => setIsDesktop(desktopQuery.matches)

    syncLayout()
    desktopQuery.addEventListener('change', syncLayout)
    return () => desktopQuery.removeEventListener('change', syncLayout)
  }, [])

  return (
    <button type="button" aria-label="Go to Home"
      className={styles.logo}
      onClick={() => {navigateToSection('home');window.dispatchEvent(new Event('navbar:reveal'))}}
    >
      {isDesktop && <PortfolioLogoScene />}
    </button>
  )
}
