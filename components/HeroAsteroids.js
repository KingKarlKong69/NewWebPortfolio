import { Canvas, useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { makeRockGeometry, makeRockMaterial } from './heroRockModel'
import ActiveFrameLoop from './ActiveFrameLoop'
import {
  HERO_DEBRIS_LIMIT,
  blastVisibleAsteroids,
  beginHeroAsteroidDrag,
  createHeroAsteroidSimulation,
  moveHeroAsteroidDrag,
  releaseHeroAsteroidDrag,
  stepHeroAsteroids
} from './heroAsteroidPhysics'

function AsteroidScene({ simulation, active, reducedMotion, rootRef, targetRefs, onStatus }) {
  const rockRefs = useRef([])
  const debrisRef = useRef(null)
  const announcedStateRef = useRef(null)
  const geometryBank = useMemo(() => Array.from({length: simulation.geometryFormCount}, (_, index) =>
    makeRockGeometry(simulation.seed + index * 5.2, simulation.mobile ? 4 : 5)
  ), [simulation])
  const fragmentGeometry = useMemo(() => makeRockGeometry(72, 1), [])
  const material = useMemo(makeRockMaterial, [])
  const transform = useMemo(() => new THREE.Object3D(), [])
  const { width, height } = simulation

  useEffect(() => () => {
    geometryBank.forEach(geometry => geometry.dispose())
  }, [geometryBank])
  useEffect(() => () => { fragmentGeometry.dispose(); material.dispose() }, [fragmentGeometry, material])

  useFrame((_, delta) => {
    if (active) stepHeroAsteroids(simulation, delta, reducedMotion)
    const previous = announcedStateRef.current
    if (previous?.simulation === simulation) {
      const crushed = simulation.bodies.filter(body => previous.active[body.id] && !body.active && body.retiredReason === 'crushed')
      const arrivals = simulation.bodies.filter(body => previous.generations[body.id] !== body.generation)
      const describe = bodies => `${simulation.foreground ? 'Foreground asteroid' : 'Asteroid'}${bodies.length > 1 ? 's' : ''} ${bodies.map(body => body.id + 1).join(', ')}`
      const messages = []
      if (crushed.length) messages.push(`${describe(crushed)} crushed into debris.`)
      if (arrivals.length) messages.push(`${arrivals.length > 1 ? 'New asteroids are' : 'A new asteroid is'} drifting in from beyond the viewport.`)
      if (messages.length) onStatus(messages.join(' '))
    }
    announcedStateRef.current = {simulation, active: simulation.bodies.map(body => body.active), generations: simulation.bodies.map(body => body.generation)}
    for (const body of simulation.bodies) {
      const mesh = rockRefs.current[body.id]
      const target = targetRefs.current[body.id]
      if (mesh) {
        mesh.geometry = geometryBank[body.geometryForm]
        mesh.visible = body.active
        mesh.position.set(body.x - width / 2, height / 2 - body.y, body.depth * 12)
        mesh.rotation.set(...body.rotation)
        mesh.scale.set(...body.shape.map(axis => axis * body.visualRadius))
      }
      if (target) {
        target.style.width = `${body.visualRadius * 2}px`
        target.style.height = `${body.visualRadius * 2}px`
        target.style.transform = `translate3d(${body.x - body.visualRadius}px,${body.y - body.visualRadius}px,0)`
        target.style.visibility = body.active ? 'visible' : 'hidden'
        target.dataset.asteroidX = body.x.toFixed(1)
        target.dataset.asteroidY = body.y.toFixed(1)
        target.dataset.asteroidRadius = body.radius.toFixed(1)
        target.dataset.asteroidIdentity = body.identity
        target.dataset.asteroidGeneration = String(body.generation)
        target.dataset.asteroidForm = String(body.geometryForm)
        target.dataset.asteroidSpeed = Math.hypot(body.vx, body.vy).toFixed(1)
        target.dataset.asteroidState = body.grabbed ? 'dragging' : body.active ? 'drifting' : body.retiredReason === 'crushed' ? 'crushed' : 'offscreen'
      }
    }
    if (debrisRef.current) {
      for (let index = 0; index < HERO_DEBRIS_LIMIT; index += 1) {
        const fragment = simulation.debris[index]
        if (fragment) {
          const life = (simulation.time - fragment.born) / fragment.life
          const shrink = Math.min(1, (1 - life) * 3)
          transform.position.set(fragment.x - width / 2, height / 2 - fragment.y, index % 3)
          transform.rotation.set(fragment.angle, fragment.angle * 0.7, fragment.angle * 0.4)
          transform.scale.setScalar(fragment.radius * shrink)
        } else transform.scale.setScalar(0)
        transform.updateMatrix()
        debrisRef.current.setMatrixAt(index, transform.matrix)
      }
      debrisRef.current.instanceMatrix.needsUpdate = true
    }
    if (rootRef.current) {
      rootRef.current.dataset.heroAsteroidCrushCount = String(simulation.crushCount)
      rootRef.current.dataset.heroAsteroidDragging = simulation.drag ? String(simulation.drag.id) : 'none'
      rootRef.current.dataset.heroAsteroidDebris = String(simulation.debris.length)
      rootRef.current.dataset.heroAsteroidArrivals = String(simulation.arrivalCount)
      rootRef.current.dataset.heroAsteroidActiveCount = String(simulation.bodies.filter(body => body.active).length)
    }
  })

  return <>
    <ActiveFrameLoop active={active} />
    <ambientLight intensity={0.75} color="#86929d" />
    <hemisphereLight args={['#c0cbd7', '#20151d', 0.85]} />
    <directionalLight position={[-4, 5, 8]} intensity={3.1} color="#e6dfe2" />
    <directionalLight position={[6, -1, 3]} intensity={0.85} color="#47c9ff" />
    <directionalLight position={[-4, -3, 2]} intensity={0.42} color="#e36bba" />
    {simulation.bodies.map((body, index) => <mesh key={body.id} ref={mesh => { rockRefs.current[index] = mesh }} geometry={geometryBank[body.geometryForm]} material={material} frustumCulled={false} />)}
    <instancedMesh ref={debrisRef} args={[fragmentGeometry, material, HERO_DEBRIS_LIMIT]} frustumCulled={false} />
  </>
}

/**
 * Mount background below the portrait and foreground above it. Each instance
 * fills its relative parent. Only rock-sized hit targets receive pointer events;
 * the transparent WebGL canvas never covers navigation, links or empty space.
 */
export default function HeroAsteroids({ layer = 'background', className = '', interactive = true, enabled = true, footer=false,count,sizeScale=1,speedScale=1 }) {
  const foreground = layer === 'foreground'
  const rootRef = useRef(null)
  const targetRefs = useRef([])
  const invalidateRef = useRef(null)
  const captureRef = useRef(null)
  const interactionTimerRef = useRef(null)
  const [dimensions, setDimensions] = useState(null)
  const [inView, setInView] = useState(true)
  const [pageVisible, setPageVisible] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [status, setStatus] = useState('')
  const simulation = useMemo(() => dimensions ? createHeroAsteroidSimulation(dimensions.width, dimensions.height, foreground,{rareForegroundChance:footer ? .05 : 0,count,sizeScale,speedScale,seed:footer?(foreground?67:42):9.8}) : null, [dimensions, foreground,footer,count,sizeScale,speedScale])
  const active = enabled && inView && pageVisible && (!reducedMotion || interacting)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const resize = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      const width = Math.max(1, Math.round(rect.width))
      const height = Math.max(1, Math.round(rect.height))
      setDimensions(previous => previous?.width === width && previous?.height === height ? previous : {width, height})
    })
    const hero = root.closest('#home')
    const updateInView = () => {
      const rect = root.getBoundingClientRect()
      setInView(hero?.dataset.aboutCovered !== 'true' && rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth)
    }
    // A sticky Hero continues intersecting behind About. Always combine its
    // fresh coverage flag and bounds instead of trusting queued IO entries.
    const observer = new IntersectionObserver(updateInView, {threshold: 0.01})
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const preferenceChanged = () => setReducedMotion(media.matches)
    const visibilityChanged = () => {
      setPageVisible(document.visibilityState === 'visible')
      updateInView()
    }
    resize.observe(root)
    observer.observe(root)
    preferenceChanged()
    visibilityChanged()
    media.addEventListener('change', preferenceChanged)
    document.addEventListener('visibilitychange', visibilityChanged)
    hero?.addEventListener('hero:scene-visibility', updateInView)
    window.addEventListener('resize', updateInView, {passive: true})
    return () => {
      resize.disconnect()
      observer.disconnect()
      media.removeEventListener('change', preferenceChanged)
      document.removeEventListener('visibilitychange', visibilityChanged)
      hero?.removeEventListener('hero:scene-visibility', updateInView)
      window.removeEventListener('resize', updateInView)
      clearTimeout(interactionTimerRef.current)
    }
  }, [])

  const finishDrag = useCallback((preserveVelocity = true) => {
    if (simulation) releaseHeroAsteroidDrag(simulation, preserveVelocity)
    const capture = captureRef.current
    captureRef.current = null
    if (capture) capture.element.style.cursor = ''
    if (capture?.element.hasPointerCapture(capture.id)) capture.element.releasePointerCapture(capture.id)
    invalidateRef.current?.()
  }, [simulation])

  useEffect(() => {
    if (!inView || !pageVisible) {
      finishDrag(false)
      clearTimeout(interactionTimerRef.current)
      setInteracting(false)
    }
    invalidateRef.current?.()
  }, [finishDrag, inView, pageVisible, reducedMotion, interacting])

  useEffect(() => {
    // Switching windows can leave a tab visible while releasing the mouse in a
    // different app. Treat loss of window focus as cancellation in that case.
    const cancel = () => finishDrag(false)
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [finishDrag])

  useEffect(() => () => {
    if (simulation) releaseHeroAsteroidDrag(simulation, false)
    const capture = captureRef.current
    if (capture) capture.element.style.cursor = ''
    if (capture?.element.hasPointerCapture(capture.id)) capture.element.releasePointerCapture(capture.id)
    captureRef.current = null
  }, [simulation])

  const wake = useCallback(() => {
    setInteracting(true)
    clearTimeout(interactionTimerRef.current)
    interactionTimerRef.current = setTimeout(() => setInteracting(false), 9500)
    invalidateRef.current?.()
  }, [])
  useEffect(()=>{
    if(!footer||!simulation)return
    const blast=()=>{blastVisibleAsteroids(simulation);wake()}
    window.addEventListener('contact:blast',blast)
    return()=>window.removeEventListener('contact:blast',blast)
  },[footer,simulation,wake])

  const localPoint = event => {
    const rect = rootRef.current.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  const canInteract = () => interactive && enabled && inView && pageVisible && rootRef.current?.closest('#home')?.dataset.aboutCovered !== 'true'

  return <div
    ref={rootRef}
    className={`hero-asteroids hero-asteroids--${layer} ${className}`}
    data-hero-asteroid-layer={layer}
    data-hero-asteroid-animation={active ? 'running' : reducedMotion && !interacting ? 'reduced-motion' : 'paused'}
    data-hero-asteroid-crush-count="0"
    aria-hidden={interactive ? undefined : true}
  >
    {simulation?.bodies.length > 0 && <>
      <div className="hero-asteroids-render" aria-hidden="true" style={{filter: foreground ? `blur(${simulation.mobile ? Math.min(8, Math.max(3, simulation.width * 0.0075)) : 3.5}px)` : undefined}}>
        <Canvas
          orthographic
          camera={{position: [0, 0, 1800], zoom: 1, near: 0.1, far: 4000}}
          gl={{alpha: true, antialias: true, powerPreference: 'low-power'}}
          dpr={simulation.mobile ? [1, 1.35] : [1, 1.4]}
          frameloop="demand"
          style={{pointerEvents: 'none'}}
          onCreated={({gl, invalidate}) => {
            invalidateRef.current = invalidate
            gl.setClearColor(0x000000, 0)
          }}
        >
          <AsteroidScene simulation={simulation} active={active} reducedMotion={reducedMotion} rootRef={rootRef} targetRefs={targetRefs} onStatus={setStatus} />
        </Canvas>
      </div>
      {interactive && simulation.bodies.map(body => <button
        key={body.id}
        ref={target => { targetRefs.current[body.id] = target }}
        type="button"
        className="hero-asteroid-target"
        aria-label={`${foreground ? 'Foreground a' : 'A'}steroid ${body.id + 1}. Drag to move, or use arrow keys. Throw into another asteroid to break it.`}
        data-hero-asteroid-id={body.id}
        style={{width: body.visualRadius * 2, height: body.visualRadius * 2}}
        onPointerDown={event => {
          if (!canInteract()) return
          if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
          const [x, y] = localPoint(event)
          if (!beginHeroAsteroidDrag(simulation, body.id, x, y)) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          captureRef.current = {element: event.currentTarget, id: event.pointerId}
          event.currentTarget.style.cursor = 'grabbing'
          wake()
        }}
        onPointerMove={event => {
          if (!canInteract()) { finishDrag(false); return }
          if (captureRef.current?.id !== event.pointerId) return
          if (event.pointerType === 'mouse' && event.buttons === 0) {
            finishDrag(false)
            return
          }
          const [x, y] = localPoint(event)
          moveHeroAsteroidDrag(simulation, x, y)
          wake()
        }}
        onPointerUp={event => {
          if (!canInteract()) { finishDrag(false); return }
          if (captureRef.current?.id !== event.pointerId) return
          finishDrag()
          event.currentTarget.style.cursor = ''
          wake()
        }}
        onPointerCancel={event => {
          if (captureRef.current?.id !== event.pointerId) return
          finishDrag(false)
          event.currentTarget.style.cursor = ''
        }}
        onLostPointerCapture={event => {
          if (captureRef.current?.id === event.pointerId) finishDrag(false)
          event.currentTarget.style.cursor = ''
        }}
        onKeyDown={event => {
          if (!canInteract()) return
          const directions = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}
          const direction = directions[event.key]
          if (!direction || !body.active) return
          event.preventDefault()
          const speed = event.shiftKey ? 900 : 240
          body.vx = direction[0] * speed
          body.vy = direction[1] * speed
          body.userEnergyUntil = simulation.time + 1.5
          simulation.interactionUntil = simulation.time + 9
          wake()
        }}
      />)}
    </>}
    <span className="hero-asteroid-status" role="status" aria-live="polite" aria-atomic="true">{status}</span>
    <style jsx>{`
      .hero-asteroids { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .hero-asteroids-render { position: absolute; inset: 0; pointer-events: none; }
      .hero-asteroid-status { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
      .hero-asteroid-target { position: absolute; top: 0; left: 0; margin: 0; padding: 0; border: 0; border-radius: 50%; background: transparent; pointer-events: auto; cursor: grab; touch-action: none; -webkit-tap-highlight-color: transparent; clip-path: circle(42%); }
      .hero-asteroid-target:focus { outline: none; }
      .hero-asteroid-target:focus-visible { outline: 2px solid #5bdcff; outline-offset: -12px; background: rgba(47, 192, 238, 0.06); }
    `}</style>
  </div>
}
