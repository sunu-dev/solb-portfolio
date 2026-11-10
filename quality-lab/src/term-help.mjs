const clip=(s,n=3000)=>typeof s==='string'?s.slice(0,n):'';
export function normalizeTermHelp(raw) {
  if(raw?.captured!==true)return null;
  return {captured:true,expected:(Array.isArray(raw.expected)?raw.expected:[]).slice(0,12).map(x=>clip(x,80)),
    linked:(Array.isArray(raw.linked)?raw.linked:[]).slice(0,60).map(x=>clip(x,80)),
    probes:(Array.isArray(raw.probes)?raw.probes:[]).slice(0,3).map(x=>({id:clip(x?.id,80),definition:clip(x?.definition),status:x?.status==='passed'?'passed':'inconclusive'}))};
}
export function expectedTermHelp(text) {
  const expected=[];
  if(/\bETF\b/i.test(text))expected.push('etf');
  if(/기초\s?지수/.test(text))expected.push('benchmark');
  if(/NYSE\s?반도체\s?지수/i.test(text))expected.push('nyse-semiconductor');
  if(/\bNYSE\b/i.test(text.replace(/NYSE\s?반도체\s?지수/gi,'')))expected.push('nyse');
  return expected;
}
export async function captureTermHelp(root,{limit=2}={}) {
  const paragraphs=root.locator('p:visible');let text='';
  for(let i=0;i<Math.min(30,await paragraphs.count());i++)text+='\n'+await paragraphs.nth(i).innerText();
  const expected=expectedTermHelp(text);
  const links=root.locator('button[data-financial-term]'),linked=[];
  for(let i=0;i<await links.count();i++) {
    const id=await links.nth(i).getAttribute('data-financial-term');if(id&&!linked.includes(id))linked.push(id);
  }
  const probes=[];
  for(const id of [...new Set([...expected,...linked])].filter(id=>linked.includes(id)).slice(0,limit)) {
    try {
      await root.locator(`[data-financial-term=${JSON.stringify(id)}]`).first().click();
      const dialog=root.page().locator('[data-financial-term-dialog]');await dialog.waitFor({state:'visible'});
      const definition=await dialog.innerText();
      await dialog.getByRole('button',{name:'용어 설명 닫기',exact:true}).click();await dialog.waitFor({state:'hidden'});
      probes.push({id,definition,status:definition.trim().length>40?'passed':'inconclusive'});
    } catch {
      probes.push({id,definition:'',status:'inconclusive'});
      const close=root.page().locator('[data-financial-term-dialog]').getByRole('button',{name:'용어 설명 닫기',exact:true});
      if(await close.count())await close.click().catch(()=>{});
    }
  }
  return {captured:true,expected,linked,probes};
}
