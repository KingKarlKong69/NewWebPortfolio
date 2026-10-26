import {useFrame,useThree} from '@react-three/fiber'
import {useEffect,useRef} from 'react'
import {advanceBlackHoleMotion} from './blackHoleMotion'
import {getFooterBlackHoleValues,readFooterBlackHolePreset,subscribeFooterBlackHolePreset} from './footerBlackHolePreset'
import HybridBlackHole from './HybridBlackHole'
import ContactCharge from './ContactCharge'

// The distant universe stays mounted across Services and Contact. Only its
// near, blurred asteroid layer joins the black hole's canvas, ahead of the disk.
export default function CinematicFooterWorld({active,reducedMotion,journeyRef,quality,isolated=false}) {
  const {gl,size,invalidate}=useThree()
  const valuesRef=useRef(getFooterBlackHoleValues())
  const simulationRef=useRef({time:0,flow:0,turbulence:0})
  const layoutRef=useRef({centerX:.69,centerY:.585,isolated:false,arrival:0})
  const appliedRef=useRef(false)
  useEffect(()=>{
    const update=()=>{
      const preset=readFooterBlackHolePreset()
      appliedRef.current=Boolean(preset)
      valuesRef.current=getFooterBlackHoleValues()
      invalidate()
    }
    update()
    return subscribeFooterBlackHolePreset(update)
  },[invalidate])
  useFrame((_,delta)=>{
    const values=valuesRef.current
    if(active&&!reducedMotion)advanceBlackHoleMotion(simulationRef.current,delta,values.rotationSpeed)
    const entrance=journeyRef?.current.entrance
    const arrival=entrance?entrance.appearance:reducedMotion?1:(journeyRef?.current.progress??1)
    Object.assign(layoutRef.current,{
      centerX:isolated?.5:quality==='mobile'?.5:.69,
      centerY:isolated?.5:quality==='mobile'?.54:.585,
      isolated,arrival,entrance,asteroidArrival:1
    })
    const desiredDpr=Math.min(values.pixelRatio,Math.sqrt(3500000/Math.max(1,size.width*size.height)),gl.capabilities.maxTextureSize/Math.max(1,size.width,size.height))
    if(Math.abs(gl.getPixelRatio()-desiredDpr)>.01)gl.setPixelRatio(desiredDpr)
    gl.domElement.dataset.contactRenderer='hybrid-3d-disk-and-layered-curvature'
    gl.domElement.dataset.contactArrival=arrival.toFixed(3)
    gl.domElement.dataset.contactAsteroidModel='hero-shared'
    gl.domElement.dataset.contactPreset=appliedRef.current?'browser-preview':'project-default'
  },-10)
  return <>
    <HybridBlackHole valuesRef={valuesRef} simulationRef={simulationRef} layoutRef={layoutRef}/>
    {!isolated&&<ContactCharge layoutRef={layoutRef} valuesRef={valuesRef}/>}
  </>
}
