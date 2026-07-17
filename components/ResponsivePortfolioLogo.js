import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const HolographicKLLogo = dynamic(() => import('./HolographicKLLogo'), {
  ssr: false
})

const DESKTOP_LOGO_QUERY = '(min-width: 1024px)'

export default function ResponsivePortfolioLogo() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_LOGO_QUERY)
    const syncLayout = () => setIsDesktop(desktopQuery.matches)

    syncLayout()
    desktopQuery.addEventListener('change', syncLayout)
    return () => desktopQuery.removeEventListener('change', syncLayout)
  }, [])

  return (
    <div
      className="pointer-events-none fixed left-2 top-2 z-50 h-[64px] w-[78px] lg:pointer-events-auto lg:left-[-25px] lg:top-1 lg:z-[61] lg:h-[172px] lg:w-[224px]"
      onClick={() => window.dispatchEvent(new Event('navbar:reveal'))}
    >
      {isDesktop ? (
        <HolographicKLLogo
          cameraDistance={8.15}
          intensity={1.08}
          sceneScale={0.8}
          showMask={false}
        />
      ) : (
        <Image
          src="/assets/kl-mark.svg"
          alt="Karl Lopez"
          width={132}
          height={88}
          priority
          unoptimized
          className="absolute left-1/2 top-1/2 h-auto w-[132px] max-w-none -translate-x-1/2 -translate-y-1/2"
          style={{filter: 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.68))'}}
        />
      )}
    </div>
  )
}
