export const blackHoleVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const blackHoleFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uMotion;
  uniform float uQuality;
  uniform float uScale;
  uniform vec2 uResolution;
  uniform vec2 uCenter;
  uniform vec2 uPointer;

  varying vec2 vUv;

  const float PI = 3.14159265359;
  const float TAU = 6.28318530718;
  const float HORIZON_RADIUS = 0.72;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    return mix(mix(nx00, nx10, f.y), mix(nx01, nx11, f.y), f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;
    for (int octave = 0; octave < 4; octave++) {
      value += noise3(p) * amplitude;
      p = p * 2.03 + vec3(7.13, 11.71, 5.37);
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 rotateX(vec3 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
  }

  vec3 backgroundSpace(vec3 direction, float time) {
    vec3 dir = normalize(direction);
    vec2 sphereUv = vec2(
      atan(dir.z, dir.x) / TAU + 0.5,
      asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5
    );

    vec2 starGridSize = mix(vec2(190.0, 110.0), vec2(330.0, 185.0), uQuality);
    vec2 starGrid = sphereUv * starGridSize;
    vec2 starCell = floor(starGrid);
    vec2 starPoint = fract(starGrid) - 0.5;
    float randomStar = hash21(starCell);
    float starGate = smoothstep(0.987, 0.9985, randomStar);
    float starShape = smoothstep(0.13, 0.0, length(starPoint));
    float twinkle = 0.72 + 0.28 * sin(time * (0.7 + randomStar) + randomStar * TAU);
    float star = starGate * starShape * twinkle;

    float blueStarGate = smoothstep(0.996, 0.9995, hash21(starCell + 91.7));
    vec3 starColor = mix(vec3(0.62, 0.83, 1.0), vec3(1.0, 0.94, 0.82), randomStar);
    starColor = mix(starColor, vec3(0.3, 0.62, 1.0), blueStarGate);

    float nebulaNoise = fbm(dir * 2.25 + vec3(0.0, time * 0.008, 0.0));
    float nebulaBand = pow(max(0.0, 1.0 - abs(dir.y + dir.x * 0.16)), 4.0);
    vec3 nebula = mix(vec3(0.003, 0.012, 0.028), vec3(0.008, 0.045, 0.095), nebulaNoise);
    nebula *= nebulaBand * (0.2 + nebulaNoise * 0.36);

    return nebula + starColor * star * (0.75 + blueStarGate * 1.8);
  }

  void main() {
    vec2 center = uCenter + uPointer * vec2(0.008, 0.006);
    vec2 p = (vUv - center) * 2.0;
    p.x *= uResolution.x / max(1.0, uResolution.y);
    p /= max(0.1, uScale);

    vec3 rayPosition = vec3(0.0, 0.0, 4.75);
    vec3 rayDirection = normalize(vec3(p, -2.25));
    float stepSize = mix(0.18, 0.13, uQuality);
    float stepLimit = mix(34.0, 50.0, uQuality);
    float absorption = 0.0;
    float hitHorizon = 0.0;
    vec3 accumulatedLight = vec3(0.0);

    for (int stepIndex = 0; stepIndex < 52; stepIndex++) {
      if (float(stepIndex) >= stepLimit) break;

      rayPosition += rayDirection * stepSize;
      float radius = length(rayPosition);
      float gravity = 0.052 / (radius * radius + 0.16);
      rayDirection = normalize(rayDirection - normalize(rayPosition) * gravity * stepSize);

      if (radius < HORIZON_RADIUS) {
        hitHorizon = 1.0;
        break;
      }

      vec3 diskPosition = rotateX(rayPosition, -0.34);
      float diskRadius = length(diskPosition.xz);
      float diskThickness = 0.052 + diskRadius * 0.018;
      float verticalDensity = exp(-abs(diskPosition.y) / diskThickness);
      float innerMask = smoothstep(0.82, 1.08, diskRadius);
      float outerMask = 1.0 - smoothstep(3.05, 4.05, diskRadius);
      float radialMask = innerMask * outerMask;

      float angle = atan(diskPosition.z, diskPosition.x);
      float angularVelocity = 1.12 / pow(max(0.72, diskRadius), 0.78);
      float flowAngle = angle - uTime * uMotion * angularVelocity;
      vec3 flowCoordinates = vec3(
        cos(flowAngle) * diskRadius * 2.35,
        sin(flowAngle) * diskRadius * 2.35,
        uTime * uMotion * 0.085
      );
      float turbulence = fbm(flowCoordinates);
      float fineTurbulence = noise3(
        flowCoordinates * 2.75 + vec3(3.0, -2.0, uTime * uMotion * 0.17)
      );
      float streaks = 0.5 + 0.5 * sin(
        flowAngle * 18.0 + diskRadius * 17.0 - uTime * uMotion * 2.2
      );
      float cloudField = turbulence * 0.78 + fineTurbulence * 0.34 + streaks * 0.24;
      float filaments = smoothstep(0.24, 0.92, cloudField);
      float density = verticalDensity * radialMask * (0.13 + filaments * 1.34);

      float heat = 1.0 - smoothstep(0.92, 3.25, diskRadius);
      float doppler = 0.72 + 0.48 * smoothstep(
        -1.0,
        1.0,
        diskPosition.x / max(0.01, diskRadius)
      );
      vec3 outerColor = vec3(0.18, 0.045, 0.012);
      vec3 middleColor = vec3(1.0, 0.28, 0.045);
      vec3 hotColor = vec3(1.55, 1.08, 0.66);
      vec3 diskColor = mix(outerColor, middleColor, smoothstep(0.0, 0.72, heat));
      diskColor = mix(diskColor, hotColor, pow(heat, 2.2));
      diskColor *= doppler;

      float emission = density * (0.46 + heat * 2.2);
      accumulatedLight +=
        (1.0 - absorption) * diskColor * emission * stepSize * 1.45;
      absorption += (1.0 - absorption) * density * stepSize * 0.34;
      absorption = min(absorption, 0.94);
    }

    float screenRadius = length(p);
    float diskFootprintRadius = length(vec2(p.x / 1.62, p.y / 0.52));
    float diskFootprint = 1.0 - smoothstep(0.68, 1.08, diskFootprintRadius);
    accumulatedLight *= diskFootprint;

    vec3 color = accumulatedLight;
    if (hitHorizon < 0.5) {
      color += backgroundSpace(rayDirection, uTime * uMotion) * (1.0 - absorption);
    }

    // Keep the event horizon optically black while still allowing the
    // foreground accretion material to cross it in the following pass.
    float horizonMask = 1.0 - smoothstep(0.292, 0.322, screenRadius);
    color *= 1.0 - horizonMask;

    float ringIrregularity =
      sin(atan(p.y, p.x) * 9.0 - uTime * uMotion * 0.18) * 0.004;
    float photonRing =
      exp(-pow((screenRadius - 0.365 - ringIrregularity) * 38.0, 2.0));
    float lensHalo = exp(-pow((screenRadius - 0.405) * 12.0, 2.0));
    vec3 ringColor = mix(
      vec3(1.0, 0.31, 0.045),
      vec3(1.55, 1.22, 0.82),
      photonRing
    );
    color += ringColor * photonRing * 1.4;
    color += vec3(0.62, 0.23, 0.055) * lensHalo * 0.18;

    // Restore the original lensed foreground face of the accretion disk. It is
    // intentionally evaluated in polar coordinates so the gas rotates around
    // the hole rather than translating like a flat translucent texture.
    vec2 diskUv = vec2(p.x, p.y * 3.55);
    float screenDiskRadius = length(diskUv);
    float screenDiskAngle = atan(diskUv.y, diskUv.x);
    float screenFlow = screenDiskAngle -
      uTime * uMotion * (1.28 / pow(max(0.48, screenDiskRadius), 0.72));
    float screenNoise = fbm(vec3(
      cos(screenFlow) * screenDiskRadius * 3.1,
      sin(screenFlow) * screenDiskRadius * 3.1,
      uTime * uMotion * 0.09
    ));
    float screenStreaks =
      0.5 + 0.5 * sin(screenFlow * 21.0 + screenDiskRadius * 19.0);
    float frontBand = exp(-abs(p.y) * 27.0);
    frontBand *= smoothstep(0.26, 0.4, screenDiskRadius);
    frontBand *= 1.0 - smoothstep(1.32, 1.72, screenDiskRadius);
    frontBand *= 0.2 + smoothstep(
      0.32,
      0.9,
      screenNoise * 0.72 + screenStreaks * 0.36
    );
    float frontHeat = 1.0 - smoothstep(0.34, 1.48, screenDiskRadius);
    vec3 frontDiskColor = mix(
      vec3(0.48, 0.075, 0.012),
      vec3(1.42, 0.72, 0.24),
      frontHeat
    );
    frontDiskColor = mix(
      frontDiskColor,
      vec3(1.65, 1.3, 0.9),
      pow(frontHeat, 2.6)
    );
    float frontDoppler =
      0.72 + 0.46 * smoothstep(-1.0, 1.0, p.x / max(0.01, screenDiskRadius));
    color += frontDiskColor * frontBand * frontDoppler * 1.28;

    float equatorialLine = exp(-abs(p.y + 0.004) * 72.0);
    equatorialLine *= 1.0 - smoothstep(0.74, 1.62, abs(p.x));
    equatorialLine *= 0.34 + screenNoise * 0.42;
    color += mix(
      vec3(0.8, 0.16, 0.02),
      vec3(1.6, 1.08, 0.62),
      frontHeat
    ) * equatorialLine * 0.72;

    float vignette =
      1.0 - smoothstep(0.62, 1.45, length((vUv - 0.5) * vec2(1.15, 0.9)));
    color *= 0.76 + vignette * 0.28;
    color = 1.0 - exp(-color * 1.08);
    color = pow(max(color, 0.0), vec3(0.88));

    gl_FragColor = vec4(color, 1.0);
  }
`

export const gravitationalDustVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMotion;
  uniform float uPointScale;
  uniform float uTilt;
  uniform float uRoll;

  attribute vec4 aOrbit;
  attribute vec4 aVariation;

  varying float vAlpha;
  varying float vHeat;

  void main() {
    float baseRadius = aOrbit.x;
    float phase = aOrbit.y;
    float speed = aOrbit.z;
    float inclination = aOrbit.w;
    float eccentricity = aVariation.x;
    float verticalOffset = aVariation.y;
    float pointSize = aVariation.z;
    float temperature = aVariation.w;

    float angle = phase + uTime * uMotion * speed / pow(baseRadius, 0.72);
    float radius = baseRadius * (1.0 - eccentricity * eccentricity) /
      max(0.35, 1.0 + eccentricity * cos(angle));
    float gravity = 1.0 / (radius * radius + 0.35);

    vec3 orbitPosition = vec3(
      cos(angle) * radius,
      sin(angle * 1.17 + phase) * inclination + verticalOffset,
      sin(angle) * radius
    );

    float tilt = uTilt;
    float tiltCos = cos(tilt);
    float tiltSin = sin(tilt);
    orbitPosition.yz =
      mat2(tiltCos, -tiltSin, tiltSin, tiltCos) * orbitPosition.yz;
    float rollCos = cos(uRoll);
    float rollSin = sin(uRoll);
    orbitPosition.xy =
      mat2(rollCos, -rollSin, rollSin, rollCos) * orbitPosition.xy;

    if (orbitPosition.z < 0.0) {
      float lensing =
        (1.0 - smoothstep(0.78, 2.65, length(orbitPosition.xy))) * 0.38;
      orbitPosition.xy *= 1.0 + lensing;
      orbitPosition.y += sign(orbitPosition.y + 0.0001) * lensing * 0.16;
    }

    vec4 viewPosition = modelViewMatrix * vec4(orbitPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(
      1.0,
      pointSize * uPointScale * (1.0 + gravity * 1.6) /
        max(1.0, -viewPosition.z)
    );
    vAlpha = (0.28 + temperature * 0.68) * (0.76 + gravity * 0.72);
    vHeat = temperature;
  }
`

export const gravitationalDustFragmentShader = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying float vHeat;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);
    float core = smoothstep(0.48, 0.02, distanceToCenter);
    float halo = smoothstep(0.5, 0.12, distanceToCenter) * 0.46;
    vec3 coolColor = vec3(0.16, 0.62, 0.86);
    vec3 warmColor = vec3(1.0, 0.48, 0.14);
    vec3 hotColor = vec3(1.0, 0.93, 0.72);
    vec3 color = mix(coolColor, warmColor, smoothstep(0.12, 0.72, vHeat));
    color = mix(color, hotColor, smoothstep(0.72, 1.0, vHeat));
    gl_FragColor = vec4(color, (core + halo) * vAlpha);
  }
`
