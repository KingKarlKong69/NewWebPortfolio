import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import styles from './SkillsSection.module.css'

const CHART_RADIUS = 2.22
const LEVELS = [0.2, 0.4, 0.6, 0.8, 1]

function pointsForItems(items, scale = 1) {
  return items.map((item, index) => {
    const angle = Math.PI / 2 - (index / items.length) * Math.PI * 2
    const radius = CHART_RADIUS * (item.value / 100) * scale
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
  })
}

function guidePoints(count, scale) {
  return Array.from({length: count}, (_, index) => {
    const angle = Math.PI / 2 - (index / count) * Math.PI * 2
    return new THREE.Vector3(Math.cos(angle) * CHART_RADIUS * scale, Math.sin(angle) * CHART_RADIUS * scale, -0.08)
  })
}

function GlowLine({ points, color = '#0fdfff', opacity = 0.28, closed = false, z = 0, gradient = false }) {
  const geometry = useMemo(() => {
    const linePoints = closed ? [...points, points[0]] : points
    const nextGeometry = new THREE.BufferGeometry().setFromPoints(linePoints)

    if (gradient) {
      const colors = linePoints.flatMap((point) => {
        const mix = THREE.MathUtils.clamp((point.x / CHART_RADIUS + 1) / 2, 0, 1)
        return new THREE.Color('#19f4ed').lerp(new THREE.Color('#7851ff'), mix).toArray()
      })
      nextGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    }

    return nextGeometry
  }, [points, closed])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <line geometry={geometry} position-z={z}>
      <lineBasicMaterial color={color} vertexColors={gradient} transparent opacity={opacity} depthWrite={false} />
    </line>
  )
}

function HologramFill({ points }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y)
      else shape.lineTo(point.x, point.y)
    })
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [points])

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <mesh geometry={geometry} position-z={-0.015}>
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        vertexShader={`varying vec2 vPosition; void main() { vPosition = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`varying vec2 vPosition; void main() { float gradient = smoothstep(-2.2, 2.2, vPosition.x); vec3 cyan = vec3(0.02, 0.95, 0.93); vec3 violet = vec3(0.37, 0.16, 1.0); float edgeLight = 0.06 * (1.0 - smoothstep(0.0, 2.4, length(vPosition))); gl_FragColor = vec4(mix(cyan, violet, gradient) + edgeLight, 0.22); }`}
      />
    </mesh>
  )
}

function RadarParticles() {
  const particleGeometry = useMemo(() => {
    const positions = []
    const colors = []

    for (let index = 0; index < 54; index += 1) {
      const angle = (index * 2.39996) + 0.35
      const radius = 1.08 + ((index * 37) % 100) / 100 * 1.55
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.12)

      const color = new THREE.Color(index % 5 === 0 ? '#7650ff' : '#23dff2')
      colors.push(...color.toArray())
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geometry
  }, [])

  useEffect(() => () => particleGeometry.dispose(), [particleGeometry])

  return (
    <points geometry={particleGeometry} position-z={-0.1}>
      <pointsMaterial size={0.035} sizeAttenuation transparent opacity={0.62} vertexColors depthWrite={false} />
    </points>
  )
}

function RadarScene({ items, active, reducedMotion, onHover }) {
  const [visibleItems, setVisibleItems] = useState(items)
  const rootRef = useRef(null)
  const polygonRef = useRef(null)
  const nodesRef = useRef([])
  const hoveredRef = useRef(-1)
  const currentItemsRef = useRef(items)
  const transitionRef = useRef({stage: 'idle', elapsed: 0, startScale: 1, targetItems: items})

  const dataPoints = useMemo(() => pointsForItems(visibleItems), [visibleItems])
  const radialAxes = useMemo(
    () => guidePoints(visibleItems.length, 1).map((point) => [new THREE.Vector3(0, 0, -0.08), point]),
    [visibleItems.length]
  )

  useEffect(() => {
    if (currentItemsRef.current === items) return

    if (reducedMotion) {
      currentItemsRef.current = items
      setVisibleItems(items)
      if (polygonRef.current) polygonRef.current.scale.setScalar(1)
      transitionRef.current = {stage: 'idle', elapsed: 0, startScale: 1, targetItems: items}
      return
    }

    const currentScale = polygonRef.current?.scale.x || 1
    transitionRef.current = {
      stage: 'out',
      elapsed: 0,
      startScale: currentScale,
      targetItems: items
    }
  }, [items, reducedMotion])

  useFrame((state, delta) => {
    if (!rootRef.current || !polygonRef.current) return

    if (active && !reducedMotion) {
      const targetX = state.pointer.y * 0.055
      const targetY = -state.pointer.x * 0.055
      rootRef.current.rotation.x = THREE.MathUtils.lerp(rootRef.current.rotation.x, targetX, 0.045)
      rootRef.current.rotation.y = THREE.MathUtils.lerp(rootRef.current.rotation.y, targetY, 0.045)
    }

    const transition = transitionRef.current
    if (transition.stage === 'out') {
      transition.elapsed += delta
      const progress = Math.min(transition.elapsed / 0.22, 1)
      const scale = THREE.MathUtils.lerp(transition.startScale, 0.04, progress * progress)
      polygonRef.current.scale.setScalar(scale)

      if (progress >= 1) {
        currentItemsRef.current = transition.targetItems
        setVisibleItems(transition.targetItems)
        transition.stage = 'in'
        transition.elapsed = 0
        polygonRef.current.scale.setScalar(0.04)
      }
    } else if (transition.stage === 'in') {
      transition.elapsed += delta
      const progress = Math.min(transition.elapsed / 0.52, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      polygonRef.current.scale.setScalar(THREE.MathUtils.lerp(0.04, 1, eased))
      if (progress >= 1) transition.stage = 'idle'
    }

    nodesRef.current.forEach((node, index) => {
      if (!node) return
      const hoverScale = hoveredRef.current === index ? 1.45 : 1
      const pulse = reducedMotion || !active ? 1 : 1 + Math.sin(state.clock.elapsedTime * 2.4 + index * 0.8) * 0.09
      node.scale.setScalar(THREE.MathUtils.lerp(node.scale.x, hoverScale * pulse, 0.12))
    })
  })

  const setHovered = (index) => {
    hoveredRef.current = index
    onHover(index >= 0 ? visibleItems[index] : null)
  }

  return (
    <group ref={rootRef}>
      <group position-z={-0.16}>
        <mesh>
          <circleGeometry args={[2.58, 96]} />
          <meshBasicMaterial color="#06131f" transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[2.58, 2.595, 96]} />
          <meshBasicMaterial color="#0a91ae" transparent opacity={0.34} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <mesh position-z={-0.02}>
          <ringGeometry args={[2.23, 2.242, 96]} />
          <meshBasicMaterial color="#126d89" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {[0.35, 0.7, 1.05, 1.4, 1.75].map((radius, index) => (
          <mesh key={`ring-${radius}`} position-z={-0.08}>
            <ringGeometry args={[radius, radius + 0.011, 96]} />
            <meshBasicMaterial color={index === 4 ? '#159bb9' : '#0d6c89'} transparent opacity={index === 4 ? 0.28 : 0.17} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        ))}
        {radialAxes.map((points, index) => (
          <GlowLine key={`axis-${visibleItems.length}-${index}`} points={points} opacity={0.13} z={-0.08} />
        ))}
        <RadarParticles />
      </group>

      <group ref={polygonRef}>
        <HologramFill points={dataPoints} />
        <GlowLine points={dataPoints} closed color="#1ff4ed" opacity={0.24} z={0.002} />
        <GlowLine points={dataPoints} closed opacity={0.96} z={0.03} gradient />
        {dataPoints.map((point, index) => (
          <group key={`${visibleItems[index].name}-${index}`} position={[point.x, point.y, 0.07]}>
            <mesh scale={1.9}>
              <circleGeometry args={[0.105, 24]} />
              <meshBasicMaterial color={point.x > 0 ? '#7b56ff' : '#16f1e8'} transparent opacity={0.18} depthWrite={false} />
            </mesh>
            <mesh
              ref={(node) => { nodesRef.current[index] = node }}
              onPointerOver={(event) => {
                event.stopPropagation()
                setHovered(index)
                document.body.style.cursor = 'crosshair'
              }}
              onPointerOut={() => {
                setHovered(-1)
                document.body.style.cursor = ''
              }}
            >
              <circleGeometry args={[0.075, 24]} />
              <meshBasicMaterial color={point.x > 0 ? '#8058ff' : '#3bf9eb'} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

    </group>
  )
}

function RadarFallback({ items }) {
  const points = items.map((item, index) => {
    const angle = Math.PI / 2 - (index / items.length) * Math.PI * 2
    const radius = 42 * (item.value / 100)
    return `${50 + Math.cos(angle) * radius},${50 - Math.sin(angle) * radius}`
  }).join(' ')

  const axes = items.map((_, index) => {
    const angle = Math.PI / 2 - (index / items.length) * Math.PI * 2
    return {x: 50 + Math.cos(angle) * 42, y: 50 - Math.sin(angle) * 42}
  })

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full p-6" aria-hidden="true">
      <defs>
        <linearGradient id="radarFill" x1="0" x2="1"><stop stopColor="#12e9df" stopOpacity="0.28" /><stop offset="1" stopColor="#744cff" stopOpacity="0.28" /></linearGradient>
        <linearGradient id="radarLine" x1="0" x2="1"><stop stopColor="#25f3e7" /><stop offset="1" stopColor="#7c50ff" /></linearGradient>
      </defs>
      {[10, 18, 26, 34, 42].map((radius) => <circle key={radius} cx="50" cy="50" r={radius} fill="none" stroke="rgba(24,174,206,0.2)" strokeWidth="0.45" />)}
      {axes.map((axis, index) => <line key={index} x1="50" y1="50" x2={axis.x} y2={axis.y} stroke="rgba(27,170,206,0.18)" strokeWidth="0.45" />)}
      {Array.from({length: 34}, (_, index) => <circle key={`particle-${index}`} cx={8 + (index * 29) % 84} cy={7 + (index * 47) % 86} r="0.45" fill={index % 5 === 0 ? '#7650ff' : '#23dff2'} opacity="0.68" />)}
      <polygon points={points} fill="url(#radarFill)" stroke="url(#radarLine)" strokeWidth="1.1" />
      {points.split(' ').map((point, index) => {
        const [cx, cy] = point.split(',')
        return <circle key={items[index].name} cx={cx} cy={cy} r="1.5" fill={index % 3 === 2 ? '#754dff' : '#35efff'} />
      })}
    </svg>
  )
}

export default function SkillsRadarChart({ category, active, reducedMotion, webglSupported }) {
  const [hoveredSkill, setHoveredSkill] = useState(null)
  const summary = `${category.label} radar chart with ${category.items.length} data points. Values are also listed beside the chart.`

  useEffect(() => () => {
    document.body.style.cursor = ''
  }, [])

  return (
    <div className={`${styles.radarShell} relative mx-auto aspect-square w-full max-w-[390px]`} role="img" aria-label={summary}>
      {webglSupported ? (
        <Canvas
          orthographic
          camera={{position: [0, 0, 8], zoom: 55}}
          dpr={[1, 1.5]}
          frameloop={active ? 'always' : 'demand'}
          gl={{alpha: true, antialias: true, powerPreference: 'high-performance'}}
          className="!bg-transparent"
          aria-hidden="true"
        >
          <RadarScene
            items={category.items}
            active={active}
            reducedMotion={reducedMotion}
            onHover={setHoveredSkill}
          />
        </Canvas>
      ) : (
        <RadarFallback items={category.items} />
      )}

      <div className="pointer-events-none absolute left-3 top-3 rounded border border-cyan-300/15 bg-black/55 px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-cyan-200/80">
        {hoveredSkill ? `${hoveredSkill.name} / ${hoveredSkill.value}%` : `${category.items.length} point matrix`}
      </div>
      <span className="sr-only" aria-live="polite">
        {hoveredSkill ? `${hoveredSkill.name}, ${hoveredSkill.value} percent` : ''}
      </span>
    </div>
  )
}
