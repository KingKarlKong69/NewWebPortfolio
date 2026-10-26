// All luminous regions evaluate one seeded field in source-disk coordinates.
// Local uniforms are neutral multipliers; shape and occlusion stay independent.
const MATERIAL_UNIFORMS = /* glsl */ `
  uniform float uMaterialFlowPhase, uTurbulencePhase;
  uniform float uFilamentDensity, uFilamentContrast, uNoiseScale, uNoiseStrength;
  uniform float uBroadTurbulence, uFineGrain, uNoiseFactor, uGrainScale;
  uniform float uLocalFilamentDensity, uLocalFilamentContrast;
  uniform float uLocalTurbulenceStrength, uLocalTurbulenceScale;
  uniform float uLocalGrainStrength, uLocalFineDetail;
  uniform float uCopperIntensity, uAmberIntensity, uWhiteHotIntensity;
  uniform float uExposure, uColorTemperature, uNoiseDetail, uFilamentDetail;
  uniform float uEdgeSmoothing, uArrival, uDiskEdgeSoftness;
  uniform float uDiskCloudCoverage, uDiskCloudScale, uDiskClumpiness;
  uniform float uDiskFilamentStrength, uDiskFlowCoherence, uDiskArcBlend;
`

const MATERIAL_FUNCTIONS = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
      mix(hash(i + vec2(0., 1.)), hash(i + 1.), f.x), f.y);
  }
  float fbm(vec2 p) {
    float result = noise(p) * .54;
    if (uNoiseDetail > 1.5) result += noise(p * 2.07 + 13.7) * .28;
    if (uNoiseDetail > 2.5) result += noise(p * 4.13 + 31.4) * .14;
    if (uNoiseDetail > 3.5) result += noise(p * 8.21 + 57.1) * .04;
    return result;
  }
  vec2 gasCoordinate(vec2 p) {
    float c = cos(uMaterialFlowPhase), s = sin(uMaterialFlowPhase);
    return mat2(c, -s, s, c) * p;
  }
  // Material-attached sampling grain: no frame-random overlay or time drift.
  // Its scale is independent of its strength and subpixel variance is bounded.
  float sandyGrain(vec2 q) {
    vec2 cells = q * (230. * uGrainScale);
    float footprint = max(length(dFdx(cells)), length(dFdy(cells)));
    float resolved = inversesqrt(max(1., footprint * footprint));
    float strength = clamp(uNoiseFactor * 10. * uLocalGrainStrength, 0., 1.);
    return 1. + (noise(cells) - .5) * 1.65 * strength * resolved;
  }
  float strand(float phase, float sharpness) {
    float resolved = 1. - smoothstep(.7, 2.8, fwidth(phase) * uEdgeSmoothing);
    return mix(.36, pow(.5 + .5 * sin(phase), sharpness), resolved);
  }
  // x: strand emission, y: cloud density, z: separate sandy granulation.
  vec3 flowingMaterial(vec2 p) {
    vec2 q = gasCoordinate(p);
    float radius = length(p);
    float turbulence = uNoiseStrength * uLocalTurbulenceStrength;
    float scale = max(.125, uNoiseScale * uLocalTurbulenceScale);
    float broad = fbm(q * scale);
    float slowWarp = sin(uTurbulencePhase) * noise(q * 2. + 8.3) * .06;
    float distortion = (broad - .43 + slowWarp) * turbulence;
    float phase = radius * uFilamentDensity * uLocalFilamentDensity
      + distortion * 7. + noise(q * .9 + 19.3) * 2.;
    float sharpness = 1.3 + noise(q * 3.1) * 2.2;
    // Nonharmonic frequencies and continuous angular variation avoid spokes.
    float fibers = strand(phase, sharpness) * .65;
    if (uFilamentDetail > 1.5) fibers += strand(phase * 1.913 + broad * 2.7, 2.) * .23;
    if (uFilamentDetail > 2.5) fibers += strand(phase * 3.731 + broad * 4.1, 2.7) * .12;
    float fine = (noise(q * 66.) - .5) * uFineGrain * uLocalFineDetail;
    float contrast = clamp(uFilamentContrast * uLocalFilamentContrast, 0., 4.);
    float filaments = mix(.64, .24 + fibers, min(contrast, 1.));
    filaments = max(.04, .58 + (filaments - .58) * max(1., contrast) + fine);
    filaments *= .55 + broad * uBroadTurbulence * uLocalTurbulenceStrength;
    float warp = (noise(q * uDiskCloudScale * .65 + 9.7) - .5)
      * (1. - uDiskFlowCoherence) * .35 * turbulence;
    float cloud = fbm((q + vec2(warp, -warp)) * uDiskCloudScale * uLocalTurbulenceScale);
    float threshold = (1. - uDiskCloudCoverage) * .75;
    float coverage = smoothstep(threshold - .12, threshold + .2, cloud);
    float knots = mix(1., .25 + pow(clamp(cloud * 1.6, 0., 1.), 2.) * 1.5, uDiskClumpiness);
    return vec3(filaments, coverage * knots, sandyGrain(q));
  }
  vec3 warmth(float heat) {
    float h = clamp(heat, 0., 1.);
    vec3 copper = vec3(.13, .026, .007) * uCopperIntensity;
    vec3 amber = vec3(1.08, .46, .12) * uAmberIntensity;
    vec3 hot = vec3(2.25, 1.98, 1.45) * uWhiteHotIntensity;
    vec3 color = mix(copper, amber, smoothstep(0., .62, h));
    color = mix(color, hot, pow(h, 2.4));
    return color * vec3(1. + uColorTemperature * .2,
      1. - abs(uColorTemperature) * .08, 1. - uColorTemperature * .32);
  }
  float band(float radius, float center, float width) {
    float safeWidth = max(width, max(fwidth(radius) * uEdgeSmoothing, .0001));
    float distance = (radius - center) / safeWidth;
    return exp(-distance * distance);
  }
  vec3 expose(vec3 light) {
    return 1. - exp(-max(vec3(0.), light) * uExposure);
  }
`

export const HYBRID_DISK_VERTEX = /* glsl */ `
  attribute float aRadial, aHeight, aFaceLight;
  uniform float uInnerRadius, uOuterRadius, uDiskThickness;
  uniform float uDiskEdgeTaper, uDiskDisplacement, uDiskFlowCoherence, uDiskCloudScale;
  uniform float uMaterialFlowPhase, uTurbulencePhase, uGasLayer;
  varying vec2 vDiskPosition;
  varying float vRadial, vFaceLight;
  void main() {
    float radius = mix(uInnerRadius, uOuterRadius, aRadial);
    float envelope = pow(max(0., sin(aRadial * 3.14159265359)), .75);
    float profile = mix(.7 + .3 * envelope, envelope, uDiskEdgeTaper);
    vec2 q = mat2(cos(uMaterialFlowPhase), -sin(uMaterialFlowPhase),
      sin(uMaterialFlowPhase), cos(uMaterialFlowPhase)) * position.xy;
    float ripple = sin(q.x * (3. + uDiskCloudScale) + q.y * 3.)
      + .4 * sin(q.y * 7. + q.x * 2.) + sin(uTurbulencePhase) * .12;
    float lift = ripple * uDiskDisplacement * envelope * (.35 + (1. - uDiskFlowCoherence) * .65);
    vec3 transformed = vec3(position.xy * radius,
      (aHeight + uGasLayer * .5) * uDiskThickness * profile + lift);
    vDiskPosition = transformed.xy;
    vRadial = aRadial;
    vFaceLight = aFaceLight;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
  }
`

export const HYBRID_DISK_FRAGMENT = /* glsl */ `
  precision highp float;
  ${MATERIAL_UNIFORMS}
  ${MATERIAL_FUNCTIONS}
  uniform float uDiskDensity, uGasWeight;
  varying vec2 vDiskPosition;
  varying float vRadial, vFaceLight;
  void main() {
    vec3 field = flowingMaterial(vDiskPosition);
    float material = max(.025, mix(.48, field.x, uDiskFilamentStrength));
    float heat = 1. - smoothstep(0., 1., vRadial);
    float edgeFade = smoothstep(0., max(.015, uDiskEdgeSoftness * .25), vRadial)
      * (1. - smoothstep(1. - uDiskEdgeSoftness, 1., vRadial));
    vec2 q = gasCoordinate(vDiskPosition);
    // Advected, stretched knots near the inner foreground, not random flashes.
    float knots = pow(noise(vec2(length(q) * 15., q.y * 3.) + 23.1), 5.);
    float nearSide = 1. - smoothstep(-.15, .1, vDiskPosition.y);
    float bursts = knots * nearSide * band(vRadial, .17, .15) * 2.;
    vec3 light = warmth(heat) * (material * 2.5 + bursts) * vFaceLight;
    light *= (.72 + .28 * field.y) * field.z;
    float opacity = (1. - exp(-uDiskDensity * field.y * uGasWeight * 2.4))
      * edgeFade * field.z * smoothstep(.02, .4, uArrival);
    if (opacity < .001) discard;
    gl_FragColor = vec4(expose(light), clamp(opacity, 0., .97));
    #include <colorspace_fragment>
  }
`

export const HYBRID_ARC_VERTEX = /* glsl */ `
  attribute float aRadial, aHeight;
  uniform float uArcSign, uArcThickness, uArcSpread, uArcHeight, uArcDepth;
  uniform float uCoreRadius, uDiskYaw, uDiskHeight, uArcJunctionBlend;
  varying vec2 vSourcePosition;
  varying float vRadius, vArch, vAcross, vSheetWeight;
  void main() {
    float span = (uArcSign > 0. ? .20 : .28) + 3. * max(uArcThickness, uArcSpread);
    float radius = uCoreRadius + .003 + aRadial * aRadial * span;
    float arch = max(0., position.y);
    float junction = smoothstep(0., .38, arch);
    float height = uArcSign > 0. ? 1. / .95 : 1. / 1.18;
    // Endpoints follow the disk's line of nodes. Depth and sheet separation
    // taper into those junctions; the rest of each ribbon bows away in Z.
    float x = position.x * radius;
    float z = -uArcDepth * arch + aHeight * uArcDepth * sin(aRadial * 3.14159265) * arch;
    float yaw = radians(uDiskYaw);
    vec3 transformed = vec3(cos(yaw) * x + sin(yaw) * z,
      uArcSign * arch * radius * height + uDiskHeight
        + uArcSign * uArcHeight * mix(1., junction, uArcJunctionBlend),
      -sin(yaw) * x + cos(yaw) * z);
    vSourcePosition = vec2(position.x, uArcSign * position.y) * radius;
    vRadius = radius;
    vArch = arch;
    vAcross = aRadial;
    vSheetWeight = aHeight < 0. ? .58 : .42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.);
  }
`

export const HYBRID_ARC_FRAGMENT = /* glsl */ `
  precision highp float;
  ${MATERIAL_UNIFORMS}
  ${MATERIAL_FUNCTIONS}
  uniform float uCoreRadius, uEdgeSoftness, uArcSign, uArcThickness;
  uniform float uArcSpread, uArcBrightness, uArcEmphasis, uArcVisibility, uArcJunctionBlend;
  uniform float uInnerRadius, uOuterRadius;
  varying vec2 vSourcePosition;
  varying float vRadius, vArch, vAcross, vSheetWeight;
  void main() {
    if (uArcBrightness * uArcVisibility <= 0.) discard;
    vec3 field = flowingMaterial(vSourcePosition);
    float sourceRadial = clamp((vRadius - uInnerRadius) / max(.2, uOuterRadius - uInnerRadius), 0., 1.);
    float heat = 1. - smoothstep(0., 1., sourceRadial);
    float center = uCoreRadius + (uArcSign > 0. ? .10 : .18);
    float body = band(vRadius, center, uArcThickness);
    float outer = band(vRadius, center + .1, uArcSpread) * .18;
    float filament = field.x;
    float shared = mix(1., .72 + field.y * .28, uDiskArcBlend);
    float junction = mix(1., smoothstep(0., .24, vArch), uArcJunctionBlend);
    float rim = band(vRadius, uCoreRadius + .015, max(.008, uEdgeSoftness)) * .16;
    float emphasis = uArcSign > 0. ? .42 + vArch * uArcEmphasis : 1.;
    float density = (body + outer + rim) * (.42 + field.y * .58) * junction;
    float boundary = smoothstep(0., .025, vAcross) * (1. - smoothstep(.9, 1., vAcross));
    float brightness = uArcBrightness * uArcVisibility;
    vec3 light = warmth(heat) * (filament * 2.5 + rim) * shared * field.z
      * emphasis * brightness;
    float opacity = (1. - exp(-density * vSheetWeight * 3.)) * boundary
      * field.z * smoothstep(.06, .65, uArrival) * clamp(brightness, 0., 1.);
    if (opacity < .001) discard;
    gl_FragColor = vec4(expose(light), clamp(opacity, 0., .97));
    #include <colorspace_fragment>
  }
`

// Only diffuse light uses a plane. Both lensed images use curved geometry.
export const HYBRID_HALO_VERTEX = /* glsl */ `
  varying vec2 vPosition;
  void main() {
    vPosition = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`
export const HYBRID_HALO_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uCoreRadius, uHaloStrength, uArrival, uExposure;
  uniform float uUpperBrightness, uLowerBrightness, uLowerVisibility;
  varying vec2 vPosition;
  void main() {
    float r = length(vPosition);
    float glow = exp(-pow((r - uCoreRadius - .12) / .38, 2.));
    float arcLight = mix(uLowerBrightness * uLowerVisibility, uUpperBrightness,
      smoothstep(-.2, .2, vPosition.y));
    float alpha = glow * .09 * uHaloStrength * min(1., arcLight)
      * smoothstep(.06, .65, uArrival) * (1. - smoothstep(1.9, 2.7, r));
    gl_FragColor = vec4(vec3(.29, .105, .025) * min(2., uExposure), clamp(alpha, 0., .3));
    #include <colorspace_fragment>
  }
`

export const HYBRID_DUST_VERTEX = /* glsl */ `
  attribute float aRadial, aHeight;
  uniform float uInnerRadius, uOuterRadius, uDiskThickness, uMaterialFlowPhase, uPixelRatio, uArrival;
  varying float vHeat, vOpacity, vDustSide;
  void main() {
    float radius = mix(uInnerRadius * .98, uOuterRadius * 1.04, aRadial);
    float c = cos(uMaterialFlowPhase), s = sin(uMaterialFlowPhase);
    // Sampling uses R(-phase), so particles must travel with R(+phase).
    vec2 p = mat2(c, s, -s, c) * position.xy * radius;
    float envelope = pow(max(0., sin(aRadial * 3.14159265)), .75);
    vec3 transformed = vec3(p, aHeight * uDiskThickness * envelope * 1.9);
    vec4 view = modelViewMatrix * vec4(transformed, 1.);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp((.7 + fract(aRadial * 127.1) * 1.5) * uPixelRatio * 8. / max(2., -view.z), .5, 4.);
    vHeat = 1. - aRadial;
    vDustSide = p.y;
    vOpacity = envelope * smoothstep(.03, .4, uArrival) * .16;
  }
`
export const HYBRID_DUST_FRAGMENT = /* glsl */ `
  precision highp float;
  ${MATERIAL_UNIFORMS}
  ${MATERIAL_FUNCTIONS}
  uniform float uDiskSide;
  varying float vHeat, vOpacity, vDustSide;
  void main() {
    if (vDustSide * uDiskSide < 0.) discard;
    vec2 q = gl_PointCoord - .5;
    float alpha = exp(-dot(q, q) * 32.) * vOpacity;
    if (alpha < .005) discard;
    gl_FragColor = vec4(expose(warmth(vHeat) * .65), alpha);
    #include <colorspace_fragment>
  }
`

export const HYBRID_CORE_VERTEX = /* glsl */ `
  varying vec3 vSurface;
  void main() {
    vSurface = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`
export const HYBRID_CORE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform float uCoreDarkness, uCoreEdgeWarmth, uCoreEdgeWidth, uArrival;
  uniform float uUpperBrightness, uLowerBrightness, uLowerVisibility;
  varying vec3 vSurface;
  void main() {
    vec3 n = normalize(vSurface);
    float rim = smoothstep(1. - uCoreEdgeWidth, 1., length(n.xy));
    float illumination = mix(uLowerBrightness * uLowerVisibility * .5, uUpperBrightness,
      smoothstep(-.1, .6, n.y));
    vec3 edgeLight = vec3(.065, .019, .005) * rim * rim * uCoreEdgeWarmth
      * min(1.5, illumination) * smoothstep(.06, .65, uArrival);
    // Optical edge tint only. Center stays textureless and writes opaque depth.
    gl_FragColor = vec4(vec3((1. - uCoreDarkness) * .035) + edgeLight, 1.);
    #include <colorspace_fragment>
  }
`
