import {mkdir,writeFile,rename,unlink} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {LAB_PRESET_VERSION,parseLabPreset} from '../components/ContactSection/blackHoleLabControls'

export async function saveProjectFooterPreset(text,directory=path.join(process.cwd(),'config')){
  const values=parseLabPreset(text)
  const preset={version:LAB_PRESET_VERSION,values}
  await mkdir(directory,{recursive:true})
  const temporary=path.join(directory,`.footer-blackhole-${randomUUID()}.tmp`)
  try{
    await writeFile(temporary,JSON.stringify(preset,null,2)+'\n',{encoding:'utf8',flag:'wx'})
    await rename(temporary,path.join(directory,'footer-blackhole-preset.json'))
  }finally{await unlink(temporary).catch(()=>{})}
  return preset
}

export function createFooterPresetHandler({development,save=saveProjectFooterPreset}){
  return async function handler(request,response){
    response.setHeader('Cache-Control','no-store')
    if(!development)return response.status(404).json({error:'Not found'})
    if(request.method!=='POST'){
      response.setHeader('Allow','POST')
      return response.status(405).json({error:'Method not allowed'})
    }
    const host=request.headers.host||''
    let hostname
    try{hostname=new URL(`http://${host}`).hostname}catch{}
    let sameOrigin=!request.headers.origin
    try{if(request.headers.origin){const origin=new URL(request.headers.origin);sameOrigin=['http:','https:'].includes(origin.protocol)&&origin.host===host}}catch{}
    if(!['localhost','127.0.0.1','[::1]'].includes(hostname)||!sameOrigin||request.headers['x-black-hole-lab']!=='save-project-default'){
      return response.status(403).json({error:'Save project defaults from the local black-hole lab.'})
    }
    let text
    try{text=JSON.stringify(request.body);parseLabPreset(text)}catch(error){return response.status(400).json({error:error.message||'Invalid preset'})}
    try{return response.status(200).json(await save(text))}
    catch{return response.status(500).json({error:'Could not write the project preset. Your previous default is retained.'})}
  }
}
