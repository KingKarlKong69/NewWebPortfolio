const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {join}=require('node:path')
const url=text=>`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`

test('touch movement consumes native inertia and performs one adjacent project navigation',async()=>{
  const decisions=url(readFileSync(join(__dirname,'mobileChapterGestures.js'),'utf8'))
  const hookSource=readFileSync(join(__dirname,'useMobileChapterGestures.js'),'utf8')
    .replace("import {useEffect} from 'react'",'const useEffect=effect=>{globalThis.__gestureCleanup=effect()}')
    .replace("'./mobileChapterGestures'",`'${decisions}'`)
  const handlers=new Map(),calls=[]
  const saved={window:global.window,innerHeight:global.innerHeight}
  global.innerHeight=800
  global.window={scrollY:1000,addEventListener(){},removeEventListener(){},scrollTo:options=>calls.push(options)}
  const node={offsetHeight:8800,getBoundingClientRect:()=>({top:-1000}),addEventListener:(type,fn)=>handlers.set(type,fn),removeEventListener(){}}
  try{
    const {default:useGestures}=await import(url(hookSource))
    useGestures({runwayRef:{current:node},motionRef:{current:{progress:.2,projectIndex:0}},projectStops:[.2,.3,.4,.5],faceStops:[.7,.8],layout:{distance:1000,projects:600,portal:100,mountains:200,ending:100}})
    const target={closest:()=>null}
    handlers.get('touchstart')({target,touches:[{clientX:200,clientY:500}]})
    let prevented=0
    for(const y of [480,420,200,-500])handlers.get('touchmove')({touches:[{clientX:200,clientY:y}],cancelable:true,preventDefault(){prevented++}})
    assert.equal(calls.length,0,'movement should not jump through intermediate chapters')
    handlers.get('touchend')()
    assert.equal(prevented,4)
    assert.equal(calls.length,1)
    assert.equal(calls[0].top,2400,'the next reading stop is .3 of the runway')
    assert.equal(calls[0].behavior,'smooth')
    handlers.get('touchend')()
    assert.equal(calls.length,1,'the same gesture cannot fire twice')
  }finally{
    global.__gestureCleanup?.();delete global.__gestureCleanup
    for(const [key,value] of Object.entries(saved)){if(value===undefined)delete global[key];else global[key]=value}
  }
})
