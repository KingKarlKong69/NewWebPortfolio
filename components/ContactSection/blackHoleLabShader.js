// Shared material for the lab and footer. Numeric controls never recompile it.
export const LAB_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0., 1.);
  }
`

export const BLACK_HOLE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uFlowPhase;
  uniform float uTurbulencePhase;
  uniform float uAspect;
  uniform vec2 uCenter;
  uniform float uArrival;
  uniform float uIsolated;
  uniform float uCoreRadius;
  uniform float uEdgeSoftness;
  uniform float uCoreDarkness;
  uniform float uUpperThickness;
  uniform float uOuterSpread;
  uniform float uUpperHeight;
  uniform float uUpperBrightness;
  uniform float uUpperEmphasis;
  uniform float uForegroundThickness;
  uniform float uDiskExtent;
  uniform float uLowerThickness;
  uniform float uLowerHeight;
  uniform float uLowerBrightness;
  uniform float uLowerVisibility;
  uniform float uFilamentDensity;
  uniform float uFilamentContrast;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;
  uniform float uBroadTurbulence;
  uniform float uFineGrain;
  uniform float uCopperIntensity;
  uniform float uAmberIntensity;
  uniform float uWhiteHotIntensity;
  uniform float uHaloStrength;
  uniform float uExposure;
  uniform float uColorTemperature;
  uniform float uNoiseDetail;
  uniform float uFilamentDetail;
  uniform float uEdgeSmoothing;

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
    float value = noise(p) * .54;
    if (uNoiseDetail > 1.5) value += noise(p * 2.07 + 13.7) * .28;
    if (uNoiseDetail > 2.5) value += noise(p * 4.13 + 31.4) * .14;
    if (uNoiseDetail > 3.5) value += noise(p * 8.21 + 57.1) * .04;
    return value;
  }
  float filaments(vec2 q) {
    float radius = length(q);
    // atan(0,0) is undefined on some GPUs.
    float angle = atan(q.y, abs(q.x) + abs(q.y) < .00001 ? .00001 : q.x);
    float flow = angle - uFlowPhase;
    vec2 coordinate = vec2(cos(flow), sin(flow)) * radius;
    // Fixed seeded structure, carried by rigid rotation. Only a small periodic
    // wobble evolves; the noise domain cannot migrate or accumulate shear.
    float broad = fbm(coordinate * uNoiseScale);
    float wobble = sin(uTurbulencePhase) * sin(radius * 3. + flow * 3.) * .012;
    float distortion = (broad + wobble) * uNoiseStrength;
    float strands = .5 + .5 * sin(radius * uFilamentDensity + distortion * 13. + sin(flow * 19.) * 1.7);
    float detail = pow(strands, 2.) * .48;
    if (uFilamentDetail > 1.5) {
      float fine = .5 + .5 * sin(radius * uFilamentDensity * (327. / 172.) + distortion * 26. + sin(flow * 37.) * 2.1);
      detail += fine * .16;
    }
    if (uFilamentDetail > 2.5) {
      float finest = .5 + .5 * sin(radius * uFilamentDensity * 3.71 + distortion * 39. + sin(flow * 53.));
      detail += finest * .07;
    }
    float grain = noise(coordinate * 66. + distortion * 4.) * uFineGrain;
    float materialDetail = max(.025, mix(.57, .33 + detail, uFilamentContrast) + grain);
    return (.2 + broad * uBroadTurbulence) * materialDetail;
  }
  vec3 warmth(float heat) {
    vec3 copper = vec3(.15, .035, .006) * uCopperIntensity;
    vec3 amber = vec3(1.05, .41, .09) * uAmberIntensity;
    vec3 hot = vec3(2.1, 1.59, .89) * uWhiteHotIntensity;
    vec3 color = mix(copper, amber, smoothstep(0., .6, heat));
    color = mix(color, hot, pow(clamp(heat, 0., 1.), 1.8));
    return color * vec3(1. + uColorTemperature * .2,
                       1. - abs(uColorTemperature) * .08,
                       1. - uColorTemperature * .32);
  }
  float band(float radius, float center, float width) {
    float safeWidth = max(width, max(fwidth(radius) * uEdgeSmoothing, .0001));
    float distance = (radius - center) / safeWidth;
    return exp(-distance * distance);
  }
  void main() {
    vec2 p = (vUv - uCenter) * vec2(uAspect, 1.) * 3.05;
    if (uIsolated > .5) p *= max(1., 1.5 / max(uAspect, .001));
    float r = length(p);
    float arrival = smoothstep(.06, .92, uArrival);
    float edge = max(uEdgeSoftness, fwidth(r) * uEdgeSmoothing);
    float core = 1. - smoothstep(uCoreRadius - edge, uCoreRadius + edge, r);
    vec3 color = vec3(0.);

    vec2 arc = vec2(p.x, (p.y - uUpperHeight) * .95);
    float ar = length(arc);
    float arcBody = band(ar, .62, uUpperThickness);
    float arcOuter = band(ar, .72, uOuterSpread) * .16;
    float top = smoothstep(-.18, .2, p.y - uUpperHeight);
    float arcEdge = band(ar, .535, .015);
    float doppler = .77 + .32 * smoothstep(-.7, .7, p.x);
    vec3 upper = warmth(.8 - (ar - .54) * 1.8) * (arcBody + arcOuter)
                 * filaments(arc) * (.42 + top * uUpperEmphasis) * doppler;
    upper += warmth(.98) * arcEdge * (.35 + top * .5);
    upper *= uUpperBrightness;

    vec2 disk = vec2(p.x, (p.y + .065) * 3.3 / max(uForegroundThickness, .001));
    float dr = length(disk);
    float extent = max(uDiskExtent, .001);
    float mask = smoothstep(.55, .67, dr) * (1. - smoothstep(1.37 * extent, 2.15 * extent, dr));
    float foreground = 1. - smoothstep(-.03, .075, p.y);
    float heat = 1. - smoothstep(.55, 1.8 * extent, dr);
    vec3 front = warmth(heat) * filaments(disk) * mask * (foreground + (1. - core * uCoreDarkness) * .5) * 1.45;

    vec2 lower = vec2(p.x, (p.y + uLowerHeight) * 1.18);
    float lowerArc = band(length(lower), .70, uLowerThickness) * (1. - smoothstep(-.14, -.05, p.y + uLowerHeight - .025));
    vec3 returning = warmth(.7) * lowerArc * filaments(lower) * uLowerBrightness * uLowerVisibility;
    vec3 diskLight = (upper + front + returning) * (1. - core * uCoreDarkness * (1. - foreground));
    vec3 halo = vec3(.55, .19, .025) * band(r, .68, .4) * .024 * uHaloStrength;
    color += max(vec3(0.), diskLight + halo * (1. - core * uCoreDarkness)) * arrival;
    color = 1. - exp(-color * uExposure);
    // Only the horizon and luminous material cover the persistent shared sky.
    // Straight alpha preserves the disk's emission without an opaque rectangle.
    float alpha = uIsolated > .5 ? 1. : max(core*uCoreDarkness*arrival,max(color.r,max(color.g,color.b)));
    gl_FragColor = vec4(color/max(alpha,.00001), alpha);
    #include <colorspace_fragment>
  }
`

export const LAB_FRAGMENT_SHADER = BLACK_HOLE_FRAGMENT_SHADER
