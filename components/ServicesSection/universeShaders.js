export const UNIVERSE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`

// Shared section mask keeps the transient birth effect inside Contact even
// while its sticky frame is only partially inside the viewport.
export const CONTACT_UNIVERSE_GLSL=/* glsl */ `
uniform vec2 uBirthCenter;
uniform vec4 uBirthBounds;
uniform float uBirthPull,uBirthSnap,uBirthWave,uBirthWavePower,uBirthMaxRadius,uBirthTremor;
float contactRegion(vec2 uv){
 vec2 lo=smoothstep(uBirthBounds.xy,uBirthBounds.xy+vec2(.012),uv);
 vec2 hi=1.-smoothstep(uBirthBounds.xy+uBirthBounds.zw-vec2(.012),uBirthBounds.xy+uBirthBounds.zw,uv);
 return lo.x*lo.y*hi.x*hi.y;
}
`

// Stars are rasterized before lensing. The composite therefore bends their
// complete image, including halos and trails, rather than moving point centers.
export const STAR_VERTEX = /* glsl */ `
${CONTACT_UNIVERSE_GLSL}
attribute vec4 aDetails;
uniform float uTime,uRatio,uMode,uSize,uBrightness,uTwinkle,uTwinkleSpeed;
uniform float uDepth,uTrail,uSpeed,uHalo,uViolet,uAspect;
uniform float uGlints,uFrequency,uProbability,uIntensity,uDuration,uCount;
uniform vec2 uPointer,uTravel,uMotion,uDirection;
varying float vAlpha,vGlint,vViolet,vMode,vHalo,vElongation;
varying vec2 vDirection;
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
void main(){
 float depth=.1+aDetails.x*.9;
 vec2 p=position.xy+uPointer*depth*.008+uTravel*depth;
 float moving=step(.5,uMode)*(1.-step(1.5,uMode));
 if(moving>.5){
   p+=uMotion*(.45+depth*uDepth);
   p=mod(p+1.16,2.32)-1.16;
 }
 float fade=moving>.5?1.-smoothstep(1.02,1.16,max(abs(p.x),abs(p.y))):1.;
 vec2 birthDelta=(p*.5+.5-uBirthCenter)*vec2(uAspect,1.);
 float distanceToBirth=length(birthDelta);
 float warp=(uBirthPull*.44+uBirthSnap*.20)*exp(-distanceToBirth*1.25)*contactRegion(p*.5+.5);
 p=mix(p,uBirthCenter*2.-1.,warp*(.35+depth*.65));
 float slot=floor(uTime*max(uFrequency,.001));
 vGlint=0.;
 // Bounded overlapping opportunities preserve a long glint's full duration.
 for(int age=0;age<7;age++){
   float eventSlot=slot-float(age);
   if(eventSlot<0.)continue;
   float elapsed=uTime-eventSlot/max(uFrequency,.001);
   float pulse=pow(max(0.,sin(clamp(elapsed/max(uDuration,.1),0.,1.)*3.14159265)),4.);
   float selected=1.-step(.5,abs(floor(hash(eventSlot+17.)*max(1.,uCount))-aDetails.z));
   float chosenLayer=1.-step(.5,abs(floor(hash(eventSlot+307.)*3.)-uMode));
   vGlint+=uGlints*step(hash(eventSlot+193.),uProbability)*selected*chosenLayer*pulse*uIntensity;
 }
 float twinkle=1.-uTwinkle*.5+uTwinkle*.5*sin(uTime*uTwinkleSpeed*(.25+aDetails.x*.15)+aDetails.y*30.);
 float accent=step(1.5,uMode);
 vAlpha=mix(.18+depth*.63,.66,accent)*uBrightness*twinkle*fade;
 vMode=uMode;vHalo=uHalo;vViolet=accent*step(aDetails.w,uViolet);
 vec2 radial=normalize(vec2(birthDelta.x/uAspect,-birthDelta.y)+vec2(.00001));
 vDirection=normalize(mix(uDirection,radial,smoothstep(0.,.06,warp))+vec2(.00001));
 float base=mix(.9+pow(aDetails.x,7.)*2.1,16.+aDetails.x*12.,accent)*uSize;
 base*=1.-warp*.55;
 float streak=moving*uTrail*min(uSpeed*160.,22.)+warp*(5.+depth*28.);
 vElongation=1.+streak/max(base,1.);
 gl_PointSize=(base+streak+vGlint*12.)*uRatio;
 gl_Position=vec4(p,.99,1.);
}
`

export const STAR_FRAGMENT = /* glsl */ `
varying float vAlpha,vGlint,vViolet,vMode,vHalo,vElongation;
varying vec2 vDirection;
void main(){
 vec2 p=gl_PointCoord-.5;
 float moving=step(.5,vMode)*(1.-step(1.5,vMode));
 if(moving>.5||vElongation>1.001){p=vec2(dot(p,vDirection),dot(p,vec2(-vDirection.y,vDirection.x)));p.y*=vElongation;}
 float r2=dot(p,p);
 float accent=step(1.5,vMode);
 float core=exp(-r2*mix(52.,1400.,accent));
 float halo=exp(-r2*32.)*.075*accent*vHalo;
 float rays=(exp(-abs(p.x)*80.)*exp(-abs(p.y)*6.)+exp(-abs(p.y)*80.)*exp(-abs(p.x)*6.));
 float alpha=(core+halo)*vAlpha+vGlint*rays*.55;
 if(alpha<.001)discard;
 vec3 tint=mix(vec3(.66,.8,1.),vec3(.84,.99,1.),accent);
 tint=mix(tint,vec3(.87,.79,1.),vViolet);
 gl_FragColor=vec4(tint,alpha);
}
`

export const UNIVERSE_FRAGMENT = /* glsl */ `
${CONTACT_UNIVERSE_GLSL}
varying vec2 vUv;
uniform sampler2D uDistant,uMoving,uAccent,uFar,uNear;
uniform vec2 uCenter,uTexel;
uniform float uAspect,uFit,uViewScale,uEnabled,uArrival,uBlur,uForegroundOnly;
uniform float uCurvature,uRadius,uStrength,uRadial,uTangential,uStretch,uSoftness;
uniform float uCurveDistant,uCurveMoving,uCurveAccent,uCurveAsteroids,uCurveForeground;

float contactWave(vec2 uv){
 if(uBirthWavePower<=0.)return 0.;
 float r=length((uv-uBirthCenter)*vec2(uAspect,1.));
 float radius=uBirthMaxRadius*1.15*uBirthWave;
 float width=max(.025,uBirthMaxRadius*.035);
 return exp(-pow((r-radius)/width,2.))*uBirthWavePower*contactRegion(uv);
}
vec2 contactWarp(vec2 uv){
 if(uBirthPull+uBirthSnap+uBirthWavePower+abs(uBirthTremor)<=0.)return uv;
 vec2 q=(uv-uBirthCenter)*vec2(uAspect,1.);
 float r=length(q),region=contactRegion(uv);
 vec2 axis=q/max(.0001,r),tangent=vec2(-axis.y,axis.x);
 float contraction=(uBirthPull*.13+uBirthSnap*.10)*exp(-r*1.7)*region;
 float radius=uBirthMaxRadius*1.15*uBirthWave;
 float width=max(.025,uBirthMaxRadius*.035),d=(r-radius)/width;
 float front=exp(-d*d),wake=exp(-pow((r-radius+width*2.)/(width*2.),2.));
 vec2 shift=q*contraction+tangent*contraction*.07;
 // The whole Contact universe rapidly contracts and expands about the hole.
 // This radial zoom changes the fabric of the background, not the DOM camera.
 shift+=q*uBirthTremor*.016*region;
 shift+=axis*(front*.052-wake*.016)*uBirthWavePower*region;
 return uv+vec2(shift.x/uAspect,shift.y);
}

vec2 bentUv(vec2 uv,float affected){
 vec2 units=vec2(uAspect,1.)*3.05*uFit/max(uViewScale,.05);
 vec2 q=(uv-uCenter)*units;
 float radius=max(.05,uRadius);
 float r=length(q);
 float inner=radius*(1.-clamp(uSoftness,.1,1.));
 float field=(1.-smoothstep(inner,radius,r))*uCurvature*uStrength*uArrival*affected;
 vec2 axis=q/max(r,.0001);
 vec2 tangent=vec2(-axis.y,axis.x);
 // Smoothly vanishing inverse mapping magnifies and sweeps the image near
 // the center. The anisotropic term creates tangentially stretched silhouettes.
 vec2 shift=axis*(uRadial*.21*radius)+tangent*(uTangential*.26*radius);
 shift+=vec2(q.y,-q.x)*uStretch*.16*(1.-clamp(r/radius,0.,1.));
 return uv-shift*field/units;
}
vec4 sampleInside(sampler2D image,vec2 uv){
 if(min(uv.x,uv.y)<0.||max(uv.x,uv.y)>1.)return vec4(0.);
 return texture2D(image,uv);
}
vec4 nearImage(vec2 uv){
 vec2 offset=uTexel*uBlur;
 vec4 c=sampleInside(uNear,uv)*.25;
 c+=sampleInside(uNear,uv+vec2(offset.x,0.))*.125;
 c+=sampleInside(uNear,uv-vec2(offset.x,0.))*.125;
 c+=sampleInside(uNear,uv+vec2(0.,offset.y))*.125;
 c+=sampleInside(uNear,uv-vec2(0.,offset.y))*.125;
 c+=sampleInside(uNear,uv+offset)*.0625;
 c+=sampleInside(uNear,uv-offset)*.0625;
 c+=sampleInside(uNear,uv+vec2(offset.x,-offset.y))*.0625;
 c+=sampleInside(uNear,uv+vec2(-offset.x,offset.y))*.0625;
 return c;
}
void main(){
 if(uEnabled<.5){gl_FragColor=vec4(0.,0.,0.,1.-uForegroundOnly);return;}
 if(uForegroundOnly>.5){
   vec4 nearRock=nearImage(bentUv(vUv,uCurveForeground));
   gl_FragColor=vec4(nearRock.rgb/max(nearRock.a,.00001),nearRock.a);
   #include <colorspace_fragment>
   return;
 }
 vec3 color=vec3(.0003,.0009,.0024);
 vec2 warped=contactWarp(vUv);
 color+=sampleInside(uDistant,bentUv(warped,uCurveDistant)).rgb;
 color+=sampleInside(uMoving,bentUv(warped,uCurveMoving)).rgb;
 color+=sampleInside(uAccent,bentUv(warped,uCurveAccent)).rgb;
 color+=vec3(.13,.035,.003)*contactWave(vUv);
 vec4 farRock=sampleInside(uFar,bentUv(vUv,uCurveAsteroids));
 // Render-target edges are premultiplied against transparent black.
 color=color*(1.-farRock.a)+farRock.rgb;
 gl_FragColor=vec4(color,1.);
 #include <colorspace_fragment>
}
`
