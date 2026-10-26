const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const modulePromise = import(`data:text/javascript;base64,${Buffer.from(readFileSync(join(__dirname, 'projectActions.js'), 'utf8')).toString('base64')}`)

test('live projects preserve their destination and expose a separate case study action', async () => {
  const { getProjectActions } = await modulePromise
  const actions = getProjectActions({ liveUrl: 'https://example.com/project' })
  assert.deepEqual(actions.map(action => action.label), ['Visit Site', 'Case Study'])
  assert.equal(actions[0].href, 'https://example.com/project')
  assert.equal(actions[1].href, null)
})

test('a project without a live deployment keeps its existing local project details action', async () => {
  const { getProjectActions } = await modulePromise
  assert.deepEqual(getProjectActions({}).map(action => [action.label, action.href]), [['View Project', null]])
})

test('explicit actions support every requested single and paired arrangement without inventing a URL', async () => {
  const { getProjectActions } = await modulePromise
  for (const types of [['viewProject', 'caseStudy'], ['caseStudy'], ['viewProject']]) {
    assert.deepEqual(getProjectActions({ actions: types.map(type => ({ type })) }).map(action => action.type), types)
  }
  assert.deepEqual(getProjectActions({ actions: [{ type: 'visitSite' }] }), [])
  assert.deepEqual(getProjectActions({ actions: [] }), [])
})
