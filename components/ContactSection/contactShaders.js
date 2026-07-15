export const accretionVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uWarp;

  varying vec2 vUv;
  varying float vWave;

  void main() {
    vUv = uv;
    vec2 centered = uv - 0.5;
    float time = uTime * uMotion;
    float wave = sin(centered.x * 17.0 - centered.y * 9.0 + time * 0.42) * 0.016;
    wave += sin(centered.x * 7.0 + centered.y * 23.0 - time * 0.27) * 0.008;

    vec3 transformed = position;
    transformed.z += wave * uWarp;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`

export const accretionFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uIntensity;
  uniform float uFlowSpeed;
  uniform float uNoiseScale;
  uniform float uDistortion;
  uniform float uOpacity;
  uniform float uLayer;
  uniform float uQuality;
  uniform float uSeed;
  uniform float uSurge;
  uniform float uWarmth;
  uniform float uFlowBoost;
  uniform float uBeamingAngle;
  uniform vec3 uColorCore;
  uniform vec3 uColorMid;
  uniform vec3 uColorEdge;
  uniform vec2 uPointer;

  varying vec2 vUv;
  varying float vWave;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.52;
    mat2 rotation = mat2(0.82, -0.57, 0.57, 0.82);
    for (int octave = 0; octave < 3; octave++) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03 + 7.17;
      amplitude *= 0.5;
    }
    if (uQuality > 0.5) {
      value += amplitude * noise(p);
      p = rotation * p * 2.03 + 7.17;
      amplitude *= 0.5;
    }
    if (uQuality > 0.86) value += amplitude * noise(p);
    return value;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float time = uTime * uFlowSpeed * uMotion * uFlowBoost;

    float broadBend = sin(p.x * 2.8 + time * 0.18 + uSeed) * 0.026;
    broadBend += sin(p.x * 7.3 - time * 0.26) * 0.012 * uQuality;
    broadBend += (uPointer.y * p.x - uPointer.x * p.y) * 0.008;
    p.y += broadBend * uDistortion;

    vec2 orbital = vec2(p.x, p.y * 2.88);
    float radius = length(orbital);
    float angle = atan(orbital.y, orbital.x);
    float spiral = angle * 2.35 - radius * 13.5;
    float beaming = smoothstep(-0.82, 0.88, cos(angle - uBeamingAngle));
    float beamEnergy = mix(0.58, 1.46, beaming);

    float macroNoise = fbm(vec2(spiral * 0.43 + time + uSeed, radius * 8.5 - time * 0.36));
    float flowNoise = fbm(vec2(angle * uNoiseScale - time * 0.7, radius * 17.0 + time * 0.22 + uSeed));
    float fineNoise = noise(vec2(spiral * 2.4 - time * 2.1, radius * 61.0 + time * 0.9));

    float innerHeat = exp(-pow((radius - 0.165) * 28.0, 2.0));
    float hotBand = exp(-pow((radius - 0.235) * 17.5, 2.0));
    float plasmaBody = exp(-pow((radius - 0.41) * 7.4, 2.0));
    float outerHaze = exp(-pow((radius - 0.64) * 4.2, 2.0));

    float narrowStreak = pow(0.5 + 0.5 * sin(spiral * 4.5 - time * 4.2 + flowNoise * 7.0), 12.0);
    float mediumStreak = pow(0.5 + 0.5 * sin(spiral * 1.75 - time * 2.1 + macroNoise * 5.0), 5.0);
    float brokenFlow = smoothstep(0.3, 0.82, flowNoise + fineNoise * 0.25);
    float darkGap = smoothstep(0.2, 0.52, macroNoise) * smoothstep(0.22, 0.68, fineNoise + flowNoise * 0.38);

    float trailCurve = 0.045 + sin(p.x * 4.2 - time * 0.32) * 0.055;
    float trailWidth = 0.11 + max(p.x, 0.0) * 0.055;
    float rightTrail = exp(-pow((p.y - trailCurve) / trailWidth, 2.0));
    rightTrail *= smoothstep(0.18, 0.46, p.x) * (1.0 - smoothstep(0.86, 1.03, p.x));
    rightTrail *= 0.35 + 0.65 * brokenFlow;

    float leftCurve = -0.035 + sin(p.x * 5.1 + time * 0.23) * 0.035;
    float leftTrail = exp(-pow((p.y - leftCurve) / 0.1, 2.0));
    leftTrail *= (1.0 - smoothstep(-0.58, -0.2, p.x)) * smoothstep(-1.03, -0.82, p.x);
    leftTrail *= 0.3 + 0.7 * mediumStreak;

    float energy = 0.0;
    float layerMask = 1.0;
    if (uLayer < 0.5) {
      energy = plasmaBody * (0.18 + macroNoise * 0.48) + outerHaze * (0.08 + flowNoise * 0.28);
      energy += rightTrail * 0.58 + leftTrail * 0.2;
      layerMask = 0.62 + 0.38 * smoothstep(-0.55, 0.7, p.y);
    } else if (uLayer < 1.5) {
      energy = innerHeat * (0.28 + narrowStreak * 0.8);
      energy += hotBand * (0.34 + mediumStreak * 0.72);
      energy += plasmaBody * (0.18 + brokenFlow * 0.66);
      energy += outerHaze * brokenFlow * 0.22 + rightTrail * 0.72 + leftTrail * 0.22;
      layerMask = 0.7 + 0.3 * smoothstep(-0.35, 0.65, p.y);
    } else if (uLayer < 2.5) {
      energy = innerHeat * (0.52 + narrowStreak * 1.65);
      energy += hotBand * (0.26 + narrowStreak * 0.9 + mediumStreak * 0.42);
      energy += plasmaBody * brokenFlow * 0.46 + rightTrail * (0.38 + narrowStreak * 0.52);
      float lowerEdge = -0.13 + sin(p.x * 5.8 + flowNoise * 2.0) * 0.035;
      layerMask = 1.0 - smoothstep(lowerEdge, lowerEdge + 0.13, p.y);
    } else {
      energy = innerHeat * narrowStreak * 1.5;
      energy += hotBand * narrowStreak * 1.1 + plasmaBody * mediumStreak * 0.34;
      energy += rightTrail * narrowStreak * 0.72;
      float filamentEdge = -0.1 + sin(p.x * 7.2 + macroNoise * 3.0) * 0.045;
      layerMask = 1.0 - smoothstep(filamentEdge, filamentEdge + 0.12, p.y);
    }

    float radialFade = smoothstep(0.105, 0.155, radius) * (1.0 - smoothstep(0.78, 0.98, radius));
    float trailOverride = clamp(rightTrail + leftTrail, 0.0, 1.0);
    float breakup = mix(0.38, 1.0, darkGap) * (0.72 + 0.28 * fineNoise);
    energy *= beamEnergy * (1.0 + uSurge * (0.26 + innerHeat * 0.7));
    float alpha = energy * max(radialFade, trailOverride * 0.78) * layerMask * breakup * uOpacity;

    float coreMix = clamp(innerHeat * (0.48 + narrowStreak * 1.25) + hotBand * narrowStreak * 0.42, 0.0, 1.0);
    vec3 color = mix(uColorEdge, uColorMid, 1.0 - smoothstep(0.31, 0.76, radius));
    color = mix(color, uColorCore, coreMix);
    color += uColorCore * innerHeat * narrowStreak * (uLayer > 1.5 ? 1.15 : 0.5);
    color += uColorMid * rightTrail * (0.2 + mediumStreak * 0.25);
    vec3 warmMid = vec3(1.32, 0.34, 0.055);
    vec3 warmCore = vec3(1.9, 1.12, 0.48);
    float thermalBand = clamp(
      innerHeat * 1.2 +
      hotBand * (0.62 + narrowStreak * 0.72) +
      plasmaBody * (0.08 + mediumStreak * 0.34) +
      rightTrail * (0.06 + narrowStreak * 0.24),
      0.0,
      1.0
    );
    float warmMask = clamp(uWarmth * (0.16 + thermalBand * 0.96), 0.0, 0.97);
    vec3 warmEmission = mix(warmMid, warmCore, clamp(coreMix + innerHeat * 0.45, 0.0, 1.0));
    color = mix(color, warmEmission * (1.0 + uSurge * 0.18), warmMask);

    float approaching = smoothstep(0.08, 0.94, cos(angle - uBeamingAngle));
    float receding = smoothstep(0.08, 0.94, -cos(angle - uBeamingAngle));
    vec3 blueShift = color * vec3(0.76, 1.08, 1.28) + vec3(0.02, 0.1, 0.19) * thermalBand;
    vec3 redShift = color * vec3(1.22, 0.86, 0.68) + vec3(0.12, 0.018, 0.0) * thermalBand;
    color = mix(color, blueShift, approaching * 0.3);
    color = mix(color, redShift, receding * 0.22);
    float surgeHeat = uWarmth * uSurge * clamp(
      innerHeat * 1.8 +
      hotBand * 1.25 +
      plasmaBody * (0.12 + narrowStreak * 0.48) +
      rightTrail * narrowStreak * 0.32,
      0.0,
      1.0
    );
    color.r += surgeHeat * 1.05;
    color.g *= 1.0 - surgeHeat * 0.46;
    color.b *= 1.0 - surgeHeat * 0.86;
    color *= uIntensity * (1.0 + vWave * 4.0);

    if (alpha < 0.006) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export const lensingArcFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uQuality;
  uniform float uSurge;
  uniform float uWarmth;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radius = length(vec2(p.x * 1.02, p.y * 0.94));
    float angle = atan(p.y, p.x);
    float time = uTime * uMotion;
    float irregularity = sin(angle * 9.0 - time * 0.48) * 0.011;
    irregularity += sin(angle * 23.0 + time * 0.29) * 0.005 * uQuality;
    float surgePulse = sin(uSurge * 3.14159) * 0.008;
    float ring = exp(-pow((radius - 0.705 - irregularity - surgePulse) * 66.0, 2.0));
    float halo = exp(-pow((radius - 0.718) * 24.0, 2.0));
    float upper = smoothstep(0.02, 0.24, p.y);
    float sideWrap = smoothstep(0.52, 0.88, abs(p.x)) * smoothstep(-0.16, 0.08, p.y);
    float breakup = 0.48 + 0.52 * smoothstep(0.18, 0.84, sin(angle * 13.0 - time * 0.8) * 0.5 + 0.5);
    float hotspot = pow(0.5 + 0.5 * sin(angle * 3.0 + 1.2), 5.0);
    float alpha = (ring * (0.5 + hotspot * 0.5) + halo * 0.035) * max(upper, sideWrap * 0.38) * breakup;
    vec3 blue = vec3(0.055, 0.35, 0.88);
    vec3 cyan = vec3(0.18, 0.88, 1.0);
    vec3 whiteHot = vec3(1.55, 1.7, 1.8);
    vec3 color = mix(blue, cyan, smoothstep(0.0, 0.8, upper));
    color = mix(color, whiteHot, clamp(ring * hotspot * 1.2, 0.0, 1.0));
    vec3 warm = mix(vec3(1.28, 0.28, 0.035), vec3(1.8, 1.12, 0.5), hotspot);
    color = mix(color, warm, clamp(uWarmth * (0.52 + ring * 0.48), 0.0, 0.96));
    color *= 1.0 + uSurge * 0.54;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha * 0.78);
  }
`

export const photonRingFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uQuality;
  uniform float uSurge;
  uniform float uWarmth;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.37, 289.13))) * 19531.317);
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radius = length(p);
    float angle = atan(p.y, p.x);
    float time = uTime * uMotion;
    float wobble = sin(angle * 7.0 - time * 0.42) * 0.006;
    wobble += sin(angle * 19.0 + time * 0.24) * 0.003 * uQuality;
    float pulse = sin(uSurge * 3.14159) * 0.007;
    float ring = exp(-pow((radius - 0.806 - wobble - pulse) * mix(103.0, 86.0, uSurge * 0.3), 2.0));
    float halo = exp(-pow((radius - 0.812) * 34.0, 2.0));
    float breakupWave = sin(angle * 7.0 - time * 0.52) * 0.34;
    breakupWave += sin(angle * 19.0 + time * 0.31) * 0.2 * uQuality;
    float breakup = smoothstep(-0.22, 0.32, breakupWave);
    float lowerHot = pow(max(0.0, -sin(angle - 0.22)), 3.0);
    float upperHot = pow(max(0.0, sin(angle + 0.55)), 7.0) * 0.72;
    float sideHot = pow(abs(cos(angle)), 8.0) * 0.42;
    float upperSector = smoothstep(-0.18, 0.38, p.y);
    float visibility = lowerHot * 0.2 + upperHot * 0.88 + sideHot * 0.58;
    visibility *= mix(0.08, 1.0, breakup) * mix(0.34, 1.0, upperSector);
    float alpha = ring * visibility + halo * visibility * 0.035;
    vec3 cyan = vec3(0.15, 0.86, 1.0);
    vec3 whiteHot = vec3(1.8, 1.92, 2.0);
    vec3 color = mix(cyan, whiteHot, clamp(ring * (lowerHot + upperHot) * 1.5, 0.0, 1.0));
    vec3 warm = mix(vec3(1.5, 0.28, 0.025), vec3(2.0, 1.15, 0.42), lowerHot + upperHot);
    color = mix(color, warm, clamp(uWarmth * (0.68 + ring * 0.42), 0.0, 0.98));
    color *= 1.0 + uSurge * 0.9;
    alpha *= 1.0 + uSurge * 0.58;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

export const lensingCompositeVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export const lensingCompositeFragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uCenter;
  uniform float uAspect;
  uniform float uHorizonRadius;
  uniform float uStrength;
  uniform float uSurge;
  uniform float uChromaticAberration;
  varying vec2 vUv;

  void main() {
    vec2 aspect = vec2(uAspect, 1.0);
    vec2 offset = (vUv - uCenter) * aspect;
    float horizonRadius = max(uHorizonRadius, 0.001);
    float radius = max(length(offset), 0.0001);
    float normalizedRadius = radius / horizonRadius;
    vec2 direction = offset / radius;
    vec2 tangent = vec2(-direction.y, direction.x);
    float influence = 1.0 - smoothstep(1.08, 4.15, normalizedRadius);
    float horizonGuard = smoothstep(0.86, 1.06, normalizedRadius);
    float surgeStrength = 1.0 + uSurge * 0.22;
    float radialWarp = horizonRadius * influence * horizonGuard * uStrength * surgeStrength;
    radialWarp *= 0.11 / max(normalizedRadius, 1.0) + 0.014;
    float tangentialWarp = horizonRadius * influence * horizonGuard * uStrength * surgeStrength * 0.012;
    tangentialWarp *= (1.0 - clamp(normalizedRadius / 4.15, 0.0, 1.0));
    vec2 warpedOffset = offset + direction * radialWarp + tangent * tangentialWarp;
    vec2 warpedUv = uCenter + warpedOffset / aspect;
    warpedUv = clamp(warpedUv, vec2(0.002), vec2(0.998));

    float photonBand = exp(-pow((normalizedRadius - 1.18) * 8.5, 2.0)) * horizonGuard;
    float chroma = uChromaticAberration * photonBand * horizonRadius;
    vec2 chromaOffset = direction * chroma / aspect;
    vec4 centerSample = texture2D(uTexture, warpedUv);
    vec4 redSample = texture2D(uTexture, clamp(warpedUv + chromaOffset, vec2(0.002), vec2(0.998)));
    vec4 blueSample = texture2D(uTexture, clamp(warpedUv - chromaOffset, vec2(0.002), vec2(0.998)));
    vec4 color = vec4(redSample.r, centerSample.g, blueSample.b, centerSample.a);

    float foldedRadius = horizonRadius * (2.28 - normalizedRadius);
    vec2 foldedOffset = direction * foldedRadius - tangent * tangentialWarp * 1.7;
    vec2 foldedUv = clamp(uCenter + foldedOffset / aspect, vec2(0.002), vec2(0.998));
    vec4 foldedLight = texture2D(uTexture, foldedUv);
    color.rgb += foldedLight.rgb * photonBand * 0.42 * uStrength;
    color.a = max(color.a, foldedLight.a * photonBand * 0.35);
    gl_FragColor = color;
  }
`

export const orbitalParticleVertexShader = /* glsl */ `
  attribute float aAngle;
  attribute float aRadius;
  attribute float aSpeed;
  attribute float aDepth;
  attribute float aThickness;
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform float uMotion;
  uniform float uFlow;
  uniform float uWarmth;
  uniform float uSurge;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float theta = aAngle + uTime * aSpeed * uMotion * uFlow;
    float radialPulse = sin(theta * 3.0 + aPhase + uTime * 0.18) * (0.018 + uSurge * 0.025);
    float radius = aRadius + radialPulse;
    float verticalScale = 0.11 + aThickness * 0.12;
    vec3 orbitPosition = vec3(
      cos(theta) * radius,
      sin(theta) * radius * verticalScale,
      aDepth + sin(theta * 2.0 + aPhase) * 0.09
    );
    vec3 warm = vec3(1.0, 0.38, 0.08);
    vColor = mix(color, warm, uWarmth * (0.24 + uSurge * 0.38));
    vAlpha = 0.58 + 0.34 * sin(theta + aPhase) * sin(theta + aPhase);
    vec4 viewPosition = modelViewMatrix * vec4(orbitPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * (7.0 / max(1.0, -viewPosition.z));
  }
`

export const orbitalParticleFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point);
    float alpha = smoothstep(0.5, 0.08, radius) * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`

export const nebulaVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const nebulaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uQuality;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(41.13, 289.71))) * 951.1357);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec2 p = vUv - 0.5;
    float drift = uTime * 0.01 * uMotion;
    float cloud = noise(p * 4.2 + vec2(drift, -drift * 0.6));
    cloud += noise(p * 9.4 - vec2(drift * 0.7, drift)) * 0.44;
    cloud += noise(p * 18.0 + drift) * 0.16 * uQuality;
    float edge = 1.0 - smoothstep(0.18, 0.73, length(p * vec2(0.76, 1.22)));
    float diagonal = exp(-pow((p.y - p.x * 0.18 + 0.02) * 3.4, 2.0));
    float ribbon = smoothstep(0.58, 1.05, cloud) * edge * diagonal;
    vec3 deepBlue = vec3(0.012, 0.12, 0.34);
    vec3 cyan = vec3(0.02, 0.48, 0.72);
    vec3 violet = vec3(0.19, 0.055, 0.4);
    vec3 color = mix(violet, deepBlue, smoothstep(0.0, 0.7, vUv.x));
    color = mix(color, cyan, smoothstep(0.72, 1.08, cloud) * 0.52);
    gl_FragColor = vec4(color, ribbon * 0.18);
  }
`

export const starVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uMotion;
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = color;
    vTwinkle = 0.72 + 0.28 * sin(uTime * uMotion * 0.9 + aPhase);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = aSize * (7.0 / max(1.0, -viewPosition.z));
  }
`

export const starFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);
    float alpha = smoothstep(0.5, 0.08, distanceToCenter) * vTwinkle;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`
