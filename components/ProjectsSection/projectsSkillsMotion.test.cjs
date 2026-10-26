const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const motion = import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(join(__dirname, 'projectStoryMotion.js'), 'utf8'),
).toString('base64')}`)
const close = (actual, expected, message, tolerance = 1e-10) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} versus ${expected}`)
}
const exitAt = (sample, layout, progress, count = 4, output) => sample(
  layout.projectsEnd + (layout.transitionEnd - layout.projectsEnd) * progress, count, output,
)

test('Services overlaps the completed whiteout and becomes visible without a star-only tail', async () => {
  const {projectsSkillsLayout, sampleSkillsExpedition, SERVICES_HANDOFF_START:start, SERVICES_HANDOFF_END:end} = await motion
  const layout=projectsSkillsLayout(4)
  close(layout.height-layout.servicesOverlap,1900+1550+4800*start,'incoming section begins at full white')
  close(layout.servicesEntryHold,4800*(end-start),'incoming title holds through the crossfade')
  close(layout.servicesEntryHold,60,'short shared transition distance')
  assert.equal(sampleSkillsExpedition(start).whiteout,1)
  assert.equal(sampleSkillsExpedition(start).servicesReveal,0)
  assert.equal(sampleSkillsExpedition(end).servicesReveal,1)
  const middle=sampleSkillsExpedition((start+end)/2).servicesReveal
  assert.ok(middle>0 && middle<1)
})

test('the appended Skills act preserves original project scroll distances and chapter destinations', async () => {
  const { projectsSkillsLayout: layoutFor, projectsSkillsStop: stop, projectStoryStop: originalStop,
    sampleProjectsSkillsStory: sample, sampleProjectStory: original } = await motion
  for (const count of [1, 2, 4, 5, 8]) {
    const layout = layoutFor(count)
    const originalDistance = 700 + count * 300
    const totalDistance = layout.height - 100
    close(layout.projectsEnd * totalDistance, originalDistance, 'original project distance')
    close(layout.transitionEnd * totalDistance - originalDistance, 1550, 'extended space travel distance')
    close(totalDistance - layout.transitionEnd * totalDistance, 4800, 'slower native expedition distance')
    assert.ok(layout.skillsStop > layout.projectsEnd && layout.skillsStop < 1)
    for (let chapter = 0; chapter < count; chapter += 1) {
      close(stop(chapter, count) * totalDistance,
        originalStop(chapter, count) * originalDistance, 'chapter physical destination')
      const held = sample(stop(chapter, count), count)
      assert.equal(held.projectIndex, chapter)
      assert.equal(held.copyOpacity, 1)
      assert.equal(held.actionsReveal, 1)
      assert.equal(held.screenCurrentIndex, chapter)
      assert.equal(held.screenNextIndex, chapter)
      assert.equal(held.skillsProgress, 0)
    }
    for (let index = 0; index <= 250; index += 1) {
      const progress = index / 250
      const previous = original(progress, count)
      const composed = sample(progress * layout.projectsEnd, count)
      for (const field of Object.keys(previous).filter(field => field !== 'progress')) {
        close(composed[field], previous[field], `unchanged project channel ${field}`, 1e-9)
      }
    }
  }
})

test('the final copy clears, its screen powers off, and the cosmos appears after a dark beat', async () => {
  const { projectsSkillsLayout: layoutFor, sampleProjectsSkillsStory: sample } = await motion
  const layout = layoutFor()
  const at = progress => exitAt(sample, layout, progress)
  const start = at(0)
  assert.equal(start.copyOpacity, 1)
  assert.equal(start.screenExit, 0)
  assert.equal(start.cosmosReveal, 0)
  assert.ok(at(.05).copyOpacity < 1 && at(.05).copyOpacity > 0)
  assert.equal(at(.05).screenExit, 0)
  assert.equal(at(.1).copyOpacity, 0)
  assert.ok(at(.12).screenExit > 0 && at(.12).screenExit < 1)
  for (const progress of [.185, .20, .215]) {
    const dark = at(progress)
    assert.equal(dark.screenExit, 1, 'project image has completely exited')
    assert.equal(dark.cosmosReveal, 0, 'the display holds dark before the cosmos')
    assert.equal(dark.screenPower, 1, 'the screen material stays present during the dark beat')
  }
  assert.ok(at(.27).cosmosReveal > 0 && at(.27).cosmosReveal < 1)
  assert.equal(at(.33).cosmosReveal, 1)
  assert.equal(at(.33).portalDolly, 0)
})

test('the centered laptop aligns its actual open screen plane before the camera enters', async () => {
  const { projectsSkillsLayout: layoutFor, sampleProjectsSkillsStory: sample } = await motion
  const layout = layoutFor()
  const front = exitAt(sample, layout, .50)
  assert.equal(front.laptopX, .5)
  assert.equal(front.laptopY, .54)
  close(front.laptopRotationY, 0, 'front-facing yaw')
  close(front.laptopRotationZ, 0, 'front-facing roll')
  assert.equal(front.lidOpen, 1)
  assert.equal(front.screenCenterAlignment, 1)
  assert.equal(front.portalDolly, 0)
  const cameraPitch = -Math.atan2(2.02, 10.2)
  const openLidPitch = -.09
  close(front.laptopRotationX + openLidPitch, cameraPitch,
    'open display pitch matches the camera pitch')
  const entering = exitAt(sample, layout, .60)
  assert.ok(entering.portalDolly > 0 && entering.portalDolly < 1)
  close(entering.laptopRotationX + openLidPitch, cameraPitch, 'alignment remains fixed while entering')
  close(entering.laptopRotationY, 0, 'entry yaw')
  close(entering.laptopRotationZ, 0, 'entry roll')
  assert.equal(entering.portalOpacity, 0)
})

test('portal takeover, landscape formation, and the Skills opening occur in their required order', async () => {
  const { projectsSkillsLayout: layoutFor, sampleProjectsSkillsStory: sample } = await motion
  const layout = layoutFor()
  const at = progress => exitAt(sample, layout, progress)
  assert.ok(at(.69).portalOpacity > 0 && at(.69).portalOpacity < 1)
  assert.equal(at(.69).laptopOpacity, 1, 'opaque laptop screen remains beneath the matching handoff')
  assert.equal(at(.69).terrainFormation, 0)
  assert.equal(at(.71).portalOpacity, 1)
  assert.equal(at(.71).laptopOpacity, 0)
  assert.equal(at(.74).terrainFormation, 0)
  assert.ok(at(.85).terrainFormation === 0, 'space travel precedes terrain')
  assert.equal(at(.85).skillsReveal, 0)
  assert.equal(at(.97).terrainFormation, 1)
  assert.ok(at(.98).skillsReveal > 0 && at(.98).skillsReveal < 1)
  assert.ok(at(.98).skillsGlitch > 0)
  const reading = sample(layout.skillsStop)
  assert.equal(reading.terrainFormation, 1)
  assert.equal(reading.worldTravel, 1)
  assert.equal(reading.worldExpand, 1)
  assert.equal(reading.skillsReveal, 1)
  assert.ok(reading.skillsGlitch < 1e-20, 'the settled Skills text is clean')
  assert.equal(reading.copyOpacity, 0)
  assert.equal(reading.laptopOpacity, 0)
  assert.equal(reading.dotOpacity, 0)
  assert.equal(reading.backlightOpacity, 0)
  for (let index = 0; index <= 4000; index += 1) {
    const state = at(index / 4000)
    if (state.portalOpacity > 0) {
      assert.equal(state.portalDolly, 1, 'full-screen takeover waits for the completed camera approach')
      assert.equal(state.cosmosReveal, 1)
    }
    if (state.terrainFormation > 0) assert.equal(state.portalOpacity, 1)
    if (state.skillsReveal > 0) assert.equal(state.terrainFormation, 1)
  }
})

test('backward sampling restores every numeric channel exactly, including partial portal and terrain states', async () => {
  const { sampleProjectsSkillsStory: sample } = await motion
  for (const count of [1, 4, 8]) {
    const forward = Array.from({ length: 3001 }, (_, index) => sample(index / 3000, count))
    const reusable = {}
    for (let index = forward.length - 1; index >= 0; index -= 1) {
      assert.equal(sample(index / 3000, count, reusable), reusable)
      assert.deepEqual(reusable, forward[index])
      assert.ok(Object.values(reusable).every(Number.isFinite))
    }
  }
})

test('exit stage boundaries remain continuous and all transition channels stay finite and bounded', async () => {
  const { projectsSkillsLayout: layoutFor, projectsSkillsStop: stop,
    sampleProjectsSkillsStory: sample } = await motion
  const channels = ['skillsProgress', 'copyExit', 'screenExit', 'cosmosReveal', 'screenCenterAlignment',
    'portalDolly', 'portalOpacity', 'worldExpand', 'worldTravel', 'terrainFormation',
    'skillsReveal', 'skillsGlitch', 'backlightOpacity']
  const boundaries = [0, .075, .095, .18, .22, .27, .28, .32, .37, .45, .49, .50,
    .54, .57, .67, .68, .70, .705, .755, .78, .92, .935, .94, .978, .985, 1]
  for (const count of [1, 4, 8]) {
    const layout = layoutFor(count)
    for (const boundary of boundaries) {
      const before = exitAt(sample, layout, boundary - 1e-8, count)
      const after = exitAt(sample, layout, boundary + 1e-8, count)
      for (const field of Object.keys(before)) {
        close(before[field], after[field], `continuous ${field} at exit ${boundary}`, 1e-4)
      }
    }
    for (let index = 0; index <= 3000; index += 1) {
      const state = sample(index / 3000, count)
      assert.ok(Object.values(state).every(Number.isFinite))
      for (const channel of channels) {
        assert.ok(state[channel] >= 0 && state[channel] <= 1, `${channel}: ${state[channel]}`)
      }
    }
  }
  for (const progress of [undefined, null, '0.5', {}, NaN, -Infinity, -1]) {
    assert.deepEqual(sample(progress), sample(0))
  }
  for (const progress of [Infinity, 2]) assert.deepEqual(sample(progress), sample(1))
  for (const count of [undefined, NaN, Infinity, 0, -1, '4', {}]) {
    assert.ok(Object.values(layoutFor(count)).every(Number.isFinite))
    assert.ok(Number.isFinite(stop(NaN, count)))
    assert.ok(Object.values(sample(.8, count)).every(Number.isFinite))
  }
})
