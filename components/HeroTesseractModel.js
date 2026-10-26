import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export const HERO_TESSERACT_THEME = Object.freeze({
  outer: '#00D9FF', secondary: '#0099FF', inner: '#0055FF', core: '#00FFFF',
  ringA: '#00E5FF', ringB: '#0099FF', ringC: '#00FFDD'
})

function EdgeOverlay({ scale = 1, color = '#00E5FF', materialRef }) {
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(boxGeometry), [boxGeometry])
  useEffect(() => () => {
    boxGeometry.dispose()
    edgeGeometry.dispose()
  }, [boxGeometry, edgeGeometry])
  return <lineSegments geometry={edgeGeometry} scale={scale}>
    <lineBasicMaterial ref={materialRef} color={color} transparent opacity={0.9}
      blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
  </lineSegments>
}

// This is the Hero's original model, shared by both scenes. Geometry, material
// settings, child hierarchy and mutable refs remain the same in the Hero.
export default function HeroTesseractModel({ theme = HERO_TESSERACT_THEME, hovered = false, modelRefs = {} }) {
  const {
    outerCubeRef, middleCubeRef, innerCubeRef, innerGroupRef, coreRef,
    ringARef, ringBRef, ringCRef, pulseRef,
    outerMaterialRef, middleMaterialRef, innerMaterialRef, coreMaterialRef,
    ringAMaterialRef, ringBMaterialRef, ringCMaterialRef,
    outerEdgeMaterialRef, middleEdgeMaterialRef, innerEdgeMaterialRef
  } = modelRefs

  return <>
    <mesh ref={outerCubeRef} scale={3.5}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial ref={outerMaterialRef} color={theme.outer} emissive={theme.outer}
        emissiveIntensity={hovered ? 2.75 : 2.0} metalness={0.3} roughness={0.1}
        transparent opacity={0.22} depthWrite={false} />
      <EdgeOverlay scale={1.08} color={theme.ringA} materialRef={outerEdgeMaterialRef} />
    </mesh>

    <mesh ref={middleCubeRef} scale={2.4}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial ref={middleMaterialRef} color={theme.secondary} emissive={theme.secondary}
        emissiveIntensity={hovered ? 2.45 : 1.8} metalness={0.3} roughness={0.1}
        transparent opacity={0.18} depthWrite={false} />
      <EdgeOverlay scale={1.06} color={theme.secondary} materialRef={middleEdgeMaterialRef} />
    </mesh>

    <group ref={innerGroupRef}>
      <mesh ref={innerCubeRef} scale={1.5}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial ref={innerMaterialRef} color={theme.inner} emissive={theme.inner}
          emissiveIntensity={hovered ? 2.65 : 1.9} metalness={0.4} roughness={0.08}
          transparent opacity={0.16} depthWrite={false} />
        <EdgeOverlay scale={1.1} color={theme.ringA} materialRef={innerEdgeMaterialRef} />
      </mesh>

      <mesh ref={coreRef} scale={0.3}>
        <icosahedronGeometry args={[1, 5]} />
        <meshStandardMaterial ref={coreMaterialRef} color={theme.core} emissive={theme.core}
          emissiveIntensity={hovered ? 5.2 : 3.5} transparent opacity={0.45} />
      </mesh>

      <mesh scale={0.5}>
        <torusGeometry args={[1, 0.08, 16, 100]} />
        <meshStandardMaterial color={theme.ringA} emissive={theme.ringA}
          emissiveIntensity={hovered ? 3.2 : 2.2} transparent opacity={0.55} />
      </mesh>
      <mesh scale={0.35} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1, 0.06, 16, 100]} />
        <meshStandardMaterial color={theme.ringB} emissive={theme.ringB}
          emissiveIntensity={hovered ? 2.9 : 2.0} transparent opacity={0.5} />
      </mesh>
    </group>

    <mesh ref={ringARef} scale={1} rotation={[0, 0, 0]}>
      <torusGeometry args={[4, 0.25, 32, 100]} />
      <meshStandardMaterial ref={ringAMaterialRef} color={theme.ringA} emissive={theme.ringA}
        emissiveIntensity={hovered ? 3.7 : 2.8} metalness={0.3} roughness={0.4}
        transparent opacity={0.75} wireframe={false} />
    </mesh>
    <mesh ref={ringBRef} scale={1} rotation={[Math.PI / 2.5, 0, 0]}>
      <torusGeometry args={[4.5, 0.22, 32, 100]} />
      <meshStandardMaterial ref={ringBMaterialRef} color={theme.ringB} emissive={theme.ringB}
        emissiveIntensity={hovered ? 3.2 : 2.4} metalness={0.3} roughness={0.5}
        transparent opacity={0.7} wireframe={false} />
    </mesh>
    <mesh ref={ringCRef} scale={1} rotation={[0, Math.PI / 3, 0]}>
      <torusGeometry args={[5, 0.2, 32, 100]} />
      <meshStandardMaterial ref={ringCMaterialRef} color={theme.ringC} emissive={theme.ringC}
        emissiveIntensity={hovered ? 3.0 : 2.2} metalness={0.3} roughness={0.6}
        transparent opacity={0.65} wireframe={false} />
    </mesh>

    <mesh ref={pulseRef} scale={1}>
      <sphereGeometry args={[2.2, 32, 32]} />
      <meshBasicMaterial color="#7DD3FC" transparent opacity={0}
        blending={THREE.AdditiveBlending} depthWrite={false} wireframe />
    </mesh>
  </>
}
