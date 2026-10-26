const {test} = require('node:test')
const assert = require('node:assert/strict')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const {pathToFileURL} = require('node:url')
const file = name => readFileSync(join(__dirname,name),'utf8')
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const externalURL = name => pathToFileURL(require.resolve(name)).href
const threeURL = externalURL('three').replace('three.cjs','three.module.js')
const resolveThree = source => source.replace(/from '([^']+)'/g,(match,name)=>
  name==='three'?`from '${threeURL}'`:name.startsWith('three/')?`from '${externalURL(name)}'`:match)
const geometryURL = moduleURL(resolveThree(file('serviceTextGeometry.js')))
const geometry = import(geometryURL)
const motion = import(moduleURL(file('serviceTransitionMotion.js')))
const particle = import(moduleURL(resolveThree(file('serviceParticleGeometry.js')).replace("'./serviceTextGeometry'",`'${geometryURL}'`)))
const shader = import(moduleURL(file('serviceTransitionShaders.js')))
const fixtures = Promise.all([geometry,motion,import(externalURL('three/examples/jsm/loaders/FontLoader.js'))]).then(([g,m,{FontLoader}])=>{
  const font=new FontLoader().parse(JSON.parse(readFileSync(join(__dirname,'../../public/fonts/helvetiker_bold.typeface.json'),'utf8')))
  const words=m.SERVICE_WORDS.slice(1)
  const geometries=words.map(word=>g.createServiceTextGeometry(font,word.text,word.width,word.releaseOffset))
  return {words,geometries}
})

test('the compact composition uses common row positions and reading-order glyph ranks across both rows',async()=>{
  const {words,geometries}=await fixtures
  assert.equal(words[0].position[1],words[1].position[1])
  const whatHeight=geometries[0].boundingBox.max.y-geometries[0].boundingBox.min.y
  const offerHeight=geometries[2].boundingBox.max.y-geometries[2].boundingBox.min.y
  const rowGap=words[0].position[1]-words[2].position[1]-(whatHeight+offerHeight)/2
  assert.ok(rowGap>=0&&rowGap<whatHeight*.35,`row gap ${rowGap}`)
  assert.ok(words.every(word=>word.tilt===0))
  const found=new Set()
  for(let word=0;word<3;word++){
    const wordRanks=new Set()
    const attribute=geometries[word].getAttribute('aGlyphData')
    for(let i=0;i<attribute.count;i++){
      const rank=attribute.getX(i),x=attribute.getY(i)
      assert.ok(Number.isInteger(rank)&&rank>=0&&rank<=9)
      assert.ok(x>=-1e-6&&x<=1.000001)
      found.add(rank)
      wordRanks.add(rank)
    }
    for(let i=0;i<attribute.count;i+=3)assert.equal(attribute.getX(i),attribute.getX(i+2))
    assert.deepEqual([...wordRanks].sort((a,b)=>a-b),[[0,1,2,3],[4],[5,6,7,8,9]][word])
  }
  assert.deepEqual([...found].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9])
})

test('scroll stages leave a complete spiral beat, consolidate before handoff, and reverse deterministically',async()=>{
  const {sampleServicesStory:sample,sampleServiceColumn:column}=await motion
  const samples=Array.from({length:1001},(_,index)=>sample(index/1000))
  assert.equal(sample(.48).dissolve,0)
  assert.equal(sample(.65).dissolve,1)
  assert.equal(sample(.70).phase,'spiral')
  assert.equal(sample(.70).assembly,0)
  assert.equal(sample(.98).consolidation,1)
  assert.equal(sample(.97).handoff,0)
  assert.equal(sample(1).handoff,1)
  const held=sample(.49).camera
  for(let i=1000;i>=0;i--){
    const state=sample(i/1000)
    assert.deepEqual(state,samples[i])
    assert.equal(state.deckY,0)
    if(i>=490)assert.deepEqual(state.camera,held)
    for(const name of ['dissolve','spiral','route','assembly','consolidation','handoff']){
      assert.ok(state[name]>=0&&state[name]<=1)
      if(i)assert.ok(state[name]>=samples[i-1][name])
    }
    if(i)assert.ok(Math.hypot(...state.camera.map((v,j)=>v-samples[i-1].camera[j]))<.7)
  }
  for(let index=0;index<5;index++){
    assert.deepEqual(column(sample(1),index),{gather:1,solid:1})
    assert.deepEqual(column(sample(0),index),{gather:0,solid:0})
  }
})

test('particle buffers are stable, balanced, colored, and cover all letters/target regions at reduced counts',async()=>{
  const {words,geometries}=await fixtures
  const {createServiceParticleGeometries}=await particle
  const first=createServiceParticleGeometries(geometries,words)
  const second=createServiceParticleGeometries(geometries,words,1000)
  const third=createServiceParticleGeometries(geometries,words,1000)
  try{
    assert.equal(first.reduce((sum,g)=>sum+g.getAttribute('position').count,0),60000*1.5)
    for(const buffer of first){
      const count=buffer.getAttribute('position').count
      for(const attr of Object.values(buffer.attributes)){
        assert.equal(attr.count,count)
        assert.ok(attr.array.every(Number.isFinite))
        assert.equal(attr.version,0)
      }
      const ranks=new Set(),bins=new Set(),uv=buffer.getAttribute('aTargetUv')
      for(let i=0;i<count/2;i++){
        ranks.add(buffer.getAttribute('aGlyphData').getX(i))
        assert.ok(uv.getX(i)>=0&&uv.getX(i)<=1&&uv.getY(i)>=0&&uv.getY(i)<=1)
        bins.add(Math.min(7,Math.floor(uv.getX(i)*8))+8*Math.min(7,Math.floor(uv.getY(i)*8)))
      }
      assert.equal(ranks.size,10)
      assert.equal(bins.size,64)
      const colors=buffer.getAttribute('color').array
      assert.ok(Math.max(...colors.slice(0,300))>Math.min(...colors.slice(0,300)))
    }
    second.forEach((g,i)=>assert.deepEqual(g.getAttribute('position').array,third[i].getAttribute('position').array))
  }finally{[...first,...second,...third].forEach(g=>g.dispose())}
})

test('target frame projects to measured column corners for offset canvases and angled cameras',async()=>{
  const THREE=await import(threeURL)
  const {serviceRectNdc,serviceCoverScale}=await motion
  const {setServiceTargetFrame}=await particle
  for(const [width,height] of [[1920,1080],[1440,1200]]){
    const camera=new THREE.PerspectiveCamera(40,width/height,.1,300)
    camera.position.set(4,-10,23);camera.lookAt(0,-10,0);camera.updateMatrixWorld()
    const canvas={left:30,top:18,width,height}
    const rect={left:110,top:height*.1+18,width:width*.18,height:height*.8}
    const ndc=serviceRectNdc(rect,canvas)
    const origin=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3()
    setServiceTargetFrame(camera,ndc,origin,right,up)
    const corner=origin.clone().add(right).add(up).project(camera)
    const start=origin.clone().project(camera)
    assert.ok(Math.abs(start.x-ndc[0])<1e-8&&Math.abs(start.y-ndc[1])<1e-8)
    assert.ok(Math.abs(corner.x-ndc[0]-ndc[2])<1e-8&&Math.abs(corner.y-ndc[1]-ndc[3])<1e-8)
  }
  assert.deepEqual(serviceCoverScale(2,.5,1),[.25,1])
  assert.deepEqual(serviceCoverScale(.5,2,1),[1,.25])
})

test('GPU stages have all custom uniforms, attributes and matching varyings wired',async()=>{
  const shaderSource=await shader
  const component=file('ServiceParticleTransition.js')
  const uniformNames=new Set([...component.matchAll(/\b(u[A-Z]\w*):\{value:/g)].map(match=>match[1]))
  const bufferSource=file('serviceParticleGeometry.js')
  const attributes=new Set([...bufferSource.matchAll(/\['([^']+)',\w+,\d\]/g)].map(match=>match[1]))
  const declarations=(source,kind)=>[...source.matchAll(new RegExp(`${kind}\\s+\\w+\\s+([^;]+);`,'g'))]
    .flatMap(match=>match[1].split(',').map(value=>value.trim().replace(/\[\d+\]$/,'')))
  for(const name of ['DUST','COLUMN']){
    const vertex=shaderSource[`SERVICE_${name}_VERTEX`],fragment=shaderSource[`SERVICE_${name}_FRAGMENT`]
    for(const source of [vertex,fragment])for(const uniform of declarations(source,'uniform'))assert.ok(uniformNames.has(uniform),uniform)
    const varying=new Set(declarations(vertex,'varying'))
    for(const value of declarations(fragment,'varying'))assert.ok(varying.has(value),value)
    if(name==='DUST')for(const attribute of declarations(vertex,'attribute'))assert.ok(attributes.has(attribute),attribute)
  }
  const scene=file('ServicesScene.js')
  assert.ok(scene.includes('SERVICE_EROSION_GLSL'))
  assert.ok(shaderSource.SERVICE_DUST_VERTEX.includes(shaderSource.SERVICE_EROSION_GLSL))
  assert.ok(shaderSource.SERVICE_DUST_VERTEX.includes(shaderSource.SERVICE_FORMATION_GLSL))
  assert.ok(shaderSource.SERVICE_COLUMN_FRAGMENT.includes(shaderSource.SERVICE_FORMATION_GLSL))
})

test('idle dust keeps moving at fixed scroll, pauses when hidden, and resumes without a time leap',async()=>{
  const {advanceServiceDustPhase:advance,sampleServicesStory:sample}=await motion
  const held=sample(.70)
  let phase=0
  for(let frame=0;frame<120;frame++)phase=advance(phase,1/60)
  assert.ok(phase>.3)
  assert.deepEqual(sample(.70),held)
  assert.equal(advance(phase,10,false),phase)
  assert.equal(advance(phase,NaN),phase)
  assert.equal(advance(phase,-1),phase)
  assert.ok(Math.abs(advance(phase,100)-phase-.05*.18)<1e-10)
  const before=Math.PI*2-.001,after=advance(before,.05)
  assert.ok(after>=0&&after<.01)
  assert.ok(Math.abs(Math.atan2(Math.sin(after-before),Math.cos(after-before))-.009)<1e-10)
})

test('the perimeter turns toward the camera and fills every column before smoothing',async()=>{
  const THREE=await import(threeURL)
  const {SERVICE_DUST_ROUTE:points,sampleServicesStory:sample,sampleServiceColumn:column}=await motion
  assert.equal(points.length,9)
  assert.ok(points[1][0]>points[0][0]&&points[1][1]<points[0][1])
  assert.ok(points[3][1]>points[1][1])
  assert.ok(points[4][0]<points[3][0])
  assert.ok(points[6][1]<points[5][1])
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.5)
  for(let i=0;i<=1000;i++){
    const point=curve.getPoint(i/1000)
    assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<.9,'flow stays inside the viewport')
  }
  let previous=points[7][2]
  for(let i=0;i<=100;i++){
    const point=curve.getPoint(.875+(i/100)*.125)
    assert.ok(point.z>=previous-1e-8)
    assert.ok(point.z<.9,'stop before the near clipping plane')
    previous=point.z
  }
  assert.ok(points[8][2]>.8)
  assert.equal(sample(.83).approach,0)
  assert.equal(sample(.915).approach,1)
  assert.equal(sample(.915).assembly,0,'rush fills POV before gathering')
  assert.equal(sample(.71).route,0)
  assert.equal(sample(.89).route,1)
  for(let i=0;i<5;i++){
    assert.equal(column(sample(.955),i).gather,1)
    assert.equal(column(sample(.955),i).solid,0)
    assert.equal(column(sample(.965),i).solid,sample(.965).consolidation)
  }
})

test('the exit dissolves before curved diagonal travel; destinations settle and reverse exactly',async()=>{
  const {sampleServicesJourney:sample,SERVICE_DESTINATIONS:dest}=await motion
  assert.equal(sample(.63).deckInteractive,true)
  assert.equal(sample(.63).domDeck,1)
  assert.equal(sample(.68).deckInteractive,false)
  assert.equal(sample(.715).exit,1)
  assert.deepEqual(sample(.715).camera,[0,0,0])
  assert.deepEqual(sample(.81).camera,dest.contributions)
  assert.deepEqual(sample(.86).camera,dest.contributions)
  assert.equal(sample(.85).contributionActive,true)
  assert.equal(sample(.90).contributionActive,false)
  assert.deepEqual(sample(.96).camera,dest.testimonials)
  assert.equal(sample(1).testimonialActive,true)
  const right=sample(.76).camera,left=sample(.92).camera
  assert.ok(right[0]>0&&right[1]<0)
  assert.ok(left[0]<dest.contributions[0]&&left[1]<dest.contributions[1])
  // Depth changes and curved XY paths prevent a straight lateral slide.
  assert.ok(right[2]!==0&&left[2]!==dest.contributions[2])
  assert.ok(Math.abs(right[1]/right[0]-dest.contributions[1]/dest.contributions[0])>.03)
  const states=Array.from({length:2001},(_,i)=>sample(i/2000))
  for(let i=2000;i>=0;i--){
    assert.deepEqual(sample(i/2000),states[i])
    if(i)assert.ok(Math.hypot(...states[i].camera.map((v,j)=>v-states[i-1].camera[j]))<.10)
  }
})

test('DOM panel projection matches the traveling perspective camera for multiple aspect ratios',async()=>{
  const THREE=await import(threeURL)
  const {sampleServicesJourney:sample,servicePanelView:view,SERVICE_DESTINATIONS:dest}=await motion
  for(const aspect of [1.4,16/9,2.4])for(const progress of [.72,.77,.81,.88,.92,.96]){
    const journey=sample(progress),distance=1/Math.tan(20*Math.PI/180)
    const camera=new THREE.PerspectiveCamera(40,aspect,.01,100)
    camera.position.set(journey.camera[0],journey.camera[1],distance+journey.camera[2])
    camera.lookAt(journey.camera[0],journey.camera[1],journey.camera[2]);camera.updateMatrixWorld()
    for(const destination of Object.values(dest)){
      const projected=new THREE.Vector3(...destination).project(camera),panel=view(destination,journey.camera,aspect)
      assert.ok(Math.abs(projected.x-panel.x)<1e-10)
      assert.ok(Math.abs(projected.y+panel.y)<1e-10)
    }
  }
})
