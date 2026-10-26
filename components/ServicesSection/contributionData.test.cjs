const assert = require('node:assert/strict')
const {test} = require('node:test')
const {readFileSync} = require('node:fs')
const {join} = require('node:path')
const source = readFileSync(join(__dirname,'contributionData.js'),'utf8')
const mathPromise = import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

function calendarHtml({omitTooltip = -1, oldAttributes = false} = {}) {
  const days = Array.from({length:365}, (_,index) => ({date:new Date(Date.UTC(2025,0,1+index)).toISOString().slice(0,10),count:index%6}))
  const html = days.map((day,index) => `<td id="day-${index}" data-date="${day.date}" data-level="${Math.min(4,day.count)}"${oldAttributes ? ` data-count="${day.count}"` : ''}></td>${index===omitTooltip ? '' : `<tool-tip for="day-${index}">${day.count ? `${day.count} contribution${day.count===1 ? '' : 's'}` : 'No contributions'} on date.</tool-tip>`}`).join('')
  return {html, days}
}

test('calendar counts come from explicit GitHub tooltips and are summed without inferring intensity',async()=>{
  const {parseContributionCalendar} = await mathPromise
  const {html,days} = calendarHtml()
  const result = parseContributionCalendar(html)
  assert.equal(result.days.length,365)
  assert.equal(result.total,days.reduce((total,day)=>total+day.count,0))
  assert.equal(result.days[5].count,5)
  assert.equal(result.days[5].level,4)
  assert.equal(result.from,'2025-01-01')
  assert.equal(result.to,'2025-12-31')
})

test('an absent count or missing date rejects the calendar rather than fabricating activity',async()=>{
  const {parseContributionCalendar} = await mathPromise
  assert.throws(()=>parseContributionCalendar(calendarHtml({omitTooltip:100}).html),/missing dates/)
  assert.throws(()=>parseContributionCalendar('<td data-date="2025-01-01" data-level="4"></td>'),/incomplete/)
})

test('legacy explicit counts and Sunday-first padded weeks preserve all real dates',async()=>{
  const {parseContributionCalendar,calendarWeeks} = await mathPromise
  const result = parseContributionCalendar(calendarHtml({oldAttributes:true}).html)
  const weeks = calendarWeeks(result.days)
  assert.equal(weeks[0][0],null)
  assert.equal(weeks[0][3].date,'2025-01-01')
  assert.deepEqual(weeks.flat().filter(Boolean),result.days)
  assert.equal(weeks.every(week=>week.length===7),true)
  assert.deepEqual(calendarWeeks([]),[])
})
