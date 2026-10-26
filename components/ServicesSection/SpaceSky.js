import {Canvas,useFrame,useThree} from '@react-three/fiber'
import {useCallback,useEffect,useRef} from 'react'
import {advanceBlackHoleMotion} from '../ContactSection/blackHoleMotion'
import {getFooterBlackHoleValues,subscribeFooterBlackHolePreset} from '../ContactSection/footerBlackHolePreset'
import UniverseLayers from './UniverseLayers'

function UniverseBackground({active,motionRef,viewportRef}){
  const {gl,invalidate}=useThree()
  const valuesRef=useRef(getFooterBlackHoleValues())
  const simulationRef=useRef({time:0,flow:0,turbulence:0})
  const layoutRef=useRef({centerX:.5,centerY:.5,isolated:false,arrival:0,viewScale:1})
  const reduced=useRef(false)
  useEffect(()=>{
    const update=()=>{
      valuesRef.current=getFooterBlackHoleValues()
      invalidate()
    }
    update()
    return subscribeFooterBlackHolePreset(update)
  },[invalidate])
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion:reduce)')
    const update=()=>{reduced.current=media.matches;invalidate()}
    update();media.addEventListener('change',update)
    return()=>media.removeEventListener('change',update)
  },[invalidate])
  useEffect(()=>{
    if(!active)return
    let frame=0,last=0,previous=''
    const tick=now=>{
      if(!document.hidden&&now-last>=33){
        const m=motionRef.current
        const signature=[m.travelX,m.travelY,m.gravity,m.lensX,m.lensY,m.lensRadius,m.viewScale].join(',')
        if(!reduced.current||signature!==previous)invalidate()
        previous=signature;last=now
      }
      frame=requestAnimationFrame(tick)
    }
    invalidate();frame=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(frame)
  },[active,invalidate,motionRef])
  useEffect(()=>{
    const lost=event=>{
      event.preventDefault()
      if(viewportRef.current)viewportRef.current.dataset.ready='false'
    }
    const restored=()=>{delete gl.domElement.dataset.skyShaderError;invalidate()}
    gl.domElement.addEventListener('webglcontextlost',lost)
    gl.domElement.addEventListener('webglcontextrestored',restored)
    return()=>{
      lost({preventDefault(){}})
      gl.domElement.removeEventListener('webglcontextlost',lost)
      gl.domElement.removeEventListener('webglcontextrestored',restored)
    }
  },[gl,invalidate,viewportRef])
  useFrame((_,delta)=>{
    if(active&&!document.hidden&&!reduced.current)advanceBlackHoleMotion(simulationRef.current,delta,valuesRef.current.rotationSpeed)
    const m=motionRef.current
    Object.assign(layoutRef.current,{
      centerX:.5+(m.lensX||0)*.5,centerY:.5+(m.lensY||0)*.5,
      arrival:m.gravity||0,viewScale:m.viewScale||1,
      entrance:m.entrance,entranceBounds:m.entranceBounds,asteroidArrival:1,
      pointerX:reduced.current?0:m.pointerX||0,pointerY:reduced.current?0:m.pointerY||0,
      travelX:m.travelX||0,travelY:m.travelY||0
      ,suppressAsteroids:m.suppressAsteroids
    })
  },-10)
  const ready=useCallback(()=>{
    if(viewportRef.current&&!gl.getContext().isContextLost()&&gl.domElement.dataset.skyShaderError!=='true')viewportRef.current.dataset.ready='true'
  },[gl,viewportRef])
  return <UniverseLayers valuesRef={valuesRef} simulationRef={simulationRef} layoutRef={layoutRef}
    onReady={ready} renderMode="background"/>
}

export default function SpaceSky(props){
  return <Canvas frameloop="demand" dpr={[.65,1.25]} gl={{alpha:true,antialias:true,powerPreference:'low-power'}}
    onCreated={({gl})=>{
      gl.setClearColor('#010308',1)
      gl.debug.onShaderError=()=>{
        gl.domElement.dataset.skyShaderError='true'
        if(props.viewportRef.current)props.viewportRef.current.dataset.ready='false'
      }
    }} aria-hidden="true">
    <UniverseBackground {...props}/>
  </Canvas>
}
