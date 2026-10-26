const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),THREE=require('three')
const source=readFileSync(`${__dirname}/ProjectLaptopScene.js`,'utf8')
test('closed display clears the keyboard legends and its actual solid lid occludes them',()=>{
  const hinge=source.match(/ref=\{lidRef\} position=\{\[0, (-?[\d.]+), (-?[\d.]+)\]\}/)
  assert.ok(hinge)
  const y=Number(hinge[1]),angle=Math.PI/2
  const legend=source.match(/<mesh position=\{\[0, ([\d.]+), KEYBOARD_REAR/)
  const body=source.match(/<group position=\{\[0, (-?[\d.]+), 0.12\]\}/)
  const keyboardTop=Number(body[1])+Number(legend[1])
  const screenInside=y-Math.sin(angle)*.145
  assert.ok(screenInside>keyboardTop+.01,`closed screen must clear legends: ${screenInside} > ${keyboardTop}`)
  const start=source.indexOf('function makeRoundedPanelGeometry('),end=source.indexOf('\nfunction RoundedPanel',start)
  const factory=new Function('THREE',source.slice(start,end)+';return makeRoundedPanelGeometry')(THREE)
  const lidGeometry=factory(6.35,3.88,.18,.16),lid=new THREE.Mesh(lidGeometry,new THREE.MeshBasicMaterial()),pivot=new THREE.Group()
  lid.position.set(0,1.8,0);pivot.add(lid)
  pivot.position.set(0,y,Number(hinge[2]));pivot.rotation.x=angle;pivot.updateMatrixWorld(true)
  const ray=new THREE.Raycaster()
  for(const x of [-2,0,2])for(const z of [-1.1,-.3,.4]){
    ray.set(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0))
    const hits=ray.intersectObject(lid)
    assert.ok(hits.length&&hits[0].point.y>keyboardTop,'opaque lid blocks top-down keyboard view')
  }
  lidGeometry.dispose();lid.material.dispose()
})
