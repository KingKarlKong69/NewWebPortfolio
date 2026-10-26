const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const source = readFileSync(join(__dirname, 'heroRoles.js'), 'utf8')
const api = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

test('typewriter types, holds, erases, and leaves a gap before advancing', async () => {
  const {getHeroRoleFrame, HERO_ROLES} = await api
  const title = HERO_ROLES[0]
  const typedAt = title.length * 60
  const eraseAt = typedAt + 1900
  assert.equal(getHeroRoleFrame(0).text, '')
  assert.equal(getHeroRoleFrame(60).text, 'B')
  assert.equal(getHeroRoleFrame(typedAt).text, title)
  assert.equal(getHeroRoleFrame(eraseAt - 1).text, title)
  assert.equal(getHeroRoleFrame(eraseAt + 32).text, title.slice(0, -1))
  assert.equal(getHeroRoleFrame(eraseAt + title.length * 32 + 100).text, '')
  assert.equal(getHeroRoleFrame(eraseAt + title.length * 32 + 280).index, 1)
})

test('every supplied role appears in order, including both Research Lead entries', async () => {
  const {getHeroRoleFrame, HERO_ROLES} = await api
  const expected = ['Back-end Developer', 'Front-end Developer', 'AI-Native Developer', 'Junior DevOps', 'UI/UX Designer', 'Mobile App Developer', 'Research Lead', 'IT Support', 'Database Administrator', 'Research Lead', 'Aspiring 3D Web Developer']
  assert.deepEqual(HERO_ROLES, expected)
  let time = 0
  for (const [index, title] of expected.entries()) {
    const frame = getHeroRoleFrame(time + title.length * 60 + 500)
    assert.equal(frame.text, title)
    assert.equal(frame.index, index)
    time += title.length * 92 + 2180
  }
  assert.equal(getHeroRoleFrame(time).index, 0)
  assert.equal(getHeroRoleFrame(time + 60).text, 'B')
})
