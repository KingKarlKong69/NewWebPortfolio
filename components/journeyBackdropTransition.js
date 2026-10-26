const clamp = value => Math.max(0, Math.min(1, value))

// Retargeting starts from the current blend, so reversing to a photograph
// halfway through a fade never waits for an obsolete transition to finish.
export function createBackdropTransition(source = null, duration = 720) {
  return {
    duration,
    target: source,
    startedAt: 0,
    moving: false,
    layers: source ? [{ source, weight: 1, from: 1 }] : [],
  }
}

export function advanceBackdropTransition(state, now) {
  if (!state.moving) return state
  const progress = clamp((now - state.startedAt) / state.duration)
  const eased = progress * progress * (3 - 2 * progress)
  for (const layer of state.layers) {
    const destination = layer.source === state.target ? 1 : 0
    layer.weight = layer.from + (destination - layer.from) * eased
  }
  if (progress >= 1) {
    state.moving = false
    state.layers = state.layers.filter(layer => layer.source === state.target)
  }
  return state
}

export function retargetBackdropTransition(state, source, now) {
  if (!source) return false
  advanceBackdropTransition(state, now)
  if (state.target === source) return false
  if (!state.layers.length) {
    state.target = source
    state.layers = [{ source, weight: 1, from: 1 }]
    state.moving = false
    return true
  }
  if (!state.layers.some(layer => layer.source === source)) state.layers.push({ source, weight: 0, from: 0 })
  for (const layer of state.layers) layer.from = layer.weight
  state.target = source
  state.startedAt = now
  state.moving = true
  return true
}

// CSS opacity is composited over the layers below it, rather than added.
// Converting blend weights to alpha keeps the backdrop fully opaque through
// a two- or three-photo interruption instead of briefly dimming to black.
export function backdropLayerOpacities(state) {
  let cumulative = 0
  return state.layers.map(layer => {
    cumulative += layer.weight
    return cumulative > 1e-8 ? clamp(layer.weight / cumulative) : 0
  })
}
