import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import * as THREE from 'three'
import {createContactChargeGeometry} from './contactChargeGeometry'
import {CONTACT_CHARGE_VERTEX,CONTACT_CHARGE_FRAGMENT,CONTACT_FOCAL_VERTEX,CONTACT_FOCAL_FRAGMENT} from './contactChargeShaders'

export default function ContactCharge({layoutRef,valuesRef}){
  const {size}=useThree(),mesh=useRef(null),focal=useRef(null)
  const resources=useMemo(()=>{
    const uniforms={uTime:{value:0},uAspect:{value:1},uRadius:{value:0},uCharge:{value:0},uGrowth:{value:0},uFocal:{value:0},uCenter:{value:new THREE.Vector2()}}
    return {epoch:0,uniforms,plane:new THREE.PlaneGeometry(2,2),
      focalMaterial:new THREE.ShaderMaterial({uniforms,vertexShader:CONTACT_FOCAL_VERTEX,fragmentShader:CONTACT_FOCAL_FRAGMENT,
        transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}),
      geometry:createContactChargeGeometry(),material:new THREE.ShaderMaterial({
      uniforms,vertexShader:CONTACT_CHARGE_VERTEX,fragmentShader:CONTACT_CHARGE_FRAGMENT,
      transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending})}
  },[])
  useEffect(()=>{
    resources.epoch++
    return()=>{const epoch=++resources.epoch;queueMicrotask(()=>{if(epoch===resources.epoch){resources.geometry.dispose();resources.material.dispose();resources.plane.dispose();resources.focalMaterial.dispose()}})}
  },[resources])
  useFrame(()=>{
    const layout=layoutRef.current,birth=layout.entrance,u=resources.uniforms
    if(mesh.current)mesh.current.visible=Boolean(birth&&birth.charge>.001)
    if(focal.current)focal.current.visible=Boolean(birth&&birth.focal>.001)
    if(!birth)return
    const aspect=size.width/Math.max(1,size.height)
    u.uTime.value=birth.time;u.uAspect.value=aspect;u.uCharge.value=birth.charge;u.uGrowth.value=birth.growth
    u.uFocal.value=birth.focal||0
    const fit=layout.isolated?Math.max(1,1.5/aspect):1
    u.uRadius.value=2*(valuesRef.current.coreRadius||.85)/3.05*birth.size/fit
    u.uCenter.value.set(layout.centerX+birth.jitterX/aspect,layout.centerY+birth.jitterY)
  },-4)
  return <group dispose={null}>
    <mesh ref={focal} geometry={resources.plane} material={resources.focalMaterial} visible={false} renderOrder={39} frustumCulled={false}/>
    <mesh ref={mesh} geometry={resources.geometry} material={resources.material} visible={false} renderOrder={40} frustumCulled={false}/>
  </group>
}
