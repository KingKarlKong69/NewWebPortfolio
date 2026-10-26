import {Canvas, useFrame, useLoader, useThree} from '@react-three/fiber'
import {Suspense, useEffect, useMemo, useRef} from 'react'
import * as THREE from 'three'
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import {sampleServicesStory,sampleServicesJourney,smoothRange,SERVICE_WORDS as WORDS} from './serviceTransitionMotion'
import {createServiceTextGeometry as textGeometry, getServicesPixelRatio,
  SERVICE_TEXT_PITCH, SERVICE_TEXT_YAW,SERVICE_TEXT_FINISH as TEXT_FINISH} from './serviceTextGeometry'
import ServiceParticleTransition from './ServiceParticleTransition'
import {SERVICE_EROSION_GLSL} from './serviceTransitionShaders'

function SceneContent({motionRef, active,deckRef,onFailure}) {
  const font = useLoader(FontLoader, '/fonts/helvetiker_bold.typeface.json')
  const {camera, gl, size, scene, invalidate} = useThree()
  const refs = useRef([]), testimonialRef = useRef()
  const pointer = useRef(new THREE.Vector2())
  const pointerTarget = useMemo(() => new THREE.Vector2(), [])
  const baseRotation = useMemo(() => new THREE.Euler(), [])
  const baseQuaternion = useMemo(() => new THREE.Quaternion(), [])
  const maxRenderSize = useMemo(() => {
    const context = gl.getContext()
    return Math.min(gl.capabilities.maxTextureSize, context.getParameter(context.MAX_RENDERBUFFER_SIZE))
  }, [gl])
  const quality = useRef({cap:1.5, elapsed:0, frames:0, slow:0, warmup:1.5})
  const geometries = useMemo(() => {
    const result=WORDS.map(word=>textGeometry(font,word.text,word.width,word.releaseOffset))
    const whatHeight=result[1].boundingBox.max.y-result[1].boundingBox.min.y
    const iHeight=result[2].boundingBox.max.y-result[2].boundingBox.min.y
    result[2].scale(whatHeight/iHeight,whatHeight/iHeight,whatHeight/iHeight)
    result[2].computeBoundingBox();result[2].computeBoundingSphere()
    return result
  }, [font])
  const heading = useMemo(() => textGeometry(font, 'WHAT PEOPLE SAY', 25), [font])
  const dissolveUniform = useMemo(() => ({value: 0}), [])
  const materials = useMemo(() => WORDS.map((word,index)=>TEXT_FINISH.map(finish => {
    const material = new THREE.MeshPhysicalMaterial(finish)
    material.onBeforeCompile = shader => {
      shader.uniforms.uDissolve = dissolveUniform
      shader.uniforms.uErosionEnabled={value:index===0?0:1}
      shader.vertexShader = 'attribute vec2 aGlyphData; varying vec2 vGlyphData; varying vec3 vLocal;\n'
        +shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal=position;vGlyphData=aGlyphData;')
      shader.fragmentShader = 'uniform float uDissolve,uErosionEnabled; varying vec2 vGlyphData; varying vec3 vLocal;\n'
        +SERVICE_EROSION_GLSL+shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if(uErosionEnabled>.5 && uDissolve>serviceRelease(vGlyphData,vLocal)) discard;`)
    }
    material.customProgramCacheKey = () => 'service-text-reading-order-erosion-v2'
    return material
  })), [dissolveUniform])
  const headingMaterials = useMemo(() => TEXT_FINISH.map(finish => new THREE.MeshPhysicalMaterial(finish)), [])

  useEffect(()=>{
    const previous=gl.debug.onShaderError
    const failed=(...args)=>{
      gl.domElement.dataset.servicesShaderError='true'
      onFailure?.()
      previous?.(...args)
    }
    gl.debug.onShaderError=failed
    return()=>{if(gl.debug.onShaderError===failed)gl.debug.onShaderError=previous}
  },[gl,onFailure])

  useEffect(() => {
    const previous = scene.environment
    let target = null
    const setup = () => {
      const room = new RoomEnvironment()
      const generator = new THREE.PMREMGenerator(gl)
      try {
        const next = generator.fromScene(room, .04)
        target?.dispose()
        target = next
        scene.environment = target.texture
        invalidate()
      } finally { room.dispose(); generator.dispose() }
    }
    setup()
    gl.domElement.addEventListener('webglcontextrestored', setup)
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', setup)
      if (scene.environment === target?.texture) scene.environment = previous
      target?.dispose()
    }
  }, [gl, scene, invalidate])

  useEffect(() => {
    quality.current = {cap:1.5, elapsed:0, frames:0, slow:0, warmup:1.5}
  }, [active, size.width, size.height])

  useEffect(() => {
    const canvas=gl.domElement
    canvas.dataset.servicesRenderer='reading-order-gpu-dust-spiral-columns'
    return () => {delete canvas.dataset.servicesRenderer}
  }, [gl])
  // R3F owns geometry disposal on unmount. Keep shared memoized materials alive
  // through StrictMode's effect replay; dispose only after the real unmount.
  const owned=useMemo(()=>({epoch:0,geometries,heading,materials,headingMaterials}),[geometries,heading,materials,headingMaterials])
  useEffect(() => {
    owned.epoch++
    return () => {
      const epoch=++owned.epoch
      queueMicrotask(() => {
        if(owned.epoch!==epoch)return
        owned.geometries.forEach(g=>g.dispose()); owned.heading.dispose()
        owned.materials.flat().forEach(m=>m.dispose()); owned.headingMaterials.forEach(m=>m.dispose())
      })
    }
  },[owned])

  useFrame((state, delta) => {
    const motion=motionRef.current, story=sampleServicesStory(motion.progress||0)
    const t=state.clock.elapsedTime
    const stats=quality.current
    if(active && !document.hidden){
      const dt=Math.min(Math.max(delta,0),.25)
      stats.warmup=Math.max(0,stats.warmup-dt)
      stats.elapsed+=dt; stats.frames++
      if(stats.elapsed>=1){
        stats.slow=stats.warmup===0 && stats.frames/stats.elapsed<23?stats.slow+1:0
        if(stats.slow>=3){stats.cap=Math.max(.65,stats.cap*.8);stats.slow=0}
        stats.elapsed=0;stats.frames=0
      }
    }
    const ratio=getServicesPixelRatio(size.width,size.height,window.devicePixelRatio||1,
      stats.cap,maxRenderSize)
    if(Math.abs(gl.getPixelRatio()-ratio)>.01)gl.setPixelRatio(ratio)
    gl.setViewport(0,0,size.width,size.height)
    const fit=Math.max(1,1.6/(size.width/size.height))
    const journey=sampleServicesJourney(motion.journeyProgress||0)
    const halfHeight=Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*story.camera[2]*fit
    const offset=journey.camera.map(axis=>axis*halfHeight)
    motion.cameraOffset=offset
    camera.position.set(story.camera[0]+offset[0],story.camera[1]+offset[1],story.camera[2]*fit+offset[2])
    camera.lookAt(story.lookX+offset[0],story.camera[1]+offset[1],offset[2])
    camera.updateMatrixWorld()
    pointer.current.lerp(pointerTarget.set(motion.pointerX||0,motion.pointerY||0),1-Math.exp(-Math.min(delta,.05)*5))
    dissolveUniform.value=story.dissolve
    refs.current.forEach((mesh,i)=>{
      if(!mesh)return
      const word=WORDS[i]
      const idle=1-smoothRange(story.progress,.42,.48)
      mesh.position.set(word.position[0],word.position[1]+Math.sin(t*.55+i)*.045*idle,word.position[2])
      baseRotation.set(SERVICE_TEXT_PITCH+pointer.current.y*.035*idle,
        SERVICE_TEXT_YAW-pointer.current.x*.055*idle,word.tilt+Math.sin(t*.3+i)*.006*idle)
      baseQuaternion.setFromEuler(baseRotation)
      mesh.quaternion.copy(baseQuaternion)
      mesh.visible=motion.storyVisible!==false && (i===0?story.progress<.25:story.dissolve<1)
    })
    if(testimonialRef.current){
      const title=motion.testimonialRect,y=title?.y??3
      testimonialRef.current.visible=journey.progress>.88&&y>-.3&&y<1.3
      const height=2*halfHeight,distance=story.camera[2]*fit
      testimonialRef.current.position.set(camera.position.x+((title?.x??.5)-.5)*height*camera.aspect,camera.position.y+(.5-y)*height,camera.position.z-distance)
      testimonialRef.current.scale.setScalar(height*camera.aspect*(title?.width??.8)*.9/25)
      testimonialRef.current.rotation.set(SERVICE_TEXT_PITCH+pointer.current.y*.02,
        SERVICE_TEXT_YAW-pointer.current.x*.03,Math.sin(t*.4)*.006)
    }
    gl.domElement.dataset.servicesPhase=story.phase
    gl.domElement.dataset.servicesProgress=story.progress.toFixed(4)
  },-2)
  return <>
    <ambientLight intensity={.32}/><directionalLight position={[-8,12,14]} intensity={2.7} color="#fffaf3"/>
    <directionalLight position={[9,2,7]} intensity={.85} color="#dce7ff"/>
    <directionalLight position={[-10,-4,-5]} intensity={1.1} color="#edf3ff"/>
    {WORDS.map((word,i)=><mesh key={word.text} ref={element=>{refs.current[i]=element}} geometry={geometries[i]} material={materials[i]} position={word.position} dispose={null}/>)}
    <ServiceParticleTransition geometries={geometries} motionRef={motionRef} deckRef={deckRef} qualityRef={quality}/>
    <mesh ref={testimonialRef} geometry={heading} material={headingMaterials} visible={false} dispose={null}/>
  </>
}

function SpaceFrameLoop({motionRef,active}){
  const invalidate=useThree(state=>state.invalidate)
  useEffect(()=>{
    if(!active)return
    let frame=0,last=0,progress=-1,pointerX=0,pointerY=0
    const tick=now=>{
      const motion=motionRef.current
      const moving=Math.abs((motion.progress||0)-progress)>.000001||Math.abs((motion.pointerX||0)-pointerX)>.002||Math.abs((motion.pointerY||0)-pointerY)>.002
      if(!document.hidden&&now-last>=(moving?16:33)){
        invalidate();last=now;progress=motion.progress||0;pointerX=motion.pointerX||0;pointerY=motion.pointerY||0
      }
      frame=requestAnimationFrame(tick)
    }
    invalidate();frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[active,invalidate,motionRef])
  return null
}

export default function ServicesScene({motionRef,active,deckRef,onFailure}){
  return <Canvas camera={{position:[0,4,23],fov:40,near:.1,far:300}} dpr={[.65,1.5]} frameloop="demand" gl={{alpha:true,antialias:true,powerPreference:'high-performance'}} aria-hidden="true">
    <SpaceFrameLoop motionRef={motionRef} active={active}/><Suspense fallback={null}><SceneContent motionRef={motionRef} active={active} deckRef={deckRef} onFailure={onFailure}/></Suspense>
  </Canvas>
}
