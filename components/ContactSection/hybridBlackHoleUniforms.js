const uniformName = key => `u${key[0].toUpperCase()}${key.slice(1)}`

// Shared objects deliberately alias the live controls. Each material owns only
// its integrated phase and region-specific adapters, never a stale value copy.
export function createHybridBlackHoleUniforms(controls) {
  const uniforms = {
    ...Object.fromEntries(controls.map(control => [uniformName(control.key), {value:control.defaultValue}])),
    uTurbulencePhase:{value:0}, uArrival:{value:1},
    uInnerRadius:{value:.56}, uOuterRadius:{value:2.15},
    uGasLayer:{value:0}, uGasWeight:{value:.4}, uPixelRatio:{value:1}
  }
  const localUniforms = part => ({
    ...uniforms,
    uMaterialFlowPhase:{value:0},
    ...Object.fromEntries(['FilamentDensity','FilamentContrast','TurbulenceStrength',
      'TurbulenceScale','GrainStrength','FineDetail'].map(suffix =>
      [`uLocal${suffix}`, uniforms[uniformName(`${part}${suffix}`)]]))
  })
  const arcUniforms = (part, sign) => ({
    ...localUniforms(part),
    uArcSign:{value:sign},
    uArcThickness:uniforms[uniformName(`${part}Thickness`)],
    uArcSpread:part==='upper'?uniforms.uOuterSpread:uniforms.uLowerThickness,
    uArcHeight:uniforms[uniformName(`${part}Height`)],
    uArcDepth:uniforms[uniformName(`${part}Depth`)],
    uArcBrightness:uniforms[uniformName(`${part}Brightness`)],
    uArcEmphasis:part==='upper'?uniforms.uUpperEmphasis:{value:1},
    uArcVisibility:part==='lower'?uniforms.uLowerVisibility:{value:1},
    uArcJunctionBlend:uniforms[uniformName(`${part}JunctionBlend`)]
  })
  return {uniforms, diskUniforms:localUniforms('disk'),
    upperUniforms:arcUniforms('upper', 1), lowerUniforms:arcUniforms('lower', -1)}
}
