import {useFrame,useThree} from '@react-three/fiber'
import {useEffect,useMemo,useRef} from 'react'
import * as THREE from 'three'
import {makeRockGeometry,makeRockMaterial} from '../heroRockModel'
import {LAB_DEFAULTS,sanitizeLabValue} from '../ContactSection/blackHoleLabControls'
import {SPACE_ANCHORS} from './spaceStarData'
import {contactWaveRadius} from '../ContactSection/contactEntranceMotion'
import {STAR_VERTEX,STAR_FRAGMENT,UNIVERSE_VERTEX,UNIVERSE_FRAGMENT} from './universeShaders'

const random=seed=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n)}
const LAYERS=['distant','moving','accent','far','near']
const LIMITS={distant:2200,moving:1000,accent:100}
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback
const entranceUniforms=()=>({uBirthCenter:{value:new THREE.Vector2(.5,.5)},uBirthBounds:{value:new THREE.Vector4(0,0,1,1)},
 uBirthPull:{value:0},uBirthSnap:{value:0},uBirthWave:{value:0},uBirthWavePower:{value:0},uBirthMaxRadius:{value:1},
 uBirthTremor:{value:0}})

function makeStarLayer(name,mode){
 const count=LIMITS[name],positions=new Float32Array(count*3),details=new Float32Array(count*4)
 for(let i=0;i<count;i++){
   const anchor=mode===2?SPACE_ANCHORS[i]:null
   positions[i*3]=anchor?anchor.x/50-1:random(i*3+mode*3107)*2.3-1.15
   positions[i*3+1]=anchor?1-anchor.y/50:random(i*3+1+mode*3107)*2.3-1.15
   details.set([anchor?(anchor.size-1)/2.1:random(i+120+mode*201),random(i+920),i,
     anchor?(anchor.violet ? random(i+43)*.25 : .25+random(i+43)*.75):random(i+43)],i*4)
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3))
 geometry.setAttribute('aDetails',new THREE.BufferAttribute(details,4))
 const uniforms={...entranceUniforms(),uAspect:{value:1},uTime:{value:0},uRatio:{value:1},uMode:{value:mode},uSize:{value:1},uBrightness:{value:1},
   uTwinkle:{value:.25},uTwinkleSpeed:{value:1},uDepth:{value:1},uTrail:{value:0},uSpeed:{value:0},
   uHalo:{value:1},uViolet:{value:.25},uGlints:{value:1},uFrequency:{value:.167},uProbability:{value:.5},
   uIntensity:{value:1},uDuration:{value:2},uCount:{value:count},uPointer:{value:new THREE.Vector2()},
   uTravel:{value:new THREE.Vector2()},uMotion:{value:new THREE.Vector2()},uDirection:{value:new THREE.Vector2(1,0)}}
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:STAR_VERTEX,fragmentShader:STAR_FRAGMENT,
   transparent:true,depthWrite:false,depthTest:false,toneMapped:false,blending:THREE.AdditiveBlending})
 const points=new THREE.Points(geometry,material)
 points.frustumCulled=false
 const scene=new THREE.Scene()
 scene.add(points)
 return {scene,geometry,material,uniforms,points}
}

function makeResources(){
 const stars={distant:makeStarLayer('distant',0),moving:makeStarLayer('moving',1),accent:makeStarLayer('accent',2)}
 const targets=Object.fromEntries(LAYERS.map(name=>[name,new THREE.WebGLRenderTarget(1,1,{
   minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,
   depthBuffer:name==='far'||name==='near',stencilBuffer:false,generateMipmaps:false
 })]))
 const rockScenes={far:new THREE.Scene(),near:new THREE.Scene()}
 Object.values(rockScenes).forEach(scene=>{
   scene.add(new THREE.AmbientLight('#a3b8ce',1.2))
   const cool=new THREE.DirectionalLight('#c6e1ff',2.1);cool.position.set(-4,6,9);scene.add(cool)
   const warm=new THREE.DirectionalLight('#efb573',1.4);warm.position.set(4,1,5);scene.add(warm)
 })
 const rockGeometries=[makeRockGeometry(23,2),makeRockGeometry(89,2),makeRockGeometry(147,2)]
 const rockMaterial=makeRockMaterial()
 rockMaterial.transparent=true
 rockMaterial.opacity=1
 const rocks=Array.from({length:12},(_,i)=>{
   const mesh=new THREE.Mesh(rockGeometries[i%3],rockMaterial)
   mesh.frustumCulled=false;rockScenes.far.add(mesh)
   return mesh
 })
 const camera=new THREE.PerspectiveCamera(38,1,.1,50)
 camera.position.z=10
 const uniforms={
   ...entranceUniforms(),
   uDistant:{value:targets.distant.texture},uMoving:{value:targets.moving.texture},uAccent:{value:targets.accent.texture},
   uFar:{value:targets.far.texture},uNear:{value:targets.near.texture},uCenter:{value:new THREE.Vector2(.5,.5)},
   uTexel:{value:new THREE.Vector2(1,1)},uAspect:{value:1},uFit:{value:1},uViewScale:{value:1},
   uEnabled:{value:1},uArrival:{value:1},uBlur:{value:3.5},uForegroundOnly:{value:0},uCurvature:{value:1},uRadius:{value:1.4},
   uStrength:{value:.45},uRadial:{value:.8},uTangential:{value:.25},uStretch:{value:.35},uSoftness:{value:.6},
   uCurveDistant:{value:1},uCurveMoving:{value:1},uCurveAccent:{value:1},uCurveAsteroids:{value:1},uCurveForeground:{value:0}
 }
 const plane=new THREE.PlaneGeometry(2,2)
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:UNIVERSE_VERTEX,fragmentShader:UNIVERSE_FRAGMENT,
   depthTest:false,depthWrite:false,toneMapped:false})
 const foregroundMaterial=new THREE.ShaderMaterial({uniforms:{...uniforms,uForegroundOnly:{value:1}},
   vertexShader:UNIVERSE_VERTEX,fragmentShader:UNIVERSE_FRAGMENT,
   transparent:true,depthTest:false,depthWrite:false,toneMapped:false})
 return {stars,targets,rockScenes,rockGeometries,rockMaterial,rocks,camera,uniforms,plane,material,foregroundMaterial,
   width:1,height:1,clearColor:new THREE.Color(),viewport:new THREE.Vector4(),scissor:new THREE.Vector4()}
}

/** A shared procedural sky. Only its offscreen universe images are distorted;
 * black-hole geometry and DOM controls remain outside these five render layers.
 * Parent advances simulationRef before this component's -3 frame callback. */
export default function UniverseLayers({valuesRef,simulationRef,layoutRef,onReady,renderMode='all'}){
 const {gl,size}=useThree()
 const resources=useMemo(makeResources,[])
 const renderLayers=useMemo(()=>renderMode==='foreground'?['near']:renderMode==='background'?['distant','moving','accent','far']:LAYERS,[renderMode])
 const lifetime=useRef(0),readyRef=useRef(onReady)
 readyRef.current=onReady
 const motion=useRef({previous:null,x:0,y:0,rocks:0})
 useEffect(()=>{
   const epoch=++lifetime.current
   return()=>queueMicrotask(()=>{
     if(epoch!==lifetime.current)return
     Object.values(resources.targets).forEach(target=>target.dispose())
     Object.values(resources.stars).forEach(layer=>{layer.geometry.dispose();layer.material.dispose()})
     resources.rockGeometries.forEach(geometry=>geometry.dispose())
     resources.rockMaterial.dispose();resources.plane.dispose();resources.material.dispose();resources.foregroundMaterial.dispose()
   })
 },[resources])

 useFrame(()=>{
   if(gl.getContext().isContextLost())return
   const r=resources,raw=valuesRef?.current||LAB_DEFAULTS
   const value=key=>sanitizeLabValue(key,raw[key],LAB_DEFAULTS[key])
   const layout=layoutRef?.current||{}
   const time=finite(simulationRef?.current?.time)
   const m=motion.current
   const delta=m.previous===null?0:Math.max(0,Math.min(.06,time-m.previous))
   m.previous=time
   const direction=value('movingDirection')*Math.PI/180
   m.x+=Math.cos(direction)*value('movingSpeed')*delta
   m.y+=Math.sin(direction)*value('movingSpeed')*delta
   m.rocks+=value('asteroidSpeed')*delta*.025
   const aspect=size.width/Math.max(1,size.height)
   const ratio=Math.min(gl.getPixelRatio(),1600/Math.max(1,size.width,size.height),
     Math.sqrt(2000000/Math.max(1,size.width*size.height)),gl.capabilities.maxTextureSize/Math.max(1,size.width,size.height))
   const width=Math.max(1,Math.floor(size.width*ratio)),height=Math.max(1,Math.floor(size.height*ratio))
   if(r.width!==width||r.height!==height){
     renderLayers.forEach(name=>r.targets[name].setSize(width,height))
     r.width=width;r.height=height
     r.camera.aspect=aspect;r.camera.updateProjectionMatrix()
   }
   const u=r.uniforms
   u.uAspect.value=aspect
   u.uFit.value=layout.isolated?Math.max(1,1.5/aspect):1
   u.uViewScale.value=Math.max(.05,finite(layout.viewScale,1))
   u.uCenter.value.set(finite(layout.centerX,.5),finite(layout.centerY,.5))
   const birth=layout.entrance,bounds=layout.entranceBounds||[0,0,1,1]
   u.uBirthCenter.value.copy(u.uCenter.value);u.uBirthBounds.value.fromArray(bounds)
   u.uBirthPull.value=finite(birth?.pull);u.uBirthSnap.value=finite(birth?.snap)
   u.uBirthWave.value=finite(birth?.wave);u.uBirthWavePower.value=finite(birth?.wavePower)
   u.uBirthTremor.value=finite(birth?.tremor)
   u.uBirthMaxRadius.value=Math.max(.1,contactWaveRadius([u.uCenter.value.x,u.uCenter.value.y],bounds,aspect))
   u.uTexel.value.set(1/width,1/height)
   u.uEnabled.value=value('universeEnabled')
   u.uArrival.value=THREE.MathUtils.clamp(finite(layout.curvatureArrival,finite(layout.arrival,layout.isolated?1:0)),0,1)
   u.uBlur.value=value('foregroundBlur')*height/Math.max(1,size.height)
   const mappings={uCurvature:'curvatureEnabled',uRadius:'curvatureRadius',uStrength:'curvatureStrength',
     uRadial:'curvatureRadial',uTangential:'curvatureTangential',uStretch:'curvatureStretch',uSoftness:'curvatureSoftness',
     uCurveDistant:'curveDistant',uCurveMoving:'curveMoving',uCurveAccent:'curveAccent',
     uCurveAsteroids:'curveAsteroids',uCurveForeground:'curveForeground'}
   Object.entries(mappings).forEach(([uniform,key])=>{u[uniform].value=value(key)})
   if(u.uEnabled.value<.5)return

   Object.entries(r.stars).forEach(([name,layer])=>{
     const s=layer.uniforms,count=value(`${name}Enabled`)?value(`${name}Count`):0
     s.uAspect.value=aspect;s.uBirthCenter.value.copy(u.uBirthCenter.value);s.uBirthBounds.value.copy(u.uBirthBounds.value)
     for(const key of ['uBirthPull','uBirthSnap','uBirthWave','uBirthWavePower','uBirthMaxRadius'])s[key].value=u[key].value
     layer.geometry.setDrawRange(0,count)
     s.uTime.value=time;s.uRatio.value=height/Math.max(1,size.height);s.uCount.value=count
     s.uSize.value=value(`${name}Size`)
     s.uBrightness.value=name==='accent'?1:value(`${name}Brightness`)
     s.uTwinkle.value=value('twinkleAmount');s.uTwinkleSpeed.value=value('twinkleSpeed')
     s.uPointer.value.set(finite(layout.pointerX),finite(layout.pointerY))
     s.uTravel.value.set(finite(layout.travelX),finite(layout.travelY))
     s.uMotion.value.set(m.x,m.y);s.uDirection.value.set(Math.cos(direction),Math.sin(direction))
     s.uDepth.value=value('movingDepth');s.uTrail.value=name==='moving'?value('movingTrail'):0
     s.uSpeed.value=value('movingSpeed');s.uHalo.value=value('accentHalo');s.uViolet.value=value('accentViolet')
     s.uGlints.value=value('glintsEnabled');s.uFrequency.value=value('glintFrequency')
     s.uProbability.value=value('glintProbability');s.uIntensity.value=value('glintIntensity');s.uDuration.value=value('glintDuration')
   })
   const rockCount=value('asteroidsEnabled')&&!layout.suppressAsteroids?value('asteroidCount'):0
   const nearCount=Math.round(rockCount*value('asteroidNearFraction'))
   const asteroidArrival=THREE.MathUtils.clamp(finite(layout.asteroidArrival,u.uArrival.value),0,1)
   r.rockMaterial.opacity=asteroidArrival
   r.rocks.forEach((rock,i)=>{
     rock.visible=i<rockCount&&asteroidArrival>.001
     if(!rock.visible)return
     const near=i<nearCount
     const scene=near?r.rockScenes.near:r.rockScenes.far
     if(rock.parent!==scene)scene.add(rock)
     const phase=(m.rocks*(.7+random(i+312)*.6)+random(i+192))%1
     const x=(phase*2.8-1.4)*(i%2===0?1:-1)
     const y=(random(i+202)*1.5-.75)+Math.sin(phase*Math.PI*2+i)*.13
     const z=near?5.7+random(i+21)*1.6:-.5-random(i+24)*2
     const halfHeight=Math.tan(19*Math.PI/180)*(10-z)
     rock.position.set(x*halfHeight*aspect,y*halfHeight,z)
     const scale=(near ? .43 : .12+random(i+304)*.1)*value('asteroidSize')
     const edge=THREE.MathUtils.smoothstep(phase,0,.05)*(1-THREE.MathUtils.smoothstep(phase,.95,1))
     rock.scale.setScalar(scale*edge)
     rock.rotation.set(m.rocks*.33+i,m.rocks*.5+i*.41,m.rocks*.17+i*.29)
   })

   // R3F still owns the normal scene render. Restore every renderer setting
   // touched here even if an offscreen scene fails, including viewport/scissor.
   const target=gl.getRenderTarget(),cubeFace=gl.getActiveCubeFace?.()||0,mipmap=gl.getActiveMipmapLevel?.()||0
   const clearAlpha=gl.getClearAlpha(),autoClear=gl.autoClear,xr=gl.xr.enabled,shadowUpdate=gl.shadowMap.autoUpdate
   gl.getClearColor(r.clearColor);gl.getViewport(r.viewport);gl.getScissor(r.scissor)
   const scissorTest=gl.getScissorTest()
   try{
     gl.xr.enabled=false;gl.shadowMap.autoUpdate=false;gl.autoClear=false
     gl.setScissorTest(false);gl.setClearColor(0,0)
     renderLayers.forEach(name=>{
       gl.setRenderTarget(r.targets[name]);gl.clear(true,true,true)
       gl.render(r.stars[name]?.scene||r.rockScenes[name],r.camera)
     })
   }finally{
     gl.setRenderTarget(target,cubeFace,mipmap)
     gl.setViewport(r.viewport);gl.setScissor(r.scissor);gl.setScissorTest(scissorTest)
     gl.setClearColor(r.clearColor,clearAlpha);gl.autoClear=autoClear
     gl.xr.enabled=xr;gl.shadowMap.autoUpdate=shadowUpdate
   }
 },-3)

 return <>
 {renderMode!=='foreground'&&<mesh geometry={resources.plane} material={resources.material} renderOrder={-1000}
   frustumCulled={false} onAfterRender={()=>{
     if(!gl.getContext().isContextLost())readyRef.current?.()
   }}/>}
 {renderMode!=='background'&&<mesh geometry={resources.plane} material={resources.foregroundMaterial} renderOrder={1000} frustumCulled={false}/>}
 </>
}
