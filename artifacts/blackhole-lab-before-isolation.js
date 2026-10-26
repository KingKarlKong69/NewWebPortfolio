import Head from 'next/head'
import dynamic from 'next/dynamic'
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
  BLACK_HOLE_LAB_PRESETS,
  cloneBlackHolePreset
} from '../components/ContactSection/blackHoleLabConfig'
import styles from '../styles/BlackHoleLab.module.css'

const BlackHoleCanvas = dynamic(
  () => import('../components/ContactSection/UnifiedBlackHoleScene'),
  {ssr: false}
)

const STORAGE_KEY = 'kl-black-hole-lab-v1'

const CONTROL_GROUPS = [
  {
    id: 'scene',
    title: 'Scene & lensing',
    controls: [
      ['blackHoleScale', 'Overall scale', 0.62, 1.38, 0.01],
      ['raymarchQuality', 'Raymarch quality', 0.25, 1, 0.01],
      ['centerX', 'Horizontal position', 0.34, 0.74, 0.005],
      ['centerY', 'Vertical position', 0.36, 0.64, 0.005],
      ['horizonScale', 'Event horizon', 0.72, 1.28, 0.01],
      ['lensingStrength', 'Lensing strength', 0, 1.8, 0.01],
      ['pointerStrength', 'Pointer influence', 0, 2, 0.01]
    ]
  },
  {
    id: 'motion',
    title: 'Motion',
    controls: [
      ['motionSpeed', 'Master motion', 0.05, 1.8, 0.01],
      ['rotationSpeed', 'Gas rotation', 0.1, 2.2, 0.01],
      ['noiseSpeed', 'Cloud evolution', 0.02, 1.5, 0.01]
    ]
  },
  {
    id: 'material',
    title: 'Accretion material',
    controls: [
      ['gasDensity', 'Gas density', 0.15, 2.1, 0.01],
      ['diskThickness', 'Volume thickness', 0.45, 2.2, 0.01],
      ['cloudScale', 'Macro cloud scale', 0.3, 2.1, 0.01],
      ['fineDetail', 'Fine detail', 0.18, 1.9, 0.01],
      ['filamentStrength', 'Filaments', 0, 2.5, 0.01],
      ['cloudBreakup', 'Volume breakup', 0, 0.92, 0.01],
      ['foregroundThickness', 'Foreground thickness', 0.4, 2.5, 0.01],
      ['foregroundBreakup', 'Foreground breakup', 0, 1, 0.01],
      ['gasDevelopment', 'Gas replacement mix', 0, 1, 0.01]
    ]
  },
  {
    id: 'light',
    title: 'Light & energy',
    controls: [
      ['photonGlow', 'Photon glow', 0, 2.5, 0.01],
      ['photonThickness', 'Photon thickness', 0.28, 2.2, 0.01],
      ['equatorialGlow', 'Equatorial current', 0, 2.2, 0.01],
      ['exposure', 'Exposure', 0.45, 1.8, 0.01],
      ['dustBrightness', 'Dust brightness', 0, 2.2, 0.01],
      ['hotColorBoost', 'Inner heat energy', 0.5, 2, 0.01]
    ]
  }
]

const LAYER_LABELS = {
  background: 'Background stars',
  raymarchedGas: 'Raymarched gas',
  foregroundGas: 'Foreground gas',
  photonRing: 'Photon ring',
  equatorialCurrent: 'Equatorial current',
  dust: 'Fine dust',
  boundAsteroids: 'Bound asteroids',
  independentAsteroids: 'Independent asteroids',
  lensing: 'Space lensing'
}

const DEBUG_VIEWS = [
  ['0', 'Final composite'],
  ['1', 'Foreground density'],
  ['2', 'Macro noise'],
  ['3', 'Heat field'],
  ['4', 'Event-horizon mask']
]

const formatValue = (value) => (
  Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2)
)

const sanitizeConfig = (value) => {
  const base = cloneBlackHolePreset('gas')
  if (!value || typeof value !== 'object') return base

  Object.keys(base.tuning).forEach((key) => {
    const candidate = value.tuning?.[key]
    if (typeof base.tuning[key] === 'number' && Number.isFinite(candidate)) {
      base.tuning[key] = candidate
    } else if (
      typeof base.tuning[key] === 'string' &&
      typeof candidate === 'string' &&
      /^#[0-9a-f]{6}$/i.test(candidate)
    ) {
      base.tuning[key] = candidate
    }
  })
  Object.keys(base.layers).forEach((key) => {
    if (typeof value.layers?.[key] === 'boolean') {
      base.layers[key] = value.layers[key]
    }
  })
  return base
}

function RangeControl({control, value, onChange}) {
  const [key, label, min, max, step] = control
  return (
    <label className={styles.rangeControl}>
      <span className={styles.controlHeading}>
        <span>{label}</span>
        <output>{formatValue(value)}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(key, Number(event.target.value))}
      />
    </label>
  )
}

function DiagnosticItem({label, value, accent = false}) {
  return (
    <div className={styles.diagnosticItem}>
      <span>{label}</span>
      <strong className={accent ? styles.diagnosticAccent : ''}>{value}</strong>
    </div>
  )
}

function ControlGroup({title, initialOpen = false, children}) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <details
      className={styles.controlGroup}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {children}
    </details>
  )
}

export default function BlackHoleLab() {
  const pointerRef = useRef({x: 0, y: 0})
  const hydratedRef = useRef(false)
  const noticeTimerRef = useRef(null)
  const initialPreset = useMemo(() => cloneBlackHolePreset('gas'), [])
  const [tuning, setTuning] = useState(initialPreset.tuning)
  const [layers, setLayers] = useState(initialPreset.layers)
  const [presetKey, setPresetKey] = useState('gas')
  const [running, setRunning] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const [panelOpen, setPanelOpen] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [manualTime, setManualTime] = useState(0)
  const [resetToken, setResetToken] = useState(0)
  const [debugView, setDebugView] = useState(0)
  const [diagnostics, setDiagnostics] = useState(null)
  const [sceneStatus, setSceneStatus] = useState('Initializing')
  const [notice, setNotice] = useState('')
  const [jsonDraft, setJsonDraft] = useState('')

  const labConfig = useMemo(() => ({tuning, layers}), [layers, tuning])
  const active = pageVisible && running

  const showNotice = useCallback((message) => {
    setNotice(message)
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(''), 1800)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const restored = sanitizeConfig(parsed)
        setTuning(restored.tuning)
        setLayers(restored.layers)
        setDebugView(Number.isFinite(parsed.debugView) ? parsed.debugView : 0)
        setPresetKey('custom')
      } catch {
        window.localStorage.removeItem(STORAGE_KEY)
      }
    }
    hydratedRef.current = true
  }, [])

  useEffect(() => {
    if (!hydratedRef.current) return
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({tuning, layers, debugView})
    )
  }, [debugView, layers, tuning])

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  useEffect(() => () => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
  }, [])

  const updateTuning = useCallback((key, value) => {
    setPresetKey('custom')
    setTuning((current) => ({...current, [key]: value}))
  }, [])

  const updateLayer = useCallback((key, value) => {
    setPresetKey('custom')
    setLayers((current) => ({...current, [key]: value}))
  }, [])

  const applyPreset = useCallback((key) => {
    const next = cloneBlackHolePreset(key)
    setTuning(next.tuning)
    setLayers(next.layers)
    setPresetKey(key)
    setDebugView(0)
    setManualMode(false)
    showNotice(`${BLACK_HOLE_LAB_PRESETS[key].label} loaded`)
  }, [showNotice])

  const restartSimulation = () => {
    setManualTime(0)
    setResetToken((value) => value + 1)
    showNotice('Shader timeline restarted')
  }

  const exportConfig = useCallback(async () => {
    const value = JSON.stringify({tuning, layers, debugView}, null, 2)
    setJsonDraft(value)
    try {
      await window.navigator.clipboard.writeText(value)
      showNotice('Settings copied')
    } catch {
      showNotice('Settings shown below')
    }
  }, [debugView, layers, showNotice, tuning])

  const importConfig = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonDraft)
      const next = sanitizeConfig(parsed)
      setTuning(next.tuning)
      setLayers(next.layers)
      setDebugView(Number.isFinite(parsed.debugView) ? parsed.debugView : 0)
      setPresetKey('custom')
      showNotice('Settings imported')
    } catch {
      showNotice('That JSON is not valid')
    }
  }, [jsonDraft, showNotice])

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    pointerRef.current.y = -(((event.clientY - bounds.top) / bounds.height - 0.5) * 2)
  }

  const resetPointer = () => {
    pointerRef.current.x = 0
    pointerRef.current.y = 0
  }

  return (
    <main
      className={styles.lab}
      data-panel-open={panelOpen ? 'true' : 'false'}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <Head>
        <title>Black Hole Lab — Karl Lopez</title>
        <meta
          name="description"
          content="A desktop shader laboratory for refining the portfolio black-hole renderer."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.canvas}>
        <BlackHoleCanvas
          active={active}
          reducedMotion={false}
          pointerRef={pointerRef}
          quality="desktop"
          phase={active ? 'RUNNING' : 'PAUSED_OFFSCREEN'}
          labConfig={labConfig}
          debugView={debugView}
          manualTime={manualMode ? manualTime : null}
          resetToken={resetToken}
          onReady={() => setSceneStatus('Running')}
          onStable={() => setSceneStatus('Stable')}
          onError={() => setSceneStatus('Renderer error')}
          onContextLost={() => setSceneStatus('Context lost')}
          onContextRestored={() => setSceneStatus('Restoring')}
          onDiagnostics={setDiagnostics}
        />
      </div>

      <div className={styles.topBar}>
        <div>
          <span className={styles.kicker}>KL / VISUAL SYSTEMS</span>
          <h1>Black Hole Lab</h1>
        </div>
        <div className={styles.topActions}>
          <span className={styles.productionLock}>
            Contact preset locked
          </span>
          <a href="/" className={styles.backLink}>
            <ChevronLeft size={15} />
            Portfolio
          </a>
        </div>
      </div>

      <div className={styles.transport}>
        <button
          type="button"
          onClick={() => setRunning((value) => !value)}
          aria-label={running ? 'Pause animation' : 'Play animation'}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={restartSimulation}>
          <RotateCcw size={15} />
          Restart
        </button>
        {[0.25, 0.5, 1].map((speed) => (
          <button
            key={speed}
            type="button"
            className={Math.abs(tuning.motionSpeed - speed) < 0.001 ? styles.activeButton : ''}
            onClick={() => updateTuning('motionSpeed', speed)}
          >
            {speed}×
          </button>
        ))}
        <span className={styles.transportStatus}>
          <i data-running={active ? 'true' : 'false'} />
          {manualMode ? `Fixed ${manualTime.toFixed(1)}s` : sceneStatus}
        </span>
      </div>

      <button
        type="button"
        className={styles.panelToggle}
        onClick={() => setPanelOpen((value) => !value)}
        aria-label={panelOpen ? 'Close controls' : 'Open controls'}
      >
        {panelOpen ? <ChevronRight size={18} /> : <SlidersHorizontal size={18} />}
      </button>

      <aside className={styles.panel} aria-label="Black-hole controls">
        <header className={styles.panelHeader}>
          <div>
            <span>DEBUG CONSOLE</span>
            <strong>Material workstation</strong>
          </div>
          <Gauge size={19} />
        </header>

        <section className={styles.presetSection}>
          <span className={styles.sectionLabel}>Preset</span>
          <div className={styles.presetGrid}>
            {Object.entries(BLACK_HOLE_LAB_PRESETS).map(([key, preset]) => (
              <button
                type="button"
                key={key}
                data-active={presetKey === key ? 'true' : 'false'}
                onClick={() => applyPreset(key)}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {presetKey === 'custom' && (
            <p className={styles.customState}>Custom settings are active and saved locally.</p>
          )}
        </section>

        <ControlGroup title="Layer isolation" initialOpen>
          <div className={styles.layerGrid}>
            {Object.entries(LAYER_LABELS).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={(event) => updateLayer(key, event.target.checked)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </ControlGroup>

        {CONTROL_GROUPS.map((group, index) => (
          <ControlGroup title={group.title} initialOpen={index < 3} key={group.id}>
            <div className={styles.controlBody}>
              {group.controls.map((control) => (
                <RangeControl
                  key={control[0]}
                  control={control}
                  value={tuning[control[0]]}
                  onChange={updateTuning}
                />
              ))}
            </div>
          </ControlGroup>
        ))}

        <ControlGroup title="Gas color ramp">
          <div className={styles.colorGrid}>
            {[
              ['outerColor', 'Outer gas'],
              ['middleColor', 'Mid heat'],
              ['hotColor', 'Inner heat']
            ].map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="color"
                  value={tuning[key]}
                  onChange={(event) => updateTuning(key, event.target.value)}
                />
              </label>
            ))}
          </div>
        </ControlGroup>

        <ControlGroup title="Time inspection" initialOpen>
          <div className={styles.controlBody}>
            <label className={styles.inlineToggle}>
              <input
                type="checkbox"
                checked={manualMode}
                onChange={(event) => setManualMode(event.target.checked)}
              />
              <span>Fixed shader time</span>
            </label>
            <label className={styles.rangeControl}>
              <span className={styles.controlHeading}>
                <span>Timeline</span>
                <output>{manualTime.toFixed(1)}s</output>
              </span>
              <input
                type="range"
                min="0"
                max="120"
                step="0.1"
                value={manualTime}
                disabled={!manualMode}
                onChange={(event) => setManualTime(Number(event.target.value))}
              />
            </label>
          </div>
        </ControlGroup>

        <ControlGroup title="Diagnostic view" initialOpen>
          <div className={styles.controlBody}>
            <select
              value={debugView}
              onChange={(event) => setDebugView(Number(event.target.value))}
            >
              {DEBUG_VIEWS.map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>
        </ControlGroup>

        <ControlGroup title="Performance" initialOpen>
          <div className={styles.diagnostics}>
            <DiagnosticItem
              label="FPS"
              value={diagnostics ? diagnostics.fps.toFixed(1) : '—'}
              accent
            />
            <DiagnosticItem
              label="Frame"
              value={diagnostics ? `${diagnostics.frameTime.toFixed(2)} ms` : '—'}
            />
            <DiagnosticItem label="Buffer" value={diagnostics?.bufferSize || '—'} />
            <DiagnosticItem label="Draw calls" value={diagnostics?.drawCalls ?? '—'} />
            <DiagnosticItem label="Triangles" value={diagnostics?.triangles ?? '—'} />
            <DiagnosticItem label="Programs" value={diagnostics?.programs ?? '—'} />
            <DiagnosticItem label="Textures" value={diagnostics?.textures ?? '—'} />
            <DiagnosticItem label="Context" value={diagnostics?.context || sceneStatus} />
          </div>
        </ControlGroup>

        <ControlGroup title="Import / export">
          <div className={styles.controlBody}>
            <textarea
              value={jsonDraft}
              onChange={(event) => setJsonDraft(event.target.value)}
              placeholder="Exported preset JSON appears here."
              spellCheck="false"
            />
            <div className={styles.jsonActions}>
              <button type="button" onClick={exportConfig}>
                <Clipboard size={14} />
                Copy JSON
              </button>
              <button type="button" onClick={importConfig}>Import JSON</button>
            </div>
          </div>
        </ControlGroup>
      </aside>

      <div className={styles.legend}>
        <span>Gas-development workspace</span>
        <strong>{BLACK_HOLE_LAB_PRESETS.gas.description}</strong>
      </div>

      {notice && <div className={styles.notice} role="status">{notice}</div>}
    </main>
  )
}
