const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs')
const source=readFileSync(`${__dirname}/navigationState.js`,'utf8')
function scrollFunction(window){
  const start=source.indexOf('const scrollToSectionElement ='),end=source.indexOf('\nconst getHashSection',start)
  return new Function('window',source.slice(start,end)+';return scrollToSectionElement')(window)
}
test('navigation lands at explicit composed story milestones and Home always goes to document zero',()=>{
  const positions=[],window={scrollY:20000,innerHeight:1000,matchMedia:()=>({matches:true}),scrollTo:value=>positions.push(value)}
  const seek=scrollFunction(window)
  seek({id:'home'},'instant');assert.equal(positions.pop().top,0)
  for(const [id,p,multiples] of [['about',.127272727,2],['projects',.035,1]]){
    seek({id,querySelector:()=>({offsetHeight:18000,dataset:{navProgress:String(p)},getBoundingClientRect:()=>({top:-15000})})},'instant')
    assert.equal(positions.pop().top,5000+(18000-1000*multiples)*p)
  }
  seek({id:'services',dataset:{servicesEntryHold:'60'},scrollIntoView:()=>assert.fail(),getBoundingClientRect:()=>({top:5000})},'instant')
  assert.equal(positions.pop().top,25600)
})
test('shortcut event releases story gates before changing scroll position',()=>{
  const calls=[],window={scrollY:999,history:{pushState:()=>calls.push('history')},location:{hash:''},
    dispatchEvent:event=>{assert.equal(event.detail.shortcut,true);calls.push('release')}}
  const start=source.indexOf('  const navigateToSection = useCallback('),end=source.indexOf('\n  return useMemo',start)
  const code=source.slice(start,end).replace('const navigateToSection = useCallback(','const navigateToSection = ').replace(/, \[\]\)\s*$/,'')
  const navigate=new Function('window','document','setActiveSection','scrollToSectionElement','CustomEvent','NAV_EVENT',
    code+';return navigateToSection')(window,{getElementById:()=>({})},()=>{},()=>calls.push('seek'),class{constructor(type,options){this.detail=options.detail}},'nav')
  navigate('home');assert.deepEqual(calls,['release','seek','history'])
})

test('mobile story destinations use the mounted single-viewport runway and current viewport height',()=>{
  const positions=[],selectors=[]
  const window={scrollY:900,innerHeight:800,matchMedia:()=>({matches:false}),scrollTo:value=>positions.push(value)}
  const seek=scrollFunction(window)
  for(const id of ['about','projects']){
    seek({id,dataset:{},scrollIntoView:()=>assert.fail('story should use its explicit destination'),querySelector:selector=>{
      selectors.push(selector)
      return {offsetHeight:8800,dataset:{navProgress:'.25'},getBoundingClientRect:()=>({top:1100})}
    }},'instant')
    assert.deepEqual(positions.pop(),{top:4000,behavior:'instant'})
  }
  assert.deepEqual(selectors,['[data-mobile-about-story]','[data-mobile-projects-story]'])
  window.innerHeight=600
  seek({id:'projects',dataset:{},querySelector:()=>({offsetHeight:8600,dataset:{navProgress:'0'},getBoundingClientRect:()=>({top:2100})})},'instant')
  assert.equal(positions.pop().top,3000)
})

test('mobile Skills uses its real in-runway anchor and reduced-motion sections retain natural navigation',()=>{
  const targets=[]
  const seek=scrollFunction({matchMedia:()=>({matches:false})})
  for(const id of ['skills','about','projects']){
    seek({id,dataset:{},querySelector:()=>null,scrollIntoView:options=>targets.push({id,...options})},'instant')
  }
  assert.deepEqual(targets,['skills','about','projects'].map(id=>({id,behavior:'instant',block:'start'})))
})

test('mobile navigation bounds invalid milestone data without scrolling past its runway',()=>{
  const positions=[],window={scrollY:100,innerHeight:800,matchMedia:()=>({matches:false}),scrollTo:value=>positions.push(value)}
  const seek=scrollFunction(window)
  for(const [value,expected] of [['bad',300],['-1',300],['2',2300]]){
    seek({id:'about',dataset:{},querySelector:()=>({offsetHeight:2800,dataset:{navProgress:value},getBoundingClientRect:()=>({top:200})})},'instant')
    assert.equal(positions.pop().top,expected)
  }
})
