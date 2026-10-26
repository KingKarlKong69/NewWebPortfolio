// The same continuous erosion field drives solid fragments and sampled points.
// Glyph rank supplies reading order; local X/noise roughens only the live front.
export const SERVICE_EROSION_GLSL = /* glsl */ `
  float serviceHash(vec3 p) {
    p=fract(p*.1031); p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }
  float serviceNoise(vec3 p) {
    vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(mix(serviceHash(i),serviceHash(i+vec3(1,0,0)),f.x),
      mix(serviceHash(i+vec3(0,1,0)),serviceHash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(serviceHash(i+vec3(0,0,1)),serviceHash(i+vec3(1,0,1)),f.x),
      mix(serviceHash(i+vec3(0,1,1)),serviceHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float serviceRelease(vec2 glyph,vec3 localPosition) {
    return (glyph.x+glyph.y*.58+serviceNoise(localPosition*12.)*.20+.05)*.09;
  }
`

export const SERVICE_FORMATION_GLSL = /* glsl */ `
  float serviceFormation(vec2 uv) {
    return .12+.72*serviceNoise(vec3(uv*vec2(7.,15.),37.));
  }
  float serviceArrival(float gather,vec2 uv) {
    if(gather<=0.)return 0.;
    if(gather>=1.)return 1.;
    float start=serviceFormation(uv)*.35;
    return smoothstep(start,start+.35,gather);
  }
  float serviceSolid(float gather,float consolidation,vec2 uv) {
    if(consolidation<=.2)return 0.;
    if(consolidation>=1.&&gather>=1.)return 1.;
    float wholeColumn=smoothstep(.2,1.,consolidation);
    float micrograin=serviceNoise(vec3(uv*320.,17.))*.12;
    return smoothstep(.9,1.,serviceArrival(gather,uv))
      *smoothstep(micrograin,.86+micrograin,wholeColumn);
  }
`

export const SERVICE_FLOW_GLSL = /* glsl */ `
  uniform vec3 uRoutePoints[9];
  uniform vec3 uFlowOrigin,uFlowRight,uFlowUp,uFlowDepth;
  vec3 serviceRoute(float progress) {
    float along=clamp(progress,0.,1.)*8.;
    int segment=int(min(7.,floor(along)));
    float t=along-float(segment);
    int before=segment>0?segment-1:0;
    int after=segment<6?segment+2:8;
    vec3 a=uRoutePoints[before],b=uRoutePoints[segment];
    vec3 c=uRoutePoints[segment+1],d=uRoutePoints[after];
    vec3 p=.5*((2.*b)+(-a+c)*t+(2.*a-5.*b+4.*c-d)*t*t
      +(-a+3.*b-3.*c+d)*t*t*t);
    return uFlowOrigin+uFlowRight*p.x+uFlowUp*p.y+uFlowDepth*p.z;
  }
  float serviceGaussian(float a,float b) {
    return clamp(sqrt(-2.*log(max(a,.0001)))*cos(b*6.2831853),-3.,3.);
  }
  vec3 serviceDrift(vec4 seed,float phase) {
    return vec3(sin(phase+seed.x*6.283)+.35*sin(phase*3.+seed.z*6.283),
      cos(phase*2.+seed.y*6.283)+.3*sin(phase+seed.w*6.283),
      sin(phase+seed.z*6.283)+.4*cos(phase*2.+seed.x*6.283));
  }
`

const IMAGE_GLSL = /* glsl */ `
  uniform sampler2D uImage;
  uniform vec2 uCoverScale,uRectPixels;
  vec3 serviceToSRGB(vec3 value) {
    return mix(value*12.92,1.055*pow(max(value,vec3(0)),vec3(1./2.4))-.055,
      step(vec3(.0031308),value));
  }
  vec3 serviceToLinear(vec3 value) {
    return mix(value/12.92,pow((value+.055)/1.055,vec3(2.4)),step(vec3(.04045),value));
  }
  vec3 serviceImage(vec2 uv) {
    vec2 mapped=.5+(uv-.5)*uCoverScale;
    vec2 blur=1.4*uCoverScale/max(uRectPixels,vec2(1.));
    vec3 color=texture2D(uImage,mapped).rgb*.4;
    color+=(texture2D(uImage,mapped+vec2(blur.x,0)).rgb
      +texture2D(uImage,mapped-vec2(blur.x,0)).rgb
      +texture2D(uImage,mapped+vec2(0,blur.y)).rgb
      +texture2D(uImage,mapped-vec2(0,blur.y)).rgb)*.15;
    // Match the DOM artwork's display-space brightness/saturation and shade.
    color=serviceToSRGB(color)*.32;
    color=mix(vec3(dot(color,vec3(.2126,.7152,.0722))),color,.6);
    color*=1.-.6*clamp(1.-uv.y/.42,0.,1.);
    return serviceToLinear(color);
  }
`

export const SERVICE_DUST_VERTEX = /* glsl */ `
  attribute vec3 aLocal,aNormal;
  attribute vec2 aGlyphData,aTargetUv;
  attribute vec4 aSeed;
  uniform float uDissolve,uSpiral,uGather,uSolid,uHandoff,uDpr;
  uniform float uIdlePhase,uRouteProgress,uColumn;
  uniform float uApproach,uExit,uScatter,uDustFade;
  uniform vec3 uTargetOrigin,uTargetRight,uTargetUp;
  varying vec2 vImageUv;
  varying vec3 vDustColor;
  varying float vOpacity,vImageMix,vStreak;
  varying vec2 vStreakDirection;
  ${SERVICE_EROSION_GLSL}
  ${SERVICE_FORMATION_GLSL}
  ${SERVICE_FLOW_GLSL}
  void main() {
    float release=serviceRelease(aGlyphData,aLocal);
    float local=smoothstep(release,release+.075,uDissolve);
    // Most dust occupies a diffuse volume. A minority loosely hints at arms;
    // independent radial/angular spread removes the old hard ribbon boundaries.
    float radialJitter=serviceGaussian(aSeed.z,aSeed.w);
    float radius=max(.05,sqrt(aSeed.x)*7.1+radialJitter*.65);
    if(aSeed.w<.28)radius*=.18+aSeed.w*1.6;
    float angularJitter=serviceGaussian(aSeed.w,aSeed.x);
    float angle=aSeed.y*6.2831853;
    if(aSeed.w>.66)angle=floor(aSeed.y*3.)*2.0943951+radius*.68+angularJitter*.78;
    float orbitSpeed=1.+floor(aSeed.z*2.);
    angle+=uIdlePhase*orbitSpeed+uSpiral*1.8
      +sin(uIdlePhase+aSeed.w*6.283)*.32;
    radius+=sin(uIdlePhase*2.+aSeed.y*6.283)*.28;
    float thickness=serviceGaussian(aSeed.y,aSeed.z)*(.42+radius*.055);
    vec3 disk=vec3(cos(angle)*radius,sin(angle)*radius,thickness);
    // Oblique galaxy, with real near/far depth rather than a screen-space spin.
    vec3 spiral=vec3(disk.x,disk.y*.53-disk.z*.848,disk.y*.848+disk.z*.53);
    spiral.xy=mat2(.984,.179,-.179,.984)*spiral.xy;
    spiral+=vec3(0.,-10.65,0.);
    vec3 drift=serviceDrift(aSeed,uIdlePhase);
    spiral+=drift*(.22+radius*.035);
    vec3 peel=position+aNormal*sin(local*3.14159265)*(.2+aSeed.w*.6);
    vec3 cloud=mix(peel,spiral,smoothstep(0.,1.,local));
    // The far-left bend turns along the viewing axis, rather than stretching
    // into a horizontal bar. A broad near-camera cloud then covers the screen.
    float delay=aSeed.z*.40;
    float travel=clamp((uRouteProgress-delay)/max(.01,1.-delay),0.,1.);
    vec3 routed=serviceRoute(travel);
    vec3 spread=vec3(serviceGaussian(aSeed.x,aSeed.z),serviceGaussian(aSeed.y,aSeed.w),
      serviceGaussian(aSeed.w,aSeed.y));
    routed+=spread*.44+drift*.20;
    cloud=mix(cloud,routed,smoothstep(0.,.16,travel));
    float nearDepth=.72+aSeed.w*.14;
    vec2 screen=vec2(((uColumn+aTargetUv.x)/5.-.5)*2.6,(aTargetUv.y-.5)*2.6);
    vec3 nearCloud=uFlowOrigin+(uFlowRight*screen.x+uFlowUp*screen.y)*(1.-nearDepth)
      +uFlowDepth*nearDepth+drift*.025;
    cloud=mix(cloud,nearCloud,uApproach);
    float arrival=serviceArrival(uGather,aTargetUv);
    vec3 target=uTargetOrigin+uTargetRight*aTargetUv.x+uTargetUp*aTargetUv.y;
    float flutter=sin(arrival*3.14159265)*(1.-arrival);
    vec3 bend=vec3(sin(aSeed.y*6.283+arrival*6.283),cos(aSeed.z*6.283+arrival*6.283),sin(aSeed.x*6.283));
    // Dust has a shallow volume while filling a column. It compresses into
    // the image plane before the shared, whole-surface smoothing begins.
    float volume=(1.-smoothstep(0.,.18,uSolid))*arrival;
    vec3 columnDust=target+(spread*.42+drift*.16)*volume;
    vec3 transformed=mix(cloud,columnDust,arrival)+bend*flutter*.7;
    float departed=1.-serviceSolid(1.,1.-uExit,aTargetUv);
    if(uExit>0.){
      // Release the image's own colored surface into a loose volume. No spiral
      // function participates in this second dissolution.
      float freedom=departed*(.15+uExit*.85);
      transformed=target+(spread*(.32+uScatter*2.6)+drift*.32)*freedom;
      transformed+=vec3(-uScatter*2.8,-uScatter*.8,uScatter*1.8)*freedom;
    }
    vec4 view=modelViewMatrix*vec4(transformed,1.);
    gl_Position=projectionMatrix*view;
    float columnMass=mix(1.,1.65,arrival*(1.-smoothstep(.1,.7,uSolid)));
    float rush=uApproach*(1.-arrival)*(1.-step(.00001,uExit));
    gl_PointSize=clamp(mix(1.05,2.3,aSeed.w)*columnMass*uDpr*18.5/max(2.,-view.z),.7,mix(5.,22.,rush));
    vStreak=rush*(.45+aSeed.w*.5);
    vStreakDirection=normalize(gl_Position.xy+vec2(.001));
    float lit=.56+.44*max(0.,dot(normalize(aNormal),normalize(vec3(-.35,.6,1.))));
    vDustColor=color*lit;
    vImageUv=aTargetUv;
    vImageMix=smoothstep(.12,.82,arrival);
    vOpacity=smoothstep(release-.008,release+.012,uDissolve)
      *(1.-serviceSolid(uGather,uSolid,aTargetUv))*(1.-uHandoff)*.94;
    if(uExit>0.){
      vImageMix=1.;
      vOpacity=departed*(1.-uDustFade)*.94;
    }
  }
`

export const SERVICE_DUST_FRAGMENT = /* glsl */ `
  precision highp float;
  ${IMAGE_GLSL}
  uniform float uSolid;
  varying vec2 vImageUv;
  varying vec3 vDustColor;
  varying float vOpacity,vImageMix,vStreak;
  varying vec2 vStreakDirection;
  void main() {
    vec2 p=gl_PointCoord-.5;
    vec2 direction=vec2(vStreakDirection.x,-vStreakDirection.y);
    p=vec2(dot(p,direction),dot(p,vec2(-direction.y,direction.x)));
    p.y*=1.+vStreak*3.;
    float alpha=(1.-smoothstep(.16,.5,length(p)))*vOpacity;
    if(alpha<.004)discard;
    vec3 dust=vDustColor;
    if(vImageMix>.001){
      vec3 image=serviceImage(vImageUv);
      vec3 visibleDust=max(image*1.8,vec3(.07,.085,.105));
      image=mix(visibleDust,image,smoothstep(.05,.7,uSolid));
      dust=mix(dust,image,vImageMix);
    }
    gl_FragColor=vec4(dust,alpha);
    #include <colorspace_fragment>
  }
`

export const SERVICE_COLUMN_VERTEX = /* glsl */ `
  uniform vec4 uRect;
  varying vec2 vUv;
  void main() {
    vUv=position.xy+.5;
    gl_Position=vec4(uRect.xy+vUv*uRect.zw,0.,1.);
  }
`

export const SERVICE_COLUMN_FRAGMENT = /* glsl */ `
  precision highp float;
  ${IMAGE_GLSL}
  ${SERVICE_EROSION_GLSL}
  ${SERVICE_FORMATION_GLSL}
  uniform float uGather,uSolid,uHandoff,uExit;
  varying vec2 vUv;
  void main() {
    float mask=serviceSolid(uGather,uSolid,vUv);
    if(uExit>0.)mask=serviceSolid(1.,1.-uExit,vUv);
    // Keep the formed canvas image beneath the DOM fade. Fading both copies
    // in opposite directions would darken the picture at their midpoint.
    float alpha=mask;
    if(alpha<.001)discard;
    float grain=1.-(1.-smoothstep(.25,1.,uSolid))*.15*serviceNoise(vec3(vUv*340.,11.));
    gl_FragColor=vec4(serviceImage(vUv)*grain,alpha);
    #include <colorspace_fragment>
  }
`
