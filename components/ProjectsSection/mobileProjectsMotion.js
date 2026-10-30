import {sampleProjectsSkillsStory} from './projectStoryMotion'
import {MOBILE_SKILL_FACES} from '../SkillsSection/mobileSkillFaces'

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const smooth = (value, start, end) => { const t = clamp((value-start)/(end-start)); return t*t*(3-2*t) }
export function mobileProjectsLayout(count = 4) {
  const projects = 180 + Math.max(1,count)*190
  const portal = 220, mountains = 1400, ending = 200, exit = 120
  const distance = projects+portal+mountains+ending+exit
  return {distance,height:distance+100,projects,portal,mountains,ending,exit,skillsStart:(projects+portal)/distance}
}
export function mobileProjectStop(index,count=4) {
  const layout=mobileProjectsLayout(count)
  return (180+(Math.max(0,Math.min(count-1,index))+.5)*190)/layout.distance
}
export function mobileSkillFaceStop(index,count=4) {
  const layout=mobileProjectsLayout(count)
  return (layout.projects+layout.portal+(Math.max(0,Math.min(MOBILE_SKILL_FACES.length-1,index))+.5)*layout.mountains/MOBILE_SKILL_FACES.length)/layout.distance
}
export function sampleMobileProjects(progress,count=4,compact=false,output={}) {
  const p=clamp(progress),layout=mobileProjectsLayout(count),at=p*layout.distance
  sampleProjectsSkillsStory(0,count,output)
  const projectTravel=clamp((at-180)/(count*190))*count
  const index=Math.min(count-1,Math.floor(projectTravel)),local=projectTravel-index
  const portal=clamp((at-layout.projects)/layout.portal)
  const expedition=clamp((at-layout.projects-layout.portal)/layout.mountains)
  const ending=clamp((at-layout.projects-layout.portal-layout.mountains)/layout.ending)
  const exit=clamp((at-layout.distance+layout.exit)/layout.exit)
  const title=smooth(at,0,100)
  const entry=smooth(at,90,175),copy=smooth(at,160,200)*(1-smooth(portal,0,.16))
  output.mobile=true;output.progress=p;output.titlePosition=title;output.titleOpacity=1-smooth(portal,0,.22)
  output.laptopX=.5;output.laptopY=(compact?.29:.33)+(.52-(compact?.29:.33))*smooth(portal,.17,.45)
  output.laptopWidth=(compact?.8:.91);output.laptopOpacity=entry*(1-smooth(portal,.7,.72))
  output.laptopRotationX=.10;output.laptopRotationY=-.24*(1-smooth(portal,.22,.46));output.laptopRotationZ=.03*(1-smooth(portal,.22,.46))
  output.lidOpen=smooth(at,115,175);output.screenPower=smooth(at,155,190)
  output.projectIndex=index;output.projectProgress=.75;output.screenCurrentIndex=index;output.screenNextIndex=index
  output.screenMix=0;output.screenTransition=0;output.copyOpacity=copy;output.copyExit=0
  const boundary=Math.round(projectTravel),half=.12
  if(boundary>0&&boundary<count&&Math.abs(projectTravel-boundary)<half){
    const blend=smooth(projectTravel,boundary-half,boundary+half)
    output.screenCurrentIndex=boundary-1;output.screenNextIndex=boundary
    output.screenMix=blend;output.screenTransition=Math.sin(blend*Math.PI)
  }
  const copyHold=smooth(local,0,.1)*(index===count-1?1:1-smooth(local,.9,1))
  output.copyOpacity*=copyHold
  output.screenExit=smooth(portal,.04,.18);output.cosmosReveal=smooth(portal,.15,.3)
  output.screenCenterAlignment=smooth(portal,.28,.48);output.portalDolly=smooth(portal,.48,.68)
  const face=smooth(portal,.22,.46),front=-Math.atan2(2.02,10.2)+.09
  output.laptopRotationX+=(front-output.laptopRotationX)*face
  output.portalOpacity=smooth(portal,.69,.72);output.worldExpand=smooth(portal,.72,.82)
  output.worldTravel=smooth(portal,.72,.96);output.terrainFormation=smooth(portal,.85,1)
  output.skillsProgress=portal;output.skillsReveal=smooth(portal,.9,1)
  output.skillsIntroOpacity=output.skillsReveal*(1-smooth(ending,0,.4));output.introHold=1;output.introMorph=0
  const faceTravel=expedition*MOBILE_SKILL_FACES.length
  const faceIndex=Math.min(MOBILE_SKILL_FACES.length-1,Math.floor(faceTravel))
  const faceLocal=faceTravel-faceIndex
  const skillFace=MOBILE_SKILL_FACES[faceIndex]
  output.mobileFaceIndex=faceIndex
  output.mobileFaceTurn=smooth(faceLocal,.8,1)
  output.mobileFaceOpacity=smooth(faceLocal,0,.12)*(1-smooth(faceLocal,.88,1))
  output.expeditionProgress=expedition;output.expeditionTravel=skillFace.chapterIndex*88
  output.chapterIndex=skillFace.chapterIndex
  output.chapterActivation=1;output.routeReveal=0;output.routeHead=output.expeditionTravel
  output.checkpointIndex=-1;output.checkpointReveal=0;output.checkpointDim=0
  output.endingReveal=smooth(ending,0,.35);output.whiteout=smooth(exit,0,.45)*(1-smooth(exit,.65,1))
  output.mobileBlackout=smooth(exit,.65,1);output.exitLight=0;output.servicesReveal=0
  output.skillsContentOpacity=output.skillsReveal*(1-smooth(ending,0,.4));output.terrainDissolve=0
  output.dotOpacity=entry*(1-smooth(portal,0,.3));output.active=true
  output.projectLocal=local
  return output
}
