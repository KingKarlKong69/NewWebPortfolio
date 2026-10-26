const fract = value => value - Math.floor(value)
const hash = index => fract(Math.sin(index * 127.1 + 39.7) * 43758.5453)

// The same authored anchors feed the CSS fallback and the continuous WebGL sky.
export const SPACE_ANCHORS = Array.from({length:62}, (_, index) => {
  const angle = hash(index+1) * Math.PI * 2
  const radius = Math.sqrt(hash(index+101)) * .62
  return {x:55+Math.cos(angle)*radius*100, y:49+Math.sin(angle)*radius*100,
    size:1+hash(index+501)*2.1, phase:hash(index+701)*-18,
    duration:7+hash(index+901)*11, violet:hash(index+43)>.76}
})
