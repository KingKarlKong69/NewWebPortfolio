import Head from 'next/head'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const HolographicKLLogo = dynamic(() => import('../components/HolographicKLLogo'), {
  ssr: false
})

const LOGO_SETTINGS_KEY = 'kl-logo-lab-settings'

export default function LogoLab() {
  const [showRing, setShowRing] = useState(true)
  const [showBeam, setShowBeam] = useState(true)
  const [showParticles, setShowParticles] = useState(true)
  const [autoRotate, setAutoRotate] = useState(true)
  const [intensity, setIntensity] = useState(1.08)
  const [cameraDistance, setCameraDistance] = useState(5.75)
  const [logoScale, setLogoScale] = useState(1.08)

  useEffect(() => {
    const savedSettings = window.localStorage.getItem(LOGO_SETTINGS_KEY)
    if (!savedSettings) return

    try {
      const settings = JSON.parse(savedSettings)
      if (typeof settings.intensity === 'number') setIntensity(settings.intensity)
    } catch {
      window.localStorage.removeItem(LOGO_SETTINGS_KEY)
    }
  }, [])

  useEffect(() => {
    const settings = { intensity }
    window.localStorage.setItem(LOGO_SETTINGS_KEY, JSON.stringify(settings))
    window.dispatchEvent(new CustomEvent('kl-logo-lab-settings-change', { detail: settings }))
  }, [intensity])

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <Head>
        <title>KL Logo Lab</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(0,229,255,0.18),transparent_22%),radial-gradient(circle_at_58%_56%,rgba(139,92,246,0.2),transparent_28%),linear-gradient(180deg,#020308_0%,#000_48%,#03000a_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(0,229,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.05)_1px,transparent_1px)] [background-size:96px_96px]" />
      <div className="pointer-events-none absolute left-1/2 top-[54%] h-px w-[72vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent shadow-[0_0_28px_rgba(0,229,255,0.45)]" />

      <section className="relative z-10 flex min-h-screen items-center justify-center overflow-visible px-4 py-10">
        <div
          className="relative aspect-square w-[min(94vw,980px)]"
          style={{ transform: `scale(${logoScale})` }}
        >
          <HolographicKLLogo
            cameraDistance={cameraDistance}
            autoRotate={autoRotate}
            showParticles={showParticles}
            showRing={showRing}
            showBeam={showBeam}
            intensity={intensity}
            showMask={false}
          />
        </div>
      </section>

      <aside className="fixed right-5 top-5 z-20 w-[260px] rounded-lg border border-cyan-300/20 bg-black/62 p-4 text-xs text-cyan-50 shadow-[0_0_30px_rgba(0,229,255,0.12)] backdrop-blur-md">
        <div className="mb-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">Logo Lab</p>
          <h1 className="mt-1 text-lg font-black tracking-wide">KL Hologram</h1>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">
            Glow
            <span>{intensity.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min="0.65"
            max="1.45"
            step="0.01"
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">
            Camera
            <span>{cameraDistance.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min="5.0"
            max="8.2"
            step="0.1"
            value={cameraDistance}
            onChange={(event) => setCameraDistance(Number(event.target.value))}
            className="w-full accent-purple-300"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300">
            Scale
            <span>{logoScale.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min="0.78"
            max="1.24"
            step="0.01"
            value={logoScale}
            onChange={(event) => setLogoScale(Number(event.target.value))}
            className="w-full accent-cyan-300"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-200">
          {[
            ['Ring', showRing, setShowRing],
            ['Beam', showBeam, setShowBeam],
            ['Particles', showParticles, setShowParticles],
            ['Rotate', autoRotate, setAutoRotate]
          ].map(([label, checked, setter]) => (
            <label key={label} className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.03] px-2 py-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => setter(event.target.checked)}
                className="accent-cyan-300"
              />
              {label}
            </label>
          ))}
        </div>
      </aside>
    </main>
  )
}
