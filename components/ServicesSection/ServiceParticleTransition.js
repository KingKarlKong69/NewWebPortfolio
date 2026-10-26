import {useFrame,useLoader,useThree} from '@react-three/fiber'
import {useEffect,useMemo,useRef} from 'react'
import * as THREE from 'three'
import {SERVICES} from './servicesData'
import {SERVICE_WORDS,SERVICE_DUST_ROUTE,advanceServiceDustPhase,sampleServicesStory,sampleServicesJourney,sampleServiceColumn,serviceCoverScale,serviceRectNdc} from './serviceTransitionMotion'
import {createServiceParticleGeometries,setServiceTargetFrame} from './serviceParticleGeometry'
import {SERVICE_DUST_VERTEX,SERVICE_DUST_FRAGMENT,SERVICE_COLUMN_VERTEX,SERVICE_COLUMN_FRAGMENT} from './serviceTransitionShaders'

export default function ServiceParticleTransition({geometries,motionRef,deckRef,qualityRef}) {
  const {gl,camera}=useThree()
  const loaded=useLoader(THREE.TextureLoader,SERVICES.map(service=>service.image))
  const dustRefs=useRef([]),columnRefs=useRef([])
  const idlePhase=useRef(0)
  const referenceCamera=useMemo(()=>camera.clone(),[camera])
  const resources=useMemo(()=>{
    const buffers=createServiceParticleGeometries(geometries.slice(1),SERVICE_WORDS.slice(1))
    const images=loaded.map(texture=>{
      const copy=texture.clone(); copy.colorSpace=THREE.SRGBColorSpace; copy.needsUpdate=true; return copy
    })
    const route=SERVICE_DUST_ROUTE.map(point=>new THREE.Vector3(...point))
    const uniforms=images.map((image,column)=>({
      uImage:{value:image},uCoverScale:{value:new THREE.Vector2(1,1)},uRectPixels:{value:new THREE.Vector2(1,1)},
      uDissolve:{value:0},uSpiral:{value:0},uGather:{value:0},uSolid:{value:0},uHandoff:{value:0},uDpr:{value:1},
      uIdlePhase:{value:0},uRouteProgress:{value:0},uColumn:{value:column},uRoutePoints:{value:route},
      uApproach:{value:0},uExit:{value:0},uScatter:{value:0},uDustFade:{value:0},
      uFlowOrigin:{value:new THREE.Vector3()},uFlowRight:{value:new THREE.Vector3()},
      uFlowUp:{value:new THREE.Vector3()},uFlowDepth:{value:new THREE.Vector3()},
      uTargetOrigin:{value:new THREE.Vector3()},uTargetRight:{value:new THREE.Vector3()},uTargetUp:{value:new THREE.Vector3()},
      uRect:{value:new THREE.Vector4()}
    }))
    const dust=uniforms.map(values=>new THREE.ShaderMaterial({uniforms:values,
      vertexShader:SERVICE_DUST_VERTEX,fragmentShader:SERVICE_DUST_FRAGMENT,
      vertexColors:true,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}))
    const columns=uniforms.map(values=>new THREE.ShaderMaterial({uniforms:values,
      vertexShader:SERVICE_COLUMN_VERTEX,fragmentShader:SERVICE_COLUMN_FRAGMENT,
      transparent:true,depthTest:false,depthWrite:false,toneMapped:false}))
    return {buffers,images,uniforms,dust,columns,plane:new THREE.PlaneGeometry(1,1),epoch:0}
  },[geometries,loaded])

  useEffect(()=>{
    resources.epoch++
    return()=>{
      const epoch=++resources.epoch
      queueMicrotask(()=>{
        if(epoch!==resources.epoch)return
        resources.buffers.forEach(item=>item.dispose()); resources.images.forEach(item=>item.dispose())
        resources.dust.forEach(item=>item.dispose()); resources.columns.forEach(item=>item.dispose()); resources.plane.dispose()
      })
    }
  },[resources])

  useFrame((_,delta)=>{
    const story=sampleServicesStory(motionRef.current.progress)
    const journey=sampleServicesJourney(motionRef.current.journeyProgress||0)
    const departure=journey.exit>0&&journey.dustFade<1
    const visible=motionRef.current.storyVisible!==false&&story.progress>.49&&(story.handoff<1||departure)
    idlePhase.current=advanceServiceDustPhase(idlePhase.current,delta,visible&&!document.hidden)
    const rects=deckRef.current?.querySelectorAll('[data-service-column]')
    const canvas=gl.domElement.getBoundingClientRect()
    // The deck stays at its original world location as the camera flies away.
    // Use that reference projection for its particles, including direct links
    // restored midway through the journey.
    referenceCamera.copy(camera)
    const offset=motionRef.current.cameraOffset||[0,0,0]
    referenceCamera.position.x-=offset[0];referenceCamera.position.y-=offset[1];referenceCamera.position.z-=offset[2]
    referenceCamera.updateMatrixWorld()
    for(let column=0;column<5;column++){
      const u=resources.uniforms[column],state=sampleServiceColumn(story,column)
      u.uDissolve.value=story.dissolve;u.uSpiral.value=story.spiral
      u.uIdlePhase.value=idlePhase.current;u.uRouteProgress.value=story.route
      u.uApproach.value=story.approach;u.uExit.value=journey.exit
      u.uScatter.value=journey.scatter;u.uDustFade.value=journey.dustFade
      setServiceTargetFrame(referenceCamera,[0,0,1,1],u.uFlowOrigin.value,u.uFlowRight.value,u.uFlowUp.value)
      referenceCamera.getWorldDirection(u.uFlowDepth.value).multiplyScalar(-referenceCamera.position.z)
      u.uGather.value=state.gather;u.uSolid.value=state.solid;u.uHandoff.value=story.handoff
      u.uDpr.value=gl.getPixelRatio()
      if(rects?.[column]&&canvas.width>0&&canvas.height>0&&story.progress>.6){
        const rect=rects[column].getBoundingClientRect()
        if(rect.width>0&&rect.height>0){
          const ndc=serviceRectNdc(rect,canvas)
          u.uRect.value.fromArray(ndc)
          setServiceTargetFrame(referenceCamera,ndc,u.uTargetOrigin.value,u.uTargetRight.value,u.uTargetUp.value)
          const image=resources.images[column].image
          u.uCoverScale.value.fromArray(serviceCoverScale(image.width/image.height,rect.width/rect.height))
          u.uRectPixels.value.set(rect.width,rect.height)
        }
      }
      // Prefixes are stratified over source glyphs and every destination area.
      const fraction=Math.min(1,Math.max(.5,qualityRef.current.cap/1.5))
      resources.buffers[column].setDrawRange(0,Math.floor(resources.buffers[column].getAttribute('position').count*fraction))
      if(dustRefs.current[column])dustRefs.current[column].visible=visible
      if(columnRefs.current[column])columnRefs.current[column].visible=visible&&state.solid>0
    }
  },-1)

  return <group dispose={null}>
    {resources.columns.map((material,index)=><mesh key={`image-${index}`} ref={element=>{columnRefs.current[index]=element}}
      geometry={resources.plane} material={material} frustumCulled={false} visible={false} renderOrder={1}/>)}
    {resources.dust.map((material,index)=><points key={`dust-${index}`} ref={element=>{dustRefs.current[index]=element}}
      geometry={resources.buffers[index]} material={material} frustumCulled={false} visible={false} renderOrder={2}/>)}
  </group>
}
