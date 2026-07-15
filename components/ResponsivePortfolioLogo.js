import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const HolographicKLLogo = dynamic(() => import('./HolographicKLLogo'), {
  ssr: false
})

const DESKTOP_LOGO_QUERY = '(min-width: 1024px)'

export default function ResponsivePortfolioLogo() {
  const [sceneScale, setSceneScale] = useState(1)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_LOGO_QUERY)
    const syncSceneScale = () => setSceneScale(desktopQuery.matches ? 0.8 : 1)

    syncSceneScale()
    desktopQuery.addEventListener('change', syncSceneScale)
    return () => desktopQuery.removeEventListener('change', syncSceneScale)
  }, [])

  return (
    <div
      className="pointer-events-none fixed left-3 top-3 z-50 h-[54px] w-[54px] lg:pointer-events-auto lg:left-[-25px] lg:top-1 lg:z-[61] lg:h-[172px] lg:w-[224px]"
      onClick={() => window.dispatchEvent(new Event('navbar:reveal'))}
    >
      <HolographicKLLogo
        cameraDistance={8.15}
        intensity={1.08}
        sceneScale={sceneScale}
        showMask={false}
      />
    </div>
  )
}
