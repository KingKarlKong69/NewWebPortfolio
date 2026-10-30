import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import {
  advanceBackdropTransition,
  backdropLayerOpacities,
  createBackdropTransition,
  retargetBackdropTransition,
} from './journeyBackdropTransition'
import styles from './JourneyScene.module.css'

const optimizedSource = source => `/_next/image?url=${encodeURIComponent(source)}&w=1080&q=80`

function decodePhoto(url) {
  return new Promise((resolve, reject) => {
    const photo = new window.Image()
    photo.decoding = 'async'
    photo.onload = () => {
      // A successful load remains usable in browsers whose decode() rejects
      // a cached image. Network errors still take the original-photo fallback.
      const decoded = typeof photo.decode === 'function' ? photo.decode().catch(() => {}) : Promise.resolve()
      decoded.then(() => resolve(url))
    }
    photo.onerror = () => reject(new Error('Memory photograph could not load'))
    photo.src = url
  })
}

export default function JourneyMemoryBackdrop({ source }) {
  const filterId = `memory-channels-${useId().replace(/:/g, '')}`
  const transitionRef = useRef(createBackdropTransition())
  const decodedRef = useRef(new Map())
  const nodesRef = useRef(new Map())
  const frameRef = useRef(0)
  const mountedRef = useRef(false)
  const drawRef = useRef(null)
  const [layers, setLayers] = useState([])
  const [displayed, setDisplayed] = useState(null)

  const synchronizeLayers = () => {
    const next = transitionRef.current.layers.map(layer => ({ source: layer.source, url: decodedRef.current.get(layer.source)?.url }))
    setLayers(current => current.length === next.length && current.every((layer, index) => layer.source === next[index].source && layer.url === next[index].url) ? current : next)
  }

  drawRef.current = now => {
    frameRef.current = 0
    if (!mountedRef.current) return
    const transition = advanceBackdropTransition(transitionRef.current, now)
    const opacities = backdropLayerOpacities(transition)
    transition.layers.forEach((layer, index) => {
      const node = nodesRef.current.get(layer.source)
      if (node) node.style.opacity = String(opacities[index])
    })
    if (transition.moving) frameRef.current = requestAnimationFrame(time => drawRef.current(time))
    else synchronizeLayers()
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [])

  useEffect(() => {
    if (!source) return undefined
    let stale = false
    let entry = decodedRef.current.get(source)
    if (!entry) {
      entry = { url: null, promise: null }
      entry.promise = decodePhoto(optimizedSource(source))
        .catch(() => decodePhoto(source))
        .then(url => { entry.url = url; return url })
      decodedRef.current.set(source, entry)
    }
    entry.promise.then(() => {
      if (stale || !mountedRef.current) return
      const now = performance.now()
      retargetBackdropTransition(transitionRef.current, source, now)
      setDisplayed(source)
      synchronizeLayers()
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      drawRef.current(now)
    }).catch(() => {
      // Keep the last decoded front photo. A later source can still load and
      // fade immediately; failed images never lock a shared busy flag.
      if (decodedRef.current.get(source) === entry) decodedRef.current.delete(source)
    })
    return () => { stale = true }
  }, [source])

  useLayoutEffect(() => {
    // Newly mounted cached photographs receive their exact current opacity
    // before paint, including a reversal during an unfinished crossfade.
    const transition = transitionRef.current
    const opacities = backdropLayerOpacities(transition)
    transition.layers.forEach((layer, index) => {
      const node = nodesRef.current.get(layer.source)
      if (node) node.style.opacity = String(opacities[index])
    })
  }, [layers])

  return <div className={styles.memoryBackdrop} aria-hidden="true" data-memory-backdrop data-backdrop-requested={source} data-backdrop-current={displayed || ''}>
    <svg className={styles.backdropFilters} width="0" height="0" focusable="false" aria-hidden="true">
      <defs>
        {/* Separate actual image channels: a shadow around an opaque photograph
            cannot produce the colored tearing inside its silhouette. */}
        <filter id={`${filterId}-red`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
        <filter id={`${filterId}-cyan`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
        <filter id={`${filterId}-magenta`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
      </defs>
    </svg>
    {layers.map(layer => <div
      key={layer.source}
      ref={node => { if (node) nodesRef.current.set(layer.source, node); else nodesRef.current.delete(layer.source) }}
      className={styles.backdropPhoto}
      data-backdrop-source={layer.source}
      data-backdrop-active={String(layer.source === displayed)}
      style={{ opacity: 0, transition: 'none' }}
    >
      <img className={styles.backdropBase} src={layer.url} alt="" draggable={false} decoding="async" />
      <div className={styles.backdropChannels}>
        <img className={styles.backdropRed} src={layer.url} alt="" draggable={false} decoding="async" style={{ filter: `url(#${filterId}-red)` }} />
        <img className={styles.backdropCyan} src={layer.url} alt="" draggable={false} decoding="async" style={{ filter: `url(#${filterId}-cyan)` }} />
        <img className={styles.backdropMagenta} src={layer.url} alt="" draggable={false} decoding="async" style={{ filter: `url(#${filterId}-magenta)` }} />
      </div>
    </div>)}
    <div className={styles.backdropScanlines} />
    <div className={styles.backdropShade} />
  </div>
}
