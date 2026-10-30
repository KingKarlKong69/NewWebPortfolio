import {Canvas, useFrame} from '@react-three/fiber'
import {Component, useRef} from 'react'
import ActiveFrameLoop from './ActiveFrameLoop'
import JourneyTesseract from './JourneyTesseract'

class CoreBoundary extends Component {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed ? <div style={{position:'absolute',left:'var(--core-x)',top:'var(--core-y)',width:32,height:32,border:'1px solid #82ebff',transform:'translate(-50%,-50%) rotate(45deg)',boxShadow:'0 0 20px #3bcfff'}}/> : this.props.children}
}
function Core({frameRef}) {
  const clock = useRef(0)
  useFrame((_,delta)=>{clock.current+=Math.min(.05,delta);frameRef.current.elapsed=clock.current},-10)
  return <JourneyTesseract frameRef={frameRef}/>
}
export default function MobileJourneyCore({frameRef,active}) {
  return <CoreBoundary><Canvas camera={{position:[0,0,18],fov:40}} dpr={[1,1.25]} frameloop="demand" gl={{alpha:true,antialias:true,powerPreference:'low-power'}} style={{position:'absolute',inset:0,pointerEvents:'none'}}>
    <ActiveFrameLoop active={active}/><Core frameRef={frameRef}/>
  </Canvas></CoreBoundary>
}
