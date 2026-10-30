import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SKILLS_CHAPTERS, SKILLS_CHECKPOINTS } from './skillsExpeditionData'
import {mobileSkillFace,mobileFaceIconLayout} from './mobileSkillFaces'
import { clamp01, smooth, skillsHash as hash, skillsNoise as noise,
  skillsTerrainHeight, skillsTerrainBaseHeight, skillsTerrainHeightAtTravel,
  skillsTerrainBandHeight, skillsTerrainBuildDelay } from './skillsTerrainMath'

export { skillsTerrainHeight } from './skillsTerrainMath'

const SKY_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }
`
// The approved image supplies its detailed nebula structure. Very small authored
// flow vectors animate gas while bright stellar cores and dark voids stay fixed.
// Both sides of the physical laptop screen use this same material and clock.
const SKY_FRAGMENT = `
  uniform sampler2D uCosmos;
  uniform float uAspect, uImageAspect, uTravel, uCameraX, uReveal, uTime, uDim, uIntro;
  varying vec2 vUv;
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
      mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
  }
  float zone(vec2 p, vec2 center, vec2 radius) {
    vec2 local = (p - center) / radius;
    return exp(-dot(local, local) * 2.0);
  }
  vec3 flowing(vec2 uv, vec2 flow, float phase) {
    return texture2D(uCosmos, clamp(uv + flow * (phase - .5), .003, .997)).rgb;
  }
  void main() {
    vec2 cover = uAspect > uImageAspect ? vec2(1.0, uImageAspect / uAspect) : vec2(uAspect / uImageAspect, 1.0);
    vec2 uv = (vUv - .5) * cover * .97 + .5;
    uv.x += sin(uCameraX * .0016) * .011;
    vec3 fixedColor = texture2D(uCosmos, uv).rgb;
    float brightness = max(fixedColor.r, max(fixedColor.g, fixedColor.b));
    float gasMask = smoothstep(.012, .16, brightness) * (1.0 - smoothstep(.54, .87, brightness));
    vec2 vectors = vec2(.0018, .0007) * zone(uv, vec2(.73,.73),vec2(.35,.4))
      + vec2(-.0012,.0016) * zone(uv, vec2(.47,.48),vec2(.3,.27))
      + vec2(.0013,-.0008) * zone(uv, vec2(.17,.28),vec2(.35,.3));
    float fine = noise(uv * 12.0 + vec2(uTime * .007, -uTime * .004));
    vec2 flow = vectors * gasMask * (.75 + fine * .25);
    float phase = fract(uTime / 38.0);
    float phaseB = fract(phase + .5);
    float blend = abs(phase * 2.0 - 1.0);
    vec3 color = mix(flowing(uv, flow, phase), flowing(uv, flow, phaseB), blend);
    color = mix(fixedColor, color, gasMask);
    float illumination = sin(uTime * .13 + uv.x * 12.0 + noise(uv * 6.0) * 4.0);
    color *= 1.0 + illumination * gasMask * .075;
    float reading = 1.0 - .52 * uIntro * (1.0 - smoothstep(.08, .43, vUv.x)) * smoothstep(.43, .82, vUv.y);
    float vignette = 1.0 - smoothstep(.38, .96, length((vUv - .5) * vec2(1.0,.85))) * .26;
    color *= reading * vignette * mix(.035, .88, uReveal) * (1.0 - uDim * .32);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`
const STAR_VERTEX = `
  attribute float aSize, aBrightness, aParallax, aPhase, aKind;
  uniform float uCameraX, uTravel, uReveal, uTime, uDim;
  varying float vBrightness, vKind, vWarmth;
  void main() {
    vec3 p = position;
    float width = 430.0;
    p.x = mod(p.x - uCameraX * aParallax + width * .5, width) - width * .5 + uCameraX;
    p.y += sin(uTime * .09 + aPhase) * aParallax * .38;
    p.x += sin(uTime * .045 + aPhase * 1.7) * aParallax * .42;
    p.z = -280.0 + mod(p.z + 280.0 + uTravel * (55.0 + aParallax * 180.0), 290.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * 65.0 / max(-mv.z, 1.0), .7, aKind > 1.5 ? 24.0 : 2.8);
    float twinkle = .72 + sin(uTime * (.5 + fract(aPhase) * .8) + aPhase) * .18 + sin(uTime * 1.7 + aPhase * 3.0) * .07;
    vBrightness = aBrightness * uReveal * twinkle * (1.0 - uDim * .25);
    vKind = aKind; vWarmth = fract(aPhase * .713);
  }
`
const STAR_FRAGMENT = `
  varying float vBrightness, vKind, vWarmth;
  void main() {
    vec2 p = gl_PointCoord - .5;
    float core = exp(-dot(p,p) * 150.0), glow = exp(-dot(p,p) * 25.0);
    float ray = (exp(-abs(p.x) * 120.0) * exp(-abs(p.y) * 9.0)
      + exp(-abs(p.y) * 120.0) * exp(-abs(p.x) * 9.0)) * step(1.5,vKind);
    vec3 tint = mix(vec3(.48,.7,1),vec3(1,.85,.66),smoothstep(.78,1.0,vWarmth));
    gl_FragColor = vec4(mix(tint,vec3(1),core), (core + glow * .2 + ray * .35) * vBrightness);
    #include <colorspace_fragment>
  }
`
const FOG_VERTEX = `
  varying vec2 vUv; varying vec3 vWorld;
  void main() {
    vUv = uv; vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`
const FOG_FRAGMENT = `
  uniform float uFormation, uCameraX, uEnding;
  varying vec2 vUv; varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(12.9898,78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);
  }
  void main() {
    float cloud = noise(vWorld.xz * .14) * .6 + noise(vWorld.xz * .39) * .4;
    float edge = smoothstep(0.0,.12,vUv.x) * (1.0-smoothstep(.88,1.0,vUv.x)) *
      smoothstep(0.0,.15,vUv.y) * (1.0-smoothstep(.6,1.0,vUv.y));
    float distanceFade = 1.0-smoothstep(65.0,120.0,abs(vWorld.x-uCameraX));
    gl_FragColor=vec4(.025,.18,.36,pow(cloud,2.6)*edge*uFormation*.13*distanceFade*(1.0-uEnding*.7));
    #include <colorspace_fragment>
  }
`
const INSTANCE_VERTEX = `
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const INSTANCE_FRAGMENT = `
  uniform vec3 uColor; varying float vOpacity;
  void main() {
    if(vOpacity < .005) discard; gl_FragColor = vec4(uColor,vOpacity);
    #include <colorspace_fragment>
  }
`
function instancedGlow(geometry, count, color) {
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(count), 1)
  geometry.setAttribute('aOpacity', opacity)
  const material = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader: INSTANCE_VERTEX, fragmentShader: INSTANCE_FRAGMENT, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  opacity.setUsage(THREE.DynamicDrawUsage)
  return { mesh, opacity }
}

function createTerrainTile(start, end, zStart, zEnd, columns, rows, band) {
  const heightAt = (x,z) => skillsTerrainBandHeight(x,z,band)
  const count = columns * rows * 6
  const positions = new Float32Array(count * 3), normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3), centers = new Float32Array(count * 3)
  const offsets = new Float32Array(count * 3), delays = new Float32Array(count)
  const groundHeights = new Float32Array(count), chapterCenters = new Float32Array(count)
  const grid = Array.from({ length: (columns + 1) * (rows + 1) }, (_, index) => {
    const col = index % (columns + 1), row = Math.floor(index / (columns + 1))
    const x = start + col / columns * (end - start), z = zStart + row / rows * (zEnd - zStart)
    const e = .08
    const nx = heightAt(x-e,z)-heightAt(x+e,z), nz=heightAt(x,z-e)-heightAt(x,z+e)
    const length = Math.hypot(nx,e*2,nz)
    return { p:[x,heightAt(x,z),z], n:[nx/length,e*2/length,nz/length],
      groundHeight:skillsTerrainBandHeight(x,z,band,true),
      chapterCenter:Math.max(0,Math.min(4,Math.round((x-15)/88)))*88 }
  })
  let cursor = 0
  for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
    const corners=[grid[row*(columns+1)+col],grid[row*(columns+1)+col+1],
      grid[(row+1)*(columns+1)+col],grid[(row+1)*(columns+1)+col+1]]
    const ids=hash(col+start,row)>.5?[0,2,1,1,2,3]:[0,3,1,0,2,3]
    const chunkX=Math.floor(col/8),chunkZ=Math.floor(row/7)
    const cx=start+(Math.min(columns,chunkX*8+4)/columns)*(end-start)
    const cz=zStart+(Math.min(rows,chunkZ*7+3.5)/rows)*(zEnd-zStart)
    const cy=heightAt(cx,cz)
    // Neighboring groups share a reveal front. Hidden pieces are discarded,
    // so the whole destination mesh never flashes into view before assembly.
    const delay=skillsTerrainBuildDelay(cx,cz,zStart,zEnd,band)
    const ox=(hash(chunkX+start,chunkZ+52)-.5)*.55, oz=(hash(chunkX,chunkZ+47)-.5)*.45
    for(const id of ids) {
      const {p,n,groundHeight,chapterCenter}=corners[id]
      const stone=.82+noise(p[0]*.37,p[2]*.41)*.26
      const distant=band==='distant'?.78:band==='secondary'?.9:1
      positions.set(p,cursor*3); normals.set(n,cursor*3)
      colors.set([.023*stone*distant,.033*stone*distant,.045*stone*distant],cursor*3)
      centers.set([cx,cy,cz],cursor*3); offsets.set([ox,-5,oz],cursor*3);delays[cursor]=delay
      groundHeights[cursor]=groundHeight
      chapterCenters[cursor]=chapterCenter
      cursor++
    }
  }
  const geometry=new THREE.BufferGeometry()
  for(const [name,array,size] of [['position',positions,3],['normal',normals,3],['color',colors,3],
    ['aBuildCenter',centers,3],['aBuildOffset',offsets,3],['aBuildDelay',delays,1],
    ['aGroundHeight',groundHeights,1],['aChapterCenter',chapterCenters,1]])
    geometry.setAttribute(name,new THREE.BufferAttribute(array,size))
  geometry.computeBoundingBox(); geometry.boundingBox.min.y-=30
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=30
  return geometry
}

function createTerrainMaterial(uniforms) {
  const material=new THREE.MeshStandardMaterial({color:'#a8bac8',vertexColors:true,roughness:.86,metalness:.18})
  material.onBeforeCompile=shader=>{
    shader.uniforms.uFormation=uniforms.formation
    shader.uniforms.uCameraX=uniforms.cameraX
    shader.uniforms.uRoute=uniforms.route
    shader.vertexShader=`uniform float uFormation,uCameraX; varying vec3 vSkillsPosition; varying float vBuild;
      attribute vec3 aBuildCenter,aBuildOffset; attribute float aBuildDelay,aGroundHeight,aChapterCenter;
      ${shader.vertexShader}`.replace('#include <begin_vertex>',`
      float build=smoothstep(aBuildDelay,aBuildDelay+.2,uFormation);
      float discover=smoothstep(aChapterCenter-42.0,aChapterCenter-8.0,uCameraX);
      vec3 assembled=position;
      assembled.y=mix(aGroundHeight,position.y,discover);
      float angle=(1.0-build)*.065;
      vec3 relative=assembled-aBuildCenter;
      relative.yz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*relative.yz;
      vec3 transformed=aBuildCenter+relative*mix(.97,1.0,build)+aBuildOffset*(1.0-build);
      vBuild=build;
      vSkillsPosition=(modelMatrix*vec4(transformed,1.0)).xyz;`)
    shader.fragmentShader=`uniform float uRoute; varying vec3 vSkillsPosition; varying float vBuild;
      float skillsHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float skillsNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(skillsHash(i),skillsHash(i+vec3(1,0,0)),f.x),
          mix(skillsHash(i+vec3(0,1,0)),skillsHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(skillsHash(i+vec3(0,0,1)),skillsHash(i+vec3(1,0,1)),f.x),
          mix(skillsHash(i+vec3(0,1,1)),skillsHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      ${shader.fragmentShader}`.replace('#include <color_fragment>',`#include <color_fragment>
        if(vBuild<.012)discard;
        diffuseColor.rgb*=smoothstep(.012,.3,vBuild);
        float mineral=skillsNoise(vSkillsPosition*2.4);
        float cracks=pow(abs(skillsNoise(vSkillsPosition*.9+mineral)*2.0-1.0),1.7);
        diffuseColor.rgb*=(.62+mineral*.68)*(1.0-cracks*.48);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        float rockHeight=skillsNoise(vSkillsPosition*3.7)*.05+skillsNoise(vSkillsPosition*11.2)*.012;
        vec3 rockDx=dFdx(-vViewPosition),rockDy=dFdy(-vViewPosition);
        vec3 rockX=cross(rockDy,normal),rockY=cross(normal,rockDx);
        float rockDet=dot(rockDx,rockX);
        vec3 gradient=sign(rockDet)*(dFdx(rockHeight)*rockX+dFdy(rockHeight)*rockY);
        normal=normalize(abs(rockDet)*normal-gradient);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        float seam=pow(1.0-abs(skillsNoise(vSkillsPosition*.63)*2.0-1.0),18.0);
        totalEmissiveRadiance+=vec3(.0,.016,.032)*seam*uRoute*max(normal.y,.0)*smoothstep(.7,1.0,vBuild);`)
  }
  material.customProgramCacheKey=()=> 'skills-expedition-hybrid-terrain-v2'
  return material
}

function createTerrain(uniforms) {
  const group=new THREE.Group(), material=createTerrainMaterial(uniforms)
  // All four bands share their X lattice at a border. Matching only the
  // analytic height is insufficient: a coarse edge interpolates differently
  // from its finer neighbour and exposes triangular cracks between vertices.
  for(let tile=-2;tile<22;tile++) {
    const start=-144+tile*88,end=start+88
    for(const [z0,z1,rows,band] of [[-255,-150,18,'distant'],[-150,-88,28,'secondary'],[-88,-22,65,'primary'],[-22,28,52,'foreground']]) {
      if((band==='primary'||band==='foreground')&&(tile<0||tile>=20))continue
      const geometry=createTerrainTile(start,end,z0,z1,90,rows,band)
      group.add(new THREE.Mesh(geometry,material))
    }
  }
  return group
}

function createStars() {
  const count=2874,positions=[],sizes=[],brightness=[],parallax=[],phases=[],kinds=[]
  for(let index=0;index<count;index++) {
    const near=index<24,hero=index>=2842,middle=index<284
    const depth=near?THREE.MathUtils.lerp(-9,3,hash(index,1)):hero?THREE.MathUtils.lerp(-135,-65,hash(index,4)):
      middle?THREE.MathUtils.lerp(-95,-14,hash(index,2)):THREE.MathUtils.lerp(-270,-100,hash(index,3))
    const spread=near?56:middle?144:290
    positions.push((hash(index,7)-.5)*430,(hash(index,12)-.35)*spread*.75,depth)
    sizes.push(hero?18+hash(index,32)*17:near?.48+hash(index,32)*.4:middle?.9+hash(index,25)*1.1:1.1+hash(index,25)*1.6)
    brightness.push(hero?.8+hash(index,45)*.2:near?.14+hash(index,45)*.12:.25+hash(index,45)*.48)
    parallax.push(near?1.0:middle?.3:.055);phases.push(hash(index,73)*Math.PI*12);kinds.push(hero?2:near?1:0)
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1))
  geometry.setAttribute('aBrightness',new THREE.Float32BufferAttribute(brightness,1))
  geometry.setAttribute('aParallax',new THREE.Float32BufferAttribute(parallax,1))
  geometry.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1))
  geometry.setAttribute('aKind',new THREE.Float32BufferAttribute(kinds,1))
  const uniforms={uCameraX:{value:0},uTravel:{value:0},uReveal:{value:1},uTime:{value:0},uDim:{value:0}}
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:STAR_VERTEX,fragmentShader:STAR_FRAGMENT,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})
  const points=new THREE.Points(geometry,material);points.frustumCulled=false
  return {points,uniforms}
}

function createRocks() {
  const count=1080,geometry=new THREE.IcosahedronGeometry(1,1)
  const position=geometry.attributes.position
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i)
    const bump=.84+hash(Math.round(x*1000)+Math.round(z*173),Math.round(y*1000))*.25
    position.setXYZ(i,x*bump,y*bump,z*bump)
  }
  geometry.computeVertexNormals()
  const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({
    color:'#0b1b2b',roughness:.88,metalness:.22,flatShading:true}),count)
  mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  const bodies=Array.from({length:count},(_,i)=>{
    const x=i<760?THREE.MathUtils.lerp(-140,510,hash(i,156)):THREE.MathUtils.lerp(510,1530,hash(i,156))
    const z=THREE.MathUtils.lerp(-53,22,hash(i,93))
    const scale=.16+hash(i,29)**2*1.35
    return {x,z,y:skillsTerrainHeight(x,z)+scale*.13,
      scale:[scale*(1.3+hash(i,56)),scale*.6,scale],rotation:[hash(i,5)*.7,hash(i,9)*Math.PI,hash(i,15)*.5],
      delay:.55+smooth(z,-53,22)*.17+smooth(x,-115,10)*.06+noise(x*.05,z*.05)*.035}
  })
  return {mesh,bodies}
}

function createRoute() {
  const knots=[new THREE.Vector3(-123,0,-7),new THREE.Vector3(-91,0,-3),
    ...SKILLS_CHECKPOINTS.flatMap((p,index)=>[
      new THREE.Vector3(p.x-24,0,-3.5-Math.sin(index*1.7)*2.2),new THREE.Vector3(p.x,0,p.z),
      new THREE.Vector3(p.x+26,0,-8-Math.sin(index*1.3)*2.6)]),
    new THREE.Vector3(382,0,-4),new THREE.Vector3(417,0,-9),new THREE.Vector3(450,0,-6),new THREE.Vector3(505,0,-5),
    ...Array.from({length:15},(_,index)=>new THREE.Vector3(570+index*62,0,-5-Math.sin(index*.81)*3.8))]
  const spline=new THREE.CatmullRomCurve3(knots,false,'centripetal')
  // Sample the actual height function for every curve evaluation. Interpolating
  // already-grounded samples can cut through a sharp ridge between samples.
  const grounded=new THREE.Curve()
  grounded.getPoint=(t,target=new THREE.Vector3())=>{
    spline.getPoint(t,target);target.y=skillsTerrainBaseHeight(target.x,target.z)+.14;return target
  }
  const geometry=new THREE.TubeGeometry(grounded,5200,.065,4,false)
  const uniforms={uHead:{value:-123},uReveal:{value:0},uEnding:{value:0},uTime:{value:0}}
  const vertex=`varying vec3 vWorld; void main(){vWorld=(modelMatrix*vec4(position,1)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1);}`
  const fragment=`uniform float uHead,uReveal,uEnding,uTime;varying vec3 vWorld;
    void main(){
      float path=smoothstep(-124.0,-122.0,vWorld.x)*(1.0-smoothstep(uHead-.25,uHead+.75,vWorld.x))*uReveal;
      float pulse=exp(-pow((vWorld.x-uHead)*.52,2.0));
      float trail=exp(-max(0.0,uHead-vWorld.x)*.17);
      float shimmer=.85+.15*sin(vWorld.x*1.8-uTime*1.2);
      if(path<.005)discard;
      vec3 color=mix(vec3(.015,.55,.92),vec3(.9,.98,1),uEnding);
      gl_FragColor=vec4(color+vec3(.3,.35,.4)*pulse*(1.0+uEnding*2.5),path*(.15+trail*.5+pulse*.35)*shimmer);
      #include <colorspace_fragment>
    }`
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,
    depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})
  const mesh=new THREE.Mesh(geometry,material)
  const glowGeometry=new THREE.TubeGeometry(grounded,3600,.16,4,false)
  const glowMaterial=material.clone();glowMaterial.uniforms=uniforms
  const glow=new THREE.Mesh(glowGeometry,glowMaterial)
  return {mesh,glow,uniforms}
}

function createRelations() {
  const positions=[],chapterCoordinates=[]
  const pairs=[['html','css'],['css','tailwind'],['vue','nuxt'],['react','next'],['php','laravel'],['python','django']]
  for(const chapter of SKILLS_CHAPTERS)for(const [from,to] of pairs) {
    const a=chapter.markers.find(marker=>marker.id===from),b=chapter.markers.find(marker=>marker.id===to)
    if(!a||!b)continue
    const pointAt=t=>{
      const x=THREE.MathUtils.lerp(a.x,b.x,t),z=THREE.MathUtils.lerp(a.z,b.z,t)+Math.sin(t*Math.PI)*1.4
      return [x,skillsTerrainHeight(x,z)+.16,z]
    }
    for(let index=0;index<36;index++){
      positions.push(...pointAt(index/36),...pointAt((index+1)/36));chapterCoordinates.push(chapter.x,chapter.x)
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('aChapter',new THREE.Float32BufferAttribute(chapterCoordinates,1))
  const uniforms={uCameraX:{value:0},uReveal:{value:0}}
  const material=new THREE.ShaderMaterial({uniforms,
    vertexShader:`attribute float aChapter;varying float vChapter;void main(){vChapter=aChapter;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1);}`,
    fragmentShader:`uniform float uCameraX,uReveal;varying float vChapter;void main(){
      float opacity=(1.0-smoothstep(18.0,75.0,abs(uCameraX-vChapter)))*uReveal*.2;
      gl_FragColor=vec4(.015,.55,.9,opacity);
      #include <colorspace_fragment>
    }`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false})
  return {mesh:new THREE.LineSegments(geometry,material),uniforms}
}

function createMarkers() {
  const markers=SKILLS_CHAPTERS.flatMap(chapter=>chapter.markers.map((marker,index)=>({...marker,chapter:chapter.id,chapterX:chapter.x,
    activationOrder:index/Math.max(1,chapter.markers.length-1)})))
  // A beacon sits on the far shoulder rather than the tallest jagged tip. Its
  // caption stays in the open sky even on the particularly tall data mountain.
  const summitZ=-60
  const summitY=4.7+(17-summitZ)*Math.tan(Math.atan2(5.8,72)+Math.atan((1-.27*2)*Math.tan(THREE.MathUtils.degToRad(26))))
  const summits=SKILLS_CHAPTERS.map(chapter=>({id:chapter.id,chapter:chapter.id,chapterX:chapter.x,
    x:chapter.x+15,z:summitZ,lift:summitY-skillsTerrainHeight(chapter.x+15,summitZ)-.12}))
  const checkpoints=SKILLS_CHECKPOINTS.map((p,index)=>({...p,checkpointIndex:index,lift:5.2}))
  const entries=[...markers.map(p=>({...p,kind:'marker'})),...summits.map(p=>({...p,kind:'summit'})),
    ...checkpoints.map(p=>({...p,kind:'checkpoint'})),{id:'skills-ending',kind:'ending',x:400,z:-35,lift:16}]
  const beams=instancedGlow(new THREE.CylinderGeometry(.025,.045,1,5),entries.length,'#52bdff')
  const halos=instancedGlow(new THREE.CylinderGeometry(.115,.17,1,5),entries.length,'#1273d3')
  const points=instancedGlow(new THREE.SphereGeometry(.13,5,4),entries.length,'#a4edff')
  const rings=instancedGlow(new THREE.TorusGeometry(.48,.035,4,24),entries.length,'#59dfff')
  return {entries,beams,halos,points,rings,markers,summits,checkpoints}
}

function mobileMountainPoint(u,v) {
  const t=THREE.MathUtils.clamp((1.08-v)/.80,0,1)
  const left=.08+.82*Math.pow(t,1.1),right=1.52-.62*t
  const across=THREE.MathUtils.clamp((u-left)/Math.max(.001,right-left),0,1)
  // Sharp descending ridges and recessed gullies give the face real relief.
  // The silhouette stays fixed while the middle folds catch the cold key light.
  const mainRidge=Math.max(0,1-Math.abs(across-.32)*4.4)*1.48
  const sideRidge=Math.max(0,1-Math.abs(across-.72)*5.8)*.92
  const crags=Math.abs(Math.sin(across*16+t*8))*.24+Math.sin(t*37+across*21)*.11
  return [u-.5,.5-v,(mainRidge+sideRidge+crags)*Math.pow(1-t,.58)]
}

function createMobileMountain() {
  const positions=[],colors=[],rows=23,columns=13
  const vertices=[]
  for(let row=0;row<=rows;row++){
    const t=row/rows,v=1.08-t*.80
    const left=.08+.82*Math.pow(t,1.1),right=1.52-.62*t
    for(let col=0;col<=columns;col++){
      const edge=col===0||col===columns||row===0||row===rows
      const u=THREE.MathUtils.lerp(left,right,col/columns)+(edge?0:(hash(row,col)-.5)*.025)
      vertices.push(mobileMountainPoint(u,v+(edge?0:(hash(col,row+32)-.5)*.016)))
    }
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1
    const faces=(row+col)%2?[[a,c,b],[b,c,d]]:[[a,c,d],[a,d,b]]
    faces.forEach((triangle,index)=>{
      const t=(row+.5)/rows,across=(col+.5)/columns
      const shade=.62+hash(row*2+index,col)*.38
      const ridge=Math.max(0,1-Math.abs(across-.32)*4.4)
      const snow=THREE.MathUtils.clamp((t-.47)*1.45+ridge*.7+(hash(row+13,col)-.5)*.32,0,1)
      const icy=new THREE.Color('#477b90').lerp(new THREE.Color('#e7f4f3'),snow).multiplyScalar(shade)
      for(const id of triangle){positions.push(...vertices[id]);colors.push(icy.r,icy.g,icy.b)}
    })
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals()
  const material=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide,
    roughness:.94,metalness:.01,emissive:'#527c8b',emissiveIntensity:.12})
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false
  return {mesh,angle:0,lastFace:-1,lastTick:0}
}

function updateMobileMountain(world,motion,formation,time) {
  const mountain=world.mobileMountain
  if(!mountain)return
  const face=mobileSkillFace(motion.mobileFaceIndex??motion.chapterIndex)
  const targetAngle=face.pageIndex*.24+(Number(motion.mobileFaceTurn)||0)*.24
  const dt=Math.min(.06,Math.max(0,time-mountain.lastTick));mountain.lastTick=time
  mountain.angle+= (targetAngle-mountain.angle)*(1-Math.exp(-dt*11))
  const height=2*Math.tan(THREE.MathUtils.degToRad(world.camera.fov*.5))*20
  const width=height*world.camera.aspect
  mountain.mesh.scale.set(width,height,1)
  mountain.mesh.rotation.y=mountain.angle
  mountain.mesh.visible=formation>.001
  mountain.mesh.material.transparent=formation<.999
  mountain.mesh.material.opacity=formation
  mountain.mesh.updateMatrixWorld(true)
  const opacity=clamp01(motion.mobileFaceOpacity??1)*smooth(formation,.7,1)*(1-clamp01(motion.endingReveal))
  const locations=mobileFaceIconLayout(face.markerIds.length)
  const output={markers:[],summits:[],checkpoints:[],ending:{x:0,y:0,visible:false,opacity:0}}
  face.markerIds.forEach((id,index)=>{
    const [u,v]=locations[index]
    const point=mobileMountainPoint(u,v)
    world.projected.set(...point).applyMatrix4(mountain.mesh.matrixWorld).project(world.camera)
    const x=world.projected.x*.5+.5,y=.5-world.projected.y*.5
    output.markers.push({id,x,y,visible:opacity>.015&&x>.02&&x<.98&&y>.4&&y<.98,opacity})
  })
  motion.skillsProjection=output
  if(typeof window!=='undefined')window.dispatchEvent(new Event('skills:projection'))
}

function createWorld(mobile=false) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#01040b')
  scene.fog=new THREE.FogExp2('#050f21',.0058)
  const camera=new THREE.PerspectiveCamera(52,16/9,.1,390)
  const placeholder=new THREE.DataTexture(new Uint8Array([1,3,9,255]),1,1,THREE.RGBAFormat)
  placeholder.needsUpdate=true;placeholder.colorSpace=THREE.SRGBColorSpace
  const skyUniforms={uCosmos:{value:placeholder},uImageAspect:{value:16/9},uAspect:{value:16/9},
    uTravel:{value:0},uCameraX:{value:0},uReveal:{value:0},uTime:{value:0},uDim:{value:0},uIntro:{value:1}}
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:skyUniforms,
    vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT,depthWrite:false,depthTest:false,toneMapped:false}))
  sky.frustumCulled=false;sky.renderOrder=-1000;scene.add(sky)
  const uniforms={formation:{value:0},cameraX:{value:-70},route:{value:0}}
  const terrain=mobile?new THREE.Group():createTerrain(uniforms),stars=createStars(),rocks=createRocks(),route=createRoute(),markers=createMarkers(),relations=createRelations()
  scene.add(terrain,stars.points,rocks.mesh,route.mesh,route.glow,relations.mesh,
    markers.beams.mesh,markers.halos.mesh,markers.points.mesh,markers.rings.mesh)
  const mobileMountain=mobile?createMobileMountain():null
  if(mobileMountain){
    scene.add(mobileMountain.mesh)
    const iceKey=new THREE.DirectionalLight('#edfaff',2.25)
    iceKey.position.set(-7,12,16);scene.add(iceKey)
  }
  const ambient=new THREE.HemisphereLight('#667b94','#02040a',.85)
  const key=new THREE.DirectionalLight('#b2c8dc',1.8);key.position.set(-26,26,-25)
  const rim=new THREE.DirectionalLight('#219cff',2.25);rim.position.set(35,11,-65)
  const fill=new THREE.DirectionalLight('#566985',.5);fill.position.set(0,12,28)
  scene.add(ambient,key,rim,fill)
  const fogUniforms={uFormation:{value:0},uCameraX:{value:0},uEnding:{value:0}}
  const fogMaterial=new THREE.ShaderMaterial({uniforms:fogUniforms,vertexShader:FOG_VERTEX,fragmentShader:FOG_FRAGMENT,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})
  const fogs=[]
  for(let i=0;i<3;i++){
    const fog=new THREE.Mesh(new THREE.PlaneGeometry(180,120),fogMaterial)
    fog.rotation.x=-Math.PI/2;fog.position.set(0,1.4+i*.42,-54-i*6);fog.renderOrder=2;scene.add(fog);fogs.push(fog)
  }
  return {scene,camera,skyUniforms,uniforms,terrain,stars,rocks,route,markers,relations,fogUniforms,fogs,mobileMountain,
    placeholder,lights:[ambient,key,rim,fill],lightIntensities:[.85,1.8,2.25,.5],cosmosTexture:null,
    dummy:new THREE.Object3D(),projected:new THREE.Vector3()}
}

function disposeWorld(world) {
  const geometries=new Set(),materials=new Set()
  world.scene.traverse(object=>{if(object.geometry)geometries.add(object.geometry)
    if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material])materials.add(mat)})
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
  world.placeholder.dispose();world.cosmosTexture?.dispose()
}

function markerOpacity(entry,motion,cameraX,formation) {
  const built=smooth(formation,.83,1)
  if(entry.kind==='ending')return clamp01(motion.endingReveal)*built
  if(entry.kind==='checkpoint') {
    return built*(motion.checkpointIndex===entry.checkpointIndex?clamp01(motion.checkpointReveal):0)
  }
  const distance=Math.abs(cameraX-entry.chapterX)
  const quiet=1-smooth(distance,24,65)
  // Discovering a mountain is monotonic through a forward trip. Its lights
  // quiet by distance without ever making the physical mountain collapse.
  const activation=smooth(cameraX,entry.chapterX-35,entry.chapterX-5)*quiet
  const phase=entry.kind==='marker'
    ?smooth(activation,entry.activationOrder*.36,.64+entry.activationOrder*.36)
    :smooth(activation,.02,.55)
  return built*quiet*phase
}

function updateMarkers(world,motion,cameraX,formation) {
  const {markers,dummy,projected,camera}=world
  const output={markers:[],summits:[],checkpoints:[],ending:{x:0,y:0,visible:false,opacity:0}}
  markers.entries.forEach((entry,index)=>{
    const opacity=markerOpacity(entry,motion,cameraX,formation)
    const grow=smooth(opacity,.015,.55),ground=skillsTerrainHeightAtTravel(entry.x,entry.z,cameraX)+.12
    const beamHeight=entry.kind==='marker'?Math.max(5,entry.lift):entry.lift
    const lift=beamHeight*grow,top=ground+lift
    dummy.position.set(entry.x,ground+lift/2,entry.z);dummy.rotation.set(0,0,0);dummy.scale.set(1,Math.max(.001,lift),1);dummy.updateMatrix()
    markers.beams.mesh.setMatrixAt(index,dummy.matrix);markers.halos.mesh.setMatrixAt(index,dummy.matrix)
    markers.beams.opacity.setX(index,opacity*.74);markers.halos.opacity.setX(index,opacity*.07)
    dummy.position.set(entry.x,top,entry.z);dummy.scale.setScalar(entry.kind==='summit'?.8:.6);dummy.updateMatrix()
    markers.points.mesh.setMatrixAt(index,dummy.matrix);markers.points.opacity.setX(index,opacity)
    dummy.position.set(entry.x,ground+.015,entry.z);dummy.rotation.set(-Math.PI/2,0,0)
    const ending=clamp01(motion.endingReveal)
    dummy.scale.setScalar(entry.kind==='ending'?1+ending*18:entry.kind==='checkpoint'?1.3:.58);dummy.updateMatrix()
    markers.rings.mesh.setMatrixAt(index,dummy.matrix)
    markers.rings.opacity.setX(index,entry.kind==='ending'?Math.sin(ending*Math.PI)*.16:opacity*.7)
    projected.set(entry.x,top,entry.z).project(camera)
    const x=projected.x*.5+.5,y=.5-projected.y*.5
    const labelOpacity=entry.kind==='marker'?smooth(opacity,.3,.86):opacity
    const overscan=entry.kind==='ending'?.7:.28
    const item={id:entry.id,x,y,visible:labelOpacity>.015&&projected.z>-1&&projected.z<1&&x>-overscan&&x<1+overscan&&y>-.12&&y<1.08,opacity:labelOpacity}
    if(entry.kind==='ending')output.ending=item
    else output[entry.kind==='marker'?'markers':entry.kind==='summit'?'summits':'checkpoints'].push(item)
  })
  for(const kind of ['beams','halos','points','rings']){
    markers[kind].mesh.instanceMatrix.needsUpdate=true;markers[kind].opacity.needsUpdate=true
  }
  motion.skillsProjection=output
  if(typeof window!=='undefined')window.dispatchEvent(new Event('skills:projection'))
}

/** One shared hybrid world supplies the real laptop screen and the viewport. */
export default function SkillsWorld({motionRef,textureRef,active=true}) {
  const {gl,size,invalidate}=useThree()
  const world=useMemo(()=>createWorld(Boolean(motionRef.current?.mobile)),[motionRef])
  const resources=useMemo(()=>({target:new THREE.WebGLRenderTarget(16,9,{depthBuffer:true,stencilBuffer:false,
    type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:false}),
    viewport:new THREE.Vector4(),scissor:new THREE.Vector4(),clearColor:new THREE.Color(),width:0,height:0,key:''}),[])
  useEffect(()=>{
    // React's strict development effects immediately clean up and remount the
    // same memoized objects. Defer disposal by one microtask so this remount
    // retains its render-target allocation; actual unmounts still free it.
    const worldEpoch=(world.effectEpoch||0)+1,resourceEpoch=(resources.effectEpoch||0)+1
    world.effectEpoch=worldEpoch;resources.effectEpoch=resourceEpoch
    textureRef.current=resources.target.texture;resources.key='';invalidate()
    return()=>{queueMicrotask(()=>{
      if(world.effectEpoch===worldEpoch)disposeWorld(world)
      if(resources.effectEpoch===resourceEpoch){
        if(textureRef.current===resources.target.texture)textureRef.current=null
        resources.target.dispose();resources.width=0;resources.key=''
      }
    })}
  },[invalidate,resources,textureRef,world])

  useEffect(()=>{
    let cancelled=false
    const loader=new THREE.TextureLoader()
    loader.load('/cosmic-background-original.png',texture=>{
      if(cancelled){texture.dispose();return}
      texture.colorSpace=THREE.SRGBColorSpace
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter
      texture.anisotropy=Math.min(4,gl.capabilities.getMaxAnisotropy())
      world.cosmosTexture?.dispose();world.cosmosTexture=texture
      world.skyUniforms.uCosmos.value=texture
      world.skyUniforms.uImageAspect.value=texture.image.width/texture.image.height
      resources.key='';invalidate()
    })
    return()=>{cancelled=true}
  },[gl,invalidate,resources,world])

  useEffect(()=>{
    if(!active)return undefined
    // Demand rendering stays idle outside the visible cosmos. Cosmetic motion
    // runs at 30fps; geometry and DOM anchors only update when scroll changes.
    const timer=setInterval(()=>{
      const motion=motionRef.current||{}
      if(motion.cosmosReveal>.005&&clamp01(motion.servicesReveal)<.999)invalidate()
    },1000/30)
    return()=>clearInterval(timer)
  },[active,invalidate,motionRef])

  useFrame(state=>{
    if(!active)return
    const motion=motionRef.current||{},travel=clamp01(motion.worldTravel),formation=clamp01(motion.terrainFormation)
    const cameraX=Number.isFinite(motion.expeditionTravel)?motion.expeditionTravel:-70
    const progress=clamp01(motion.expeditionProgress)
    const fullscreen=motion.portalOpacity>=.999&&motion.worldExpand>=.999
    const scale=Math.min(1.2,gl.getPixelRatio(),1500/Math.max(1,size.width,size.height))
    const width=Math.max(1,Math.round(size.width*scale)),height=Math.max(1,Math.round(size.height*scale))
    const tick=Math.floor(state.clock.elapsedTime*30),time=tick/30
    world.skyUniforms.uTime.value=time;world.stars.uniforms.uTime.value=time;world.route.uniforms.uTime.value=time
    const key=[width,height,travel,formation,cameraX,progress,motion.chapterIndex,motion.chapterActivation,
      motion.routeHead,motion.routeReveal,motion.checkpointIndex,motion.checkpointReveal,motion.checkpointDim,
      motion.endingReveal,motion.exitLight,motion.cosmosReveal,motion.introHold,motion.introMorph,motion.mobileFaceIndex,motion.mobileFaceTurn,motion.mobileFaceOpacity,fullscreen].join('|')
    const changed=resources.key!==key
    if(!changed&&resources.tick===tick)return
    resources.tick=tick
    resources.key=key
    if(resources.width!==width||resources.height!==height)resources.target.setSize(width,height)
    resources.width=width;resources.height=height;textureRef.current=resources.target.texture
    if(changed){
    world.camera.aspect=width/height
    // Preserve the mountain's horizontal room on tall desktop windows.
    world.camera.fov=motion.mobile?40:THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(52)/2)*Math.max(1,(16/9)/world.camera.aspect)))
    if(motion.mobile){world.camera.position.set(0,0,20);world.camera.lookAt(0,0,0)}
    else {world.camera.position.set(cameraX+8+THREE.MathUtils.lerp(.25,0,travel),4.7,THREE.MathUtils.lerp(31,17,travel));world.camera.lookAt(cameraX+8,10.5,-55)}
    world.camera.updateProjectionMatrix();world.camera.updateMatrixWorld()
    world.skyUniforms.uAspect.value=width/height;world.skyUniforms.uTravel.value=travel
    world.skyUniforms.uCameraX.value=cameraX;world.skyUniforms.uReveal.value=smooth(clamp01(motion.cosmosReveal),0,.85)
    world.skyUniforms.uDim.value=clamp01(motion.checkpointDim)
    world.skyUniforms.uIntro.value=clamp01(motion.introHold)*(1-clamp01(motion.introMorph)*.45)
    world.stars.uniforms.uCameraX.value=motion.mobile?0:cameraX;world.stars.uniforms.uTravel.value=travel
    world.stars.uniforms.uReveal.value=smooth(clamp01(motion.cosmosReveal),0,.7)
    world.stars.uniforms.uDim.value=clamp01(motion.checkpointDim)
    world.uniforms.formation.value=formation;world.uniforms.cameraX.value=cameraX
    world.uniforms.route.value=clamp01(motion.routeReveal)
    world.terrain.visible=!motion.mobile&&formation>.001
    world.fogUniforms.uFormation.value=smooth(formation,.14,.9);world.fogUniforms.uCameraX.value=cameraX
    world.fogUniforms.uEnding.value=0;world.fogs.forEach(fog=>{fog.position.x=cameraX;fog.visible=!motion.mobile})
    world.route.mesh.visible=world.route.glow.visible=world.relations.mesh.visible=!motion.mobile
    for(const kind of ['beams','halos','points','rings'])world.markers[kind].mesh.visible=!motion.mobile
    world.lights.forEach((light,index)=>{light.intensity=world.lightIntensities[index]*(1-clamp01(motion.checkpointDim)*.34)})
    world.route.uniforms.uHead.value=Number.isFinite(motion.routeHead)?motion.routeHead:0
    world.route.uniforms.uReveal.value=clamp01(motion.routeReveal)*smooth(formation,.8,1)
    world.route.uniforms.uEnding.value=clamp01(motion.exitLight)
    world.relations.uniforms.uCameraX.value=cameraX
    world.relations.uniforms.uReveal.value=smooth(formation,.85,1)*clamp01(motion.chapterActivation)
    world.rocks.mesh.visible=!motion.mobile&&formation>.5
    if(world.rocks.mesh.visible){
      const {mesh,bodies}=world.rocks,{dummy}=world
      bodies.forEach((body,index)=>{
        const build=smooth(formation,body.delay,body.delay+.2)
        const ground=skillsTerrainHeightAtTravel(body.x,body.z,cameraX)
        dummy.position.set(body.x,ground+body.scale[1]*.22-(1-build)*2,body.z)
        dummy.rotation.set(body.rotation[0]+(1-build)*.15,body.rotation[1],body.rotation[2])
        dummy.scale.set(...body.scale.map(v=>v*build));dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix)
      });mesh.instanceMatrix.needsUpdate=true
    }
    if(!motion.mobile)updateMarkers(world,motion,cameraX,formation)
    }
    if(motion.mobile)updateMobileMountain(world,motion,formation,time)
    // Once the screen boundary has gone, the same scene renders directly to
    // the viewport. Returning below full expansion refreshes the shared target
    // before the laptop's physical screen needs to sample it again.
    if(fullscreen)return
    const previousTarget=gl.getRenderTarget(),previousAutoClear=gl.autoClear,previousScissorTest=gl.getScissorTest(),previousClearAlpha=gl.getClearAlpha()
    gl.getViewport(resources.viewport);gl.getScissor(resources.scissor);gl.getClearColor(resources.clearColor)
    try{
      gl.setRenderTarget(resources.target);gl.setScissorTest(false);gl.autoClear=true;gl.setClearColor('#01040b',1)
      gl.render(world.scene,world.camera)
      gl.domElement.dataset.skillsProcedural='hybrid'
      gl.domElement.dataset.skillsWorldX=cameraX.toFixed(3)
      gl.domElement.dataset.skillsTerrainBands='4'
      gl.domElement.dataset.skillsDrawCalls=String(gl.info.render.calls)
      gl.domElement.dataset.skillsTriangles=String(gl.info.render.triangles)
    }finally{
      gl.setRenderTarget(previousTarget);gl.setViewport(resources.viewport);gl.setScissor(resources.scissor)
      gl.setScissorTest(previousScissorTest);gl.setClearColor(resources.clearColor,previousClearAlpha);gl.autoClear=previousAutoClear
    }
  },-10)

  // Own the final render so the main scene cannot clear a directly rendered
  // universe later in the frame. While entering or leaving the screen, this is
  // exactly the normal R3F scene render with the shared target on its display.
  useFrame(state=>{
    const motion=motionRef.current||{}
    const fullscreen=active&&motion.portalOpacity>=.999&&motion.worldExpand>=.999
    gl.setRenderTarget(null)
    gl.setViewport(0,0,state.size.width,state.size.height)
    gl.setScissorTest(false)
    if(fullscreen){
      gl.render(world.scene,world.camera)
      gl.domElement.dataset.skillsProcedural='hybrid'
      gl.domElement.dataset.skillsWorldX=(Number.isFinite(motion.expeditionTravel)?motion.expeditionTravel:-70).toFixed(3)
      gl.domElement.dataset.skillsTerrainBands='4'
      gl.domElement.dataset.skillsDrawCalls=String(gl.info.render.calls)
      gl.domElement.dataset.skillsTriangles=String(gl.info.render.triangles)
    }else gl.render(state.scene,state.camera)
  },1)
  return null
}
