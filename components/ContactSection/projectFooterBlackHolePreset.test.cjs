const {test}=require('node:test')
const assert=require('node:assert/strict')
const {readFileSync}=require('node:fs')
const {mkdir,mkdtemp,readFile,readdir,rm}=require('node:fs/promises')
const {join,resolve,dirname,basename}=require('node:path')
const load=source=>import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const controlsURL=`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname,'blackHoleLabControls.js'),'utf8')).toString('base64')}`
const controls=import(controlsURL)
const store=load(readFileSync(join(__dirname,'../../lib/footerBlackHoleProjectStore.js'),'utf8').replace("'../components/ContactSection/blackHoleLabControls'",`'${controlsURL}'`))

test('JSON defaults are valid; temporary browser overrides take priority and clearing them restores the project',async()=>{
  const {parseLabPreset,LAB_DEFAULTS}=await controls
  const preset=JSON.parse(readFileSync(join(__dirname,'../../config/footer-blackhole-preset.json'),'utf8'))
  const project=parseLabPreset(JSON.stringify(preset))
  const projectURL=`data:text/javascript;base64,${Buffer.from(`export const FOOTER_PROJECT_DEFAULT=${JSON.stringify(project)}`).toString('base64')}`
  const browser=await load(readFileSync(join(__dirname,'footerBlackHolePreset.js'),'utf8')
    .replace("'./blackHoleLabControls'",`'${controlsURL}'`).replace("'./projectFooterBlackHolePreset'",`'${projectURL}'`))
  const prior=global.window,storage=new Map()
  global.window={localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},dispatchEvent:()=>{}}
  try{
    assert.deepEqual(browser.getFooterBlackHoleValues(),project)
    browser.applyFooterBlackHolePreset({...LAB_DEFAULTS,coreRadius:.7})
    assert.equal(browser.getFooterBlackHoleValues().coreRadius,.7)
    browser.restoreFooterBlackHoleDefaults()
    assert.deepEqual(browser.getFooterBlackHoleValues(),project)
    storage.set(browser.FOOTER_PRESET_KEY,'broken JSON')
    assert.deepEqual(browser.getFooterBlackHoleValues(),project)
  }finally{if(prior===undefined)delete global.window;else global.window=prior}
})

test('saving replaces the complete JSON atomically; invalid input preserves the previous file',async()=>{
  const {saveProjectFooterPreset:save}=await store
  const {LAB_DEFAULTS,LAB_PRESET_VERSION,parseLabPreset}=await controls
  const testRoot=resolve(__dirname,'../../artifacts')
  await mkdir(testRoot,{recursive:true})
  const directory=await mkdtemp(join(testRoot,'footer-preset-test-'))
  try{
    const first=await save(JSON.stringify({version:LAB_PRESET_VERSION,values:{...LAB_DEFAULTS,coreRadius:.7,noiseFactor:.025}}),directory)
    const path=join(directory,'footer-blackhole-preset.json'),text=await readFile(path,'utf8')
    assert.deepEqual(parseLabPreset(text),first.values)
    await assert.rejects(save('{invalid',directory))
    assert.equal(await readFile(path,'utf8'),text)
    await save(JSON.stringify({version:LAB_PRESET_VERSION,values:{...first.values,coreRadius:.8}}),directory)
    assert.equal(JSON.parse(await readFile(path,'utf8')).values.coreRadius,.8)
    assert.deepEqual(await readdir(directory),['footer-blackhole-preset.json'])
  }finally{
    assert.equal(dirname(resolve(directory)),testRoot)
    assert.ok(basename(directory).startsWith('footer-preset-test-'))
    await rm(directory,{recursive:true,force:true})
  }
})

test('the actual endpoint handler allows local development saves and blocks production, foreign origins and invalid requests',async()=>{
  const {createFooterPresetHandler:create}=await store
  let writes=0
  const save=async text=>{writes++;return JSON.parse(text)}
  const call=async(development,overrides={})=>{
    const request={method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000','x-black-hole-lab':'save-project-default'},body:{version:3,values:{coreRadius:.7}},...overrides}
    const response={headers:{},setHeader(key,value){this.headers[key]=value},status(code){this.code=code;return this},json(body){this.body=body;return this}}
    await create({development,save})(request,response)
    return response
  }
  assert.equal((await call(false)).code,404)
  assert.equal((await call(true,{method:'GET'})).code,405)
  assert.equal((await call(true,{headers:{host:'evil.example','x-black-hole-lab':'save-project-default'}})).code,403)
  assert.equal((await call(true,{headers:{host:'localhost:3000',origin:'https://evil.example','x-black-hole-lab':'save-project-default'}})).code,403)
  assert.equal((await call(true,{headers:{host:'localhost:3000'}})).code,403)
  assert.equal((await call(true,{body:{version:3,values:{coreRadius:999}}})).code,400)
  assert.equal(writes,0)
  assert.equal((await call(true)).code,200)
  assert.equal(writes,1)
})
