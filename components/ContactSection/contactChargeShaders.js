export const CONTACT_CHARGE_VERTEX=/* glsl */ `
  attribute vec2 aBolt;
  uniform float uTime,uAspect,uRadius,uCharge,uGrowth;
  uniform vec2 uCenter;
  varying float vEdge,vAlong,vPulse;
  vec2 boltPoint(float t,float id){
    float angle=id*.5235988+sin(id*17.)*.15+sin(uTime*4.+id)*.09;
    vec2 axis=vec2(cos(angle),sin(angle)),side=vec2(-axis.y,axis.x);
    float jagged=sin(t*29.+id*12.+uTime*17.)*.11
      +sin(t*61.+id*7.-uTime*23.)*.045+sin(t*117.+uTime*31.+id)*.02;
    float radius=1.05+t*(1.5+.7*sin(id*3.));
    return axis*radius+side*(sin(t*5.+id)*.24+jagged)*smoothstep(0.,.15,t);
  }
  vec2 path(float t){
    float id=aBolt.x,branch=aBolt.y;
    if(branch<.5)return boltPoint(t,id);
    float start=.3+branch*.16;
    vec2 origin=boltPoint(start,id);
    vec2 tangent=normalize(boltPoint(start+.02,id)-origin);
    vec2 side=vec2(-tangent.y,tangent.x)*(branch<1.5?1.:-1.);
    return origin+(tangent*.4+side*.65)*t
      +side*sin(t*49.+uTime*21.+id)*.055*t;
  }
  void main(){
    float t=position.x;
    vec2 p=path(t),tangent=normalize(path(min(1.,t+.012))-path(max(0.,t-.012)));
    vec2 side=vec2(-tangent.y,tangent.x);
    p+=side*position.y*.12*(1.-t*.65);
    float phase=sin(uTime*(11.+mod(aBolt.x,3.))+aBolt.x*17.+aBolt.y*2.);
    vPulse=smoothstep(-.45,.35,phase)*(.55+uCharge*.45);
    vEdge=position.y;vAlong=t;
    p*=uRadius*(1.+uGrowth*.7);
    gl_Position=vec4(uCenter*2.-1.+vec2(p.x/uAspect,p.y),-.1,1.);
  }
`
export const CONTACT_CHARGE_FRAGMENT=/* glsl */ `
  precision highp float;
  uniform float uCharge;
  varying float vEdge,vAlong,vPulse;
  void main(){
    float core=exp(-abs(vEdge)*19.),glow=exp(-abs(vEdge)*3.2)*.3;
    float endFade=1.-smoothstep(.65,1.,vAlong);
    float alpha=(core+glow)*vPulse*endFade*uCharge;
    if(alpha<.004)discard;
    vec3 color=mix(vec3(1.,.16,.004),vec3(1.,.88,.43),core);
    gl_FragColor=vec4(color*(1.3+uCharge*1.6),min(1.,alpha));
    #include <colorspace_fragment>
  }
`

export const CONTACT_FOCAL_VERTEX=/* glsl */ `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`
export const CONTACT_FOCAL_FRAGMENT=/* glsl */ `
  precision highp float;
  uniform vec2 uCenter;
  uniform float uAspect,uFocal;
  varying vec2 vUv;
  void main(){
    vec2 q=(vUv-uCenter)*vec2(uAspect,1.);
    float r=length(q),width=.004+uFocal*.004;
    float core=exp(-r*r/(width*width));
    float haze=exp(-r*r/(width*width*10.))*.16;
    float alpha=(core*.5+haze)*uFocal;
    if(alpha<.002)discard;
    gl_FragColor=vec4(mix(vec3(.75,.13,.008),vec3(1.,.66,.2),core),alpha);
    #include <colorspace_fragment>
  }
`
