import * as THREE from 'three'
import {MeshSurfaceSampler} from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import {SERVICE_TEXT_PITCH,SERVICE_TEXT_YAW} from './serviceTextGeometry'

export const SERVICE_PARTICLE_COUNT = 90000
export const serviceRandom = seed => {
  const value=Math.sin(seed*127.1+311.7)*43758.5453
  return value-Math.floor(value)
}

export function createServiceParticleGeometries(geometries,words,total=SERVICE_PARTICLE_COUNT) {
  let iteration=0
  const random=()=>serviceRandom(++iteration+2709)
  const triangle=new THREE.Triangle(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3()
  const areas=geometries.map(geometry=>{
    let area=0
    const p=geometry.getAttribute('position')
    for(let i=0;i<p.count;i+=3){
      a.fromBufferAttribute(p,i); b.fromBufferAttribute(p,i+1); c.fromBufferAttribute(p,i+2)
      area+=triangle.set(a,b,c).getArea()
    }
    return area
  })
  const totalArea=areas.reduce((sum,area)=>sum+area,0)
  const samplers=geometries.map(geometry=>new MeshSurfaceSampler(new THREE.Mesh(geometry)).setRandomGenerator(random).build())
  const rotations=words.map(word=>new THREE.Quaternion().setFromEuler(new THREE.Euler(SERVICE_TEXT_PITCH,SERVICE_TEXT_YAW,word.tilt)))
  const translations=words.map(word=>new THREE.Vector3(...word.position))
  const point=new THREE.Vector3(),normal=new THREE.Vector3(),color=new THREE.Color(),glyph=new THREE.Vector2()
  const world=new THREE.Vector3(),worldNormal=new THREE.Vector3()
  const count=Math.floor(total/5), gridX=64, gridY=Math.ceil(count/gridX)
  return Array.from({length:5},(_,column)=>{
    const position=[],local=[],normals=[],colors=[],glyphs=[],seeds=[],target=[]
    for(let index=0;index<count;index++){
      let roll=random()*totalArea,wordIndex=0
      while(wordIndex<areas.length-1&&roll>areas[wordIndex])roll-=areas[wordIndex++]
      samplers[wordIndex].sample(point,normal,color,glyph)
      world.copy(point).applyQuaternion(rotations[wordIndex]).add(translations[wordIndex])
      worldNormal.copy(normal).applyQuaternion(rotations[wordIndex])
      position.push(world.x,world.y,world.z); local.push(point.x,point.y,point.z)
      normals.push(worldNormal.x,worldNormal.y,worldNormal.z)
      colors.push(color.r,color.g,color.b); glyphs.push(Math.round(glyph.x),glyph.y)
      seeds.push(random(),random(),random(),random())
      // A spatially distributed prefix allows adaptive draw counts without
      // removing a letter or leaving half a destination column unpopulated.
      const cell=(index*7919+column*1217)%(gridX*gridY)
      target.push((cell%gridX+random())/gridX,(Math.floor(cell/gridX)+random())/gridY)
    }
    const geometry=new THREE.BufferGeometry()
    for(const [name,data,itemSize] of [['position',position,3],['aLocal',local,3],
      ['aNormal',normals,3],['color',colors,3],['aGlyphData',glyphs,2],
      ['aSeed',seeds,4],['aTargetUv',target,2]]) {
      geometry.setAttribute(name,new THREE.Float32BufferAttribute(data,itemSize))
    }
    return geometry
  })
}

// Camera-aligned plane at a fixed distance. This remains correct on resized
// canvases and during camera travel; no hand-tuned column world coordinates.
export function setServiceTargetFrame(camera,rect,origin,right,up) {
  const distance=camera.position.z
  const halfHeight=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*distance
  const halfWidth=halfHeight*camera.aspect
  camera.updateMatrixWorld()
  origin.set(rect[0]*halfWidth,rect[1]*halfHeight,-distance).applyMatrix4(camera.matrixWorld)
  right.set(rect[2]*halfWidth,0,0).applyQuaternion(camera.quaternion)
  up.set(0,rect[3]*halfHeight,0).applyQuaternion(camera.quaternion)
}
