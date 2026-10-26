// A stable shuffled bag per year. Rewinding reuses the exact panel assignments.
export function shuffleMemoryImages(images,random=Math.random){
  const result=[...images]
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}
  return result
}
