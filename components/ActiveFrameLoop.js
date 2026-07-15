import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

/**
 * Runs a demand-mode R3F root continuously while its section is active.
 *
 * R3F does not restart a stopped global loop merely because a root switches
 * from `demand` to `always`. Keeping the root in demand mode and owning the
 * next-frame invalidation makes pause/resume transitions deterministic.
 */
export default function ActiveFrameLoop({active}) {
  const invalidate = useThree((state) => state.invalidate)
  const clock = useThree((state) => state.clock)

  useLayoutEffect(() => {
    // Consume the paused wall-clock gap before the first resumed simulation
    // frame so delta-based motion cannot jump after a long offscreen period.
    if (active) clock.getDelta()
    invalidate()
  }, [active, clock, invalidate])

  useFrame((state) => {
    if (active) state.invalidate()
  }, -100)

  return null
}
