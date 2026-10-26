import * as THREE from 'three'

// Twelve irregular main discharges, each with two shorter branches. Ribbons
// carry glow width; the vertex shader animates them without per-frame uploads.
export function createContactChargeGeometry(){
  const positions=[],bolts=[],indices=[],segments=28
  for(let bolt=0;bolt<12;bolt++)for(let branch=0;branch<3;branch++){
    const start=positions.length/3
    for(let segment=0;segment<=segments;segment++)for(const side of [-1,1]){
      positions.push(segment/segments,side,0);bolts.push(bolt,branch)
    }
    for(let segment=0;segment<segments;segment++){
      const i=start+segment*2;indices.push(i,i+1,i+2,i+1,i+3,i+2)
    }
  }
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3))
  geometry.setAttribute('aBolt',new THREE.Float32BufferAttribute(bolts,2))
  geometry.setIndex(indices)
  return geometry
}
