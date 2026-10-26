import {useFrame, useThree} from '@react-three/fiber'
import {useEffect, useMemo, useRef} from 'react'
import * as THREE from 'three'
import {LAB_CONTROLS} from './blackHoleLabControls'
import {createHybridDiskGeometry,createHybridGasSheetGeometry,createHybridArcGeometry} from './hybridDiskGeometry'
import {advanceBlackHoleMaterialPhases} from './blackHoleMotion'
import {contactEntranceTransform} from './contactEntranceMotion'
import {createHybridBlackHoleUniforms} from './hybridBlackHoleUniforms'
import {
  HYBRID_ARC_FRAGMENT, HYBRID_ARC_VERTEX,
  HYBRID_CORE_FRAGMENT, HYBRID_CORE_VERTEX,
  HYBRID_DISK_FRAGMENT, HYBRID_DISK_VERTEX,
  HYBRID_DUST_FRAGMENT, HYBRID_DUST_VERTEX,
  HYBRID_HALO_FRAGMENT, HYBRID_HALO_VERTEX
} from './hybridBlackHoleShaders'

const uniformName = key => `u${key[0].toUpperCase()}${key.slice(1)}`
const finite = (value, fallback) => Number.isFinite(value) ? value : fallback

// Parent advances its clock/layout at priority -10. Geometry consumes it at -5;
// negative frame priorities preserve R3F's normal render-loop ownership.
export default function HybridBlackHole({valuesRef, simulationRef, layoutRef}) {
  const {viewport, size,gl,camera} = useThree()
  const root = useRef(null)
  const disk = useRef(null)
  const core = useRef(null)
  const upperArc = useRef(null)
  const lowerArc = useRef(null)
  const phases = useRef({lastFlow:0, disk:0, upper:0, lower:0})
  const resourceEpoch = useRef(0)
  const resources = useMemo(() => {
    const {uniforms, diskUniforms, upperUniforms, lowerUniforms} = createHybridBlackHoleUniforms(LAB_CONTROLS)
    // Keep far gas behind the lensed images and near gas in front. Both halves
    // retain actual core depth testing; no transparent slab covers a rear arc.
    const farDiskGeometry = createHybridDiskGeometry(96, 32, 0, Math.PI)
    const diskGeometry = createHybridDiskGeometry(96, 32, Math.PI, Math.PI)
    const arcGeometry = createHybridArcGeometry()
    const haloGeometry = new THREE.PlaneGeometry(5.6, 5.6)
    const coreGeometry = new THREE.SphereGeometry(1, 96, 64)
    const farGasGeometry=createHybridGasSheetGeometry(64, 24, 0, Math.PI)
    const gasGeometry=createHybridGasSheetGeometry(64, 24, Math.PI, Math.PI)
    const gasMaterials=[-1.2,-.4,.4,1.2].map(height=>new THREE.ShaderMaterial({
      uniforms:{...diskUniforms,uGasLayer:{value:height},uGasWeight:{value:.15}},
      vertexShader:HYBRID_DISK_VERTEX,fragmentShader:HYBRID_DISK_FRAGMENT,
      transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
      blending:THREE.NormalBlending,toneMapped:false,forceSinglePass:true
    }))
    const dustGeometry=new THREE.BufferGeometry()
    const positions=[],radial=[],heights=[]
    const random=seed=>{const x=Math.sin(seed*127.1+311.7)*43758.5453;return x-Math.floor(x)}
    for(let index=0;index<1536;index++){
      const angle=random(index*3+41)*Math.PI*2
      positions.push(Math.cos(angle),Math.sin(angle),0)
      radial.push(random(index*3+42));heights.push(random(index*3+43)-.5)
    }
    dustGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
    dustGeometry.setAttribute('aRadial',new THREE.Float32BufferAttribute(radial,1))
    dustGeometry.setAttribute('aHeight',new THREE.Float32BufferAttribute(heights,1))
    const makeDustMaterial = sign => new THREE.ShaderMaterial({
      uniforms:{...diskUniforms,uDiskSide:{value:sign}},vertexShader:HYBRID_DUST_VERTEX,
      fragmentShader:HYBRID_DUST_FRAGMENT,transparent:true,depthWrite:false,depthTest:true,
      blending:THREE.AdditiveBlending,toneMapped:false})
    const dustMaterial = makeDustMaterial(-1)
    const farDustMaterial = makeDustMaterial(1)
    const diskMaterial = new THREE.ShaderMaterial({
      uniforms:diskUniforms, vertexShader:HYBRID_DISK_VERTEX, fragmentShader:HYBRID_DISK_FRAGMENT,
      transparent:true, depthWrite:false, depthTest:true, side:THREE.FrontSide,
      toneMapped:false, extensions:{derivatives:true}
    })
    const makeArcMaterial = arcValues => new THREE.ShaderMaterial({
      uniforms:arcValues, vertexShader:HYBRID_ARC_VERTEX, fragmentShader:HYBRID_ARC_FRAGMENT,
      transparent:true, depthWrite:false, depthTest:true, side:THREE.DoubleSide,
      forceSinglePass:true, toneMapped:false, extensions:{derivatives:true}
    })
    const upperMaterial = makeArcMaterial(upperUniforms)
    const lowerMaterial = makeArcMaterial(lowerUniforms)
    const haloMaterial = new THREE.ShaderMaterial({
      uniforms, vertexShader:HYBRID_HALO_VERTEX, fragmentShader:HYBRID_HALO_FRAGMENT,
      transparent:true, depthWrite:false, depthTest:true, toneMapped:false
    })
    const coreMaterial = new THREE.ShaderMaterial({
      uniforms, vertexShader:HYBRID_CORE_VERTEX, fragmentShader:HYBRID_CORE_FRAGMENT,
      transparent:false, depthWrite:true, depthTest:true, toneMapped:false
    })
    return {uniforms, diskUniforms, upperUniforms, lowerUniforms,
      diskGeometry,farDiskGeometry,gasGeometry,farGasGeometry,gasMaterials,dustGeometry,dustMaterial,farDustMaterial,
      arcGeometry, haloGeometry, coreGeometry, diskMaterial, upperMaterial,
      lowerMaterial, haloMaterial, coreMaterial}
  }, [])

  useEffect(() => {
    resourceEpoch.current++
    return () => {
      const epoch = ++resourceEpoch.current
      queueMicrotask(() => {
        if (resourceEpoch.current !== epoch) return
        for (const key of ['diskGeometry','farDiskGeometry','gasGeometry','farGasGeometry',
          'dustGeometry','dustMaterial','farDustMaterial',
          'arcGeometry','haloGeometry','coreGeometry','diskMaterial','upperMaterial',
          'lowerMaterial','haloMaterial','coreMaterial']) {
          resources[key].dispose()
        }
        resources.gasMaterials.forEach(material=>material.dispose())
      })
    }
  }, [resources])

  useFrame(() => {
    const values = valuesRef?.current || {}
    const layout = layoutRef?.current || {}
    const motion = simulationRef?.current || {}
    for (const control of LAB_CONTROLS) {
      const target = resources.uniforms[uniformName(control.key)]
      target.value = Math.min(control.max, Math.max(control.min, finite(values[control.key], control.defaultValue)))
    }
    const radius = resources.uniforms.uCoreRadius.value
    const extent = resources.uniforms.uDiskExtent.value
    advanceBlackHoleMaterialPhases(phases.current, finite(motion.flow, 0), values)
    resources.diskUniforms.uMaterialFlowPhase.value = phases.current.disk
    resources.upperUniforms.uMaterialFlowPhase.value = phases.current.upper
    resources.lowerUniforms.uMaterialFlowPhase.value = phases.current.lower
    resources.uniforms.uTurbulencePhase.value = finite(motion.turbulence, 0)
    resources.uniforms.uArrival.value = Math.min(1, Math.max(0, finite(layout.arrival, 1)))
    if(layout.entrance)resources.uniforms.uExposure.value*=layout.entrance.flash
    resources.uniforms.uInnerRadius.value = Math.max(radius * 1.08, .55)
    resources.uniforms.uOuterRadius.value = Math.max(resources.uniforms.uInnerRadius.value + .2, 2.15 * extent)
    resources.uniforms.uDiskThickness.value = Math.min(.6, Math.max(.02, finite(values.diskThickness, .12)))
    resources.uniforms.uDiskDensity.value = Math.min(3, Math.max(.05, finite(values.diskDensity, 1)))
    resources.uniforms.uPixelRatio.value=gl.getPixelRatio()
    if (upperArc.current) upperArc.current.visible = resources.uniforms.uUpperBrightness.value > 0
    if (lowerArc.current) lowerArc.current.visible = resources.uniforms.uLowerBrightness.value > 0
      && resources.uniforms.uLowerVisibility.value > 0
    resources.dustGeometry.setDrawRange(0,Math.floor(1536*resources.uniforms.uDiskDustAmount.value))
    const fit = layout.isolated ? Math.max(1, 1.5 / Math.max(.001, size.width / Math.max(1, size.height))) : 1
    const scale = viewport.height / 3.05 / fit
    if (root.current) {
      const birth=layout.entrance
      const transform=birth?contactEntranceTransform(birth,camera.position.z,viewport.height):{z:0,compensation:1,scale:1}
      root.current.visible = resources.uniforms.uArrival.value > .001&&(!birth||birth.size>0)
      root.current.scale.setScalar(scale*transform.scale)
      root.current.position.set(((finite(layout.centerX, .5) - .5) * viewport.width+(birth?.jitterX||0)*viewport.height)*transform.compensation,
        ((finite(layout.centerY, .5) - .5) * viewport.height+(birth?.jitterY||0)*viewport.height)*transform.compensation, transform.z)
      root.current.rotation.set(birth?.pitch||0,0,birth?.roll||0)
    }
    if (core.current) core.current.scale.setScalar(radius)
    if (disk.current) {
      const inclination = Math.min(65, Math.max(0, finite(values.diskInclination, 12)))
      const yaw = Math.min(35, Math.max(-35, finite(values.diskYaw, 0)))
      // Rotate a real XY annulus. Negative X places the near half below center.
      disk.current.rotation.set(THREE.MathUtils.degToRad(inclination - 90), THREE.MathUtils.degToRad(yaw), 0, 'YXZ')
      disk.current.position.y = Math.min(.3, Math.max(-.3, finite(values.diskHeight, 0)))
    }
  }, -5)

  return <group ref={root} dispose={null}>
    <mesh ref={core} geometry={resources.coreGeometry} material={resources.coreMaterial} frustumCulled={false}/>
    <mesh geometry={resources.haloGeometry} material={resources.haloMaterial}
      position={[0,0,-1.2]} renderOrder={0} frustumCulled={false}/>
    <mesh ref={upperArc} geometry={resources.arcGeometry} material={resources.upperMaterial}
      renderOrder={7} frustumCulled={false}/>
    <mesh ref={lowerArc} geometry={resources.arcGeometry} material={resources.lowerMaterial}
      renderOrder={7} frustumCulled={false}/>
    <group ref={disk}>
      <mesh geometry={resources.farDiskGeometry} material={resources.diskMaterial}
        renderOrder={4} frustumCulled={false}/>
      {resources.gasMaterials.map((material,index)=><mesh key={`far-${index}`} geometry={resources.farGasGeometry}
        material={material} renderOrder={index===3?5:1+index} frustumCulled={false}/>)}
      <points geometry={resources.dustGeometry} material={resources.farDustMaterial}
        renderOrder={6} frustumCulled={false}/>
      <mesh geometry={resources.diskGeometry} material={resources.diskMaterial}
        renderOrder={11} frustumCulled={false}/>
      {resources.gasMaterials.map((material,index)=><mesh key={index} geometry={resources.gasGeometry}
        material={material} renderOrder={index===3?12:8+index} frustumCulled={false}/>)}
      <points geometry={resources.dustGeometry} material={resources.dustMaterial}
        renderOrder={13} frustumCulled={false}/>
    </group>
  </group>
}
