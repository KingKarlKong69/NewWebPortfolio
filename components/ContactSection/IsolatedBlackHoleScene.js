import {Canvas, useFrame, useThree} from '@react-three/fiber'
import {Component, useCallback, useEffect, useRef, useState} from 'react'
import ActiveFrameLoop from '../ActiveFrameLoop'
import {LAB_DEFAULTS, sanitizeLabValue} from './blackHoleLabControls'
import {advanceBlackHoleMotion} from './blackHoleMotion'
import HybridBlackHole from './HybridBlackHole'
import ContactCharge from './ContactCharge'
import {advanceContactEntrance,sampleContactEntrance} from './contactEntranceMotion'
import UniverseLayers from '../ServicesSection/UniverseLayers'

const CANVAS_OPTIONS = {alpha:false, antialias:true, powerPreference:'high-performance'}
const CAMERA = {position:[0,0,10], fov:38, near:.1, far:40}
const MAX_RENDER_PIXELS = 3500000

class PreviewBoundary extends Component {
  state = {failed:false}
  static getDerivedStateFromError() { return {failed:true} }
  componentDidCatch(error) { this.props.onError(error) }
  render() { return this.state.failed ? null : this.props.children }
}

function LabWorld({valuesRef, revision, paused, visible, contextLost, onStatus, onDprChange, simulationRef,birthReplay,birthClock}) {
  const {gl, size, invalidate} = useThree()
  const [adaptiveCap, setAdaptiveCap] = useState(2)
  const statsRef = useRef({start:0, frames:0, slow:0, warmUntil:0})
  const lastRequestedDpr = useRef(LAB_DEFAULTS.pixelRatio)
  const resolutionLimited = useRef(false)
  const layoutRef = useRef({centerX:.5,centerY:.5,isolated:true,arrival:1})
  const running = visible && !paused && !contextLost
  const lastBirthFrame=useRef(null)
  useEffect(()=>{
    if(birthReplay>0&&birthClock.current.replay!==birthReplay){
      birthClock.current={replay:birthReplay,started:true,elapsed:0,complete:false}
      lastBirthFrame.current=null
      invalidate()
    }
  },[birthReplay,birthClock,invalidate])
  useEffect(()=>{lastBirthFrame.current=null},[running])

  useEffect(() => {
    if (contextLost) return
    // Resolution waits until dragging settles; appearance changes stay immediate.
    const requested = sanitizeLabValue('pixelRatio', valuesRef.current.pixelRatio, LAB_DEFAULTS.pixelRatio)
    let cap = adaptiveCap
    if (requested !== lastRequestedDpr.current) {
      lastRequestedDpr.current = requested
      cap = 2
      setAdaptiveCap(2)
      statsRef.current.slow = 0
    }
    const area = Math.max(1, size.width * size.height)
    const context = gl.getContext()
    const maxDimension = Math.min(gl.capabilities.maxTextureSize, context.getParameter(context.MAX_RENDERBUFFER_SIZE))
    const dpr = Math.max(.25, Math.min(requested, cap, Math.sqrt(MAX_RENDER_PIXELS / area), maxDimension / Math.max(1, size.width, size.height)))
    resolutionLimited.current = dpr < Math.min(requested, cap) - .01
    const timer = setTimeout(() => {
      if (context.isContextLost()) return
      if (Math.abs(gl.getPixelRatio() - dpr) > .005) onDprChange(dpr)
      invalidate()
    }, 180)
    invalidate()
    return () => clearTimeout(timer)
  }, [valuesRef, revision, size.width, size.height, adaptiveCap, gl, onDprChange, invalidate, contextLost])

  useEffect(() => {
    const now = performance.now()
    statsRef.current = {start:now, frames:0, slow:0, warmUntil:now+1500}
    invalidate()
  }, [running, invalidate])

  useFrame((_, delta) => {
    if (contextLost) return
    const birthNow=performance.now()
    if(running&&birthClock.current.started){
      advanceContactEntrance(birthClock.current,lastBirthFrame.current===null?0:(birthNow-lastBirthFrame.current)/1000,true)
      lastBirthFrame.current=birthNow
    }else lastBirthFrame.current=null
    const birth=birthClock.current.started?sampleContactEntrance(birthClock.current.elapsed):null
    Object.assign(layoutRef.current,{entrance:birth,arrival:birth?.appearance??1,curvatureArrival:birth?.lensing??1,asteroidArrival:1})
    if (running) {
      advanceBlackHoleMotion(simulationRef.current, delta, sanitizeLabValue('rotationSpeed',valuesRef.current.rotationSpeed))
    }
    const canvas = gl.domElement
    canvas.dataset.labTime = simulationRef.current.time.toFixed(3)
    canvas.dataset.labBirthPhase=birth?.phase||'idle'
    canvas.dataset.labRenderer = 'hybrid-3d-disk-and-layered-curvature'
    canvas.dataset.labPrograms = String(gl.info.programs?.length ?? 0)
    const now = performance.now()
    const stats = statsRef.current
    stats.frames++
    if (now - stats.start >= 1000 || !running) {
      const fps = running ? Math.round(stats.frames * 1000 / Math.max(1, now - stats.start)) : 0
      if (running && now > stats.warmUntil) stats.slow = fps < 24 ? stats.slow + 1 : 0
      if (stats.slow >= 3 && gl.getPixelRatio() > .55) {
        setAdaptiveCap(Math.max(.5, gl.getPixelRatio() * .8))
        stats.slow = 0
      }
      onStatus({state:'ready', fps, dpr:Number(gl.getPixelRatio().toFixed(2)),
        width:canvas.width, height:canvas.height,
        adaptive:adaptiveCap < lastRequestedDpr.current,
        message:adaptiveCap < lastRequestedDpr.current ? 'Resolution reduced after sustained low frame rate.'
          : resolutionLimited.current ? 'Resolution bounded by the 3.5-megapixel or graphics-device limit.' : '',
        time:simulationRef.current.time})
      stats.start = now
      stats.frames = 0
    }
  }, -10)

  return <>
    <ActiveFrameLoop active={running}/>
    <UniverseLayers valuesRef={valuesRef} simulationRef={simulationRef} layoutRef={layoutRef}/>
    <HybridBlackHole valuesRef={valuesRef} simulationRef={simulationRef} layoutRef={layoutRef}/>
    <ContactCharge valuesRef={valuesRef} layoutRef={layoutRef}/>
  </>
}

export default function IsolatedBlackHoleScene({valuesRef, revision=0, paused=false, onStatus,birthReplay=0}) {
  const defaultsRef = useRef({...LAB_DEFAULTS})
  const simulationRef = useRef({time:0, flow:0, turbulence:0})
  const birthClock=useRef({replay:0,started:false,elapsed:0,complete:false})
  const cleanupRef = useRef(null)
  const rendererRef = useRef(null)
  const statusCallback = useRef(onStatus)
  statusCallback.current = onStatus
  const [visible, setVisible] = useState(true)
  const [contextLost, setContextLost] = useState(false)
  const [recovery, setRecovery] = useState(0)
  const [renderDpr, setRenderDpr] = useState(LAB_DEFAULTS.pixelRatio)
  const [failed, setFailed] = useState(false)
  const errorRef = useRef(false)
  const previousStatus = useRef('')

  const recover = useCallback(() => {
    cleanupRef.current?.()
    errorRef.current = false
    previousStatus.current = ''
    setFailed(false)
    setContextLost(false)
    // Only explicit error recovery recreates a context; controls and time survive.
    statusCallback.current?.({state:'recovering', message:'Restoring the preview…'})
    setRecovery(value => value + 1)
  }, [])
  const report = useCallback(status => {
    if (errorRef.current && status.state === 'ready') return
    if (status.state === 'error') {
      errorRef.current = true
      setFailed(true)
    }
    const signature = JSON.stringify(status)
    if (signature === previousStatus.current) return
    previousStatus.current = signature
    statusCallback.current?.({...status, recover})
  }, [recover])
  const onError = useCallback(error => {
    report({state:'error', message:`Preview interrupted: ${error?.message || 'WebGL is unavailable.'}`})
  }, [report])
  const connectRenderer = useCallback(gl => {
    cleanupRef.current?.()
    const canvas = gl.domElement
    const lost = event => {
      event.preventDefault()
      setContextLost(true)
      report({state:'context-lost', message:'Graphics context lost. Waiting for restoration; your values are retained.'})
    }
    const restored = () => {
      errorRef.current = false
      setContextLost(false)
      report({state:'recovering', message:'Graphics context restored.'})
    }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    const previousCheck = gl.debug.onShaderError
    gl.debug.onShaderError = () => report({state:'error', message:'The preview shader could not compile. Select Recover preview to retry.'})
    cleanupRef.current = () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      gl.debug.onShaderError = previousCheck
    }
  }, [report])
  const created = useCallback(({gl}) => {
    rendererRef.current = gl
    connectRenderer(gl)
  }, [connectRenderer])

  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (rendererRef.current) connectRenderer(rendererRef.current)
    return () => cleanupRef.current?.()
  }, [connectRenderer])

  return <PreviewBoundary key={recovery} onError={onError}>
    <Canvas camera={CAMERA} dpr={renderDpr} frameloop="demand" flat gl={CANVAS_OPTIONS}
      onCreated={created}
      fallback={<p style={{color:'#c5d6df', padding:24}}>WebGL is unavailable in this browser.</p>}
      style={{background:'#000'}} aria-label="Live procedural black hole preview">
      <color attach="background" args={['#000']}/>
      <LabWorld valuesRef={valuesRef || defaultsRef} revision={revision} paused={paused || failed}
        visible={visible} contextLost={contextLost} onStatus={report} onDprChange={setRenderDpr} simulationRef={simulationRef} birthReplay={birthReplay} birthClock={birthClock}/>
    </Canvas>
  </PreviewBoundary>
}
