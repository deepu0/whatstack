// Real captures of the unpacked WhatStack extension (v1.7.2) on real sites.
// Popup: the real popup.html + real service worker + real deep scan. Only chrome.tabs.query is pointed at the target tab
// (a popup opened as a tab would otherwise scan itself). Clipboard writes are recorded so exports are the real output.
import {chromium} from '/projects/sandbox/tools/node_modules/playwright/index.mjs';
import fs from 'fs';import os from 'os';import path from 'path';
const EXT='/projects/sandbox/whatstack';const OUT='/projects/sandbox/whatstack-video/cap/';fs.mkdirSync(OUT,{recursive:true});
const only=process.argv[2]?process.argv[2].split(','):null;
const ctx=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'ws-')),{channel:'chromium',headless:true,
  viewport:{width:1440,height:900},deviceScaleFactor:3,locale:'en-US',colorScheme:'dark',
  args:[`--disable-extensions-except=${EXT}`,`--load-extension=${EXT}`,'--disable-features=DisableLoadExtensionCommandLineSwitch','--no-sandbox','--no-first-run']});
const sw=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:20000});
const id=new URL(sw.url()).host;
const meta=fs.existsSync(OUT+'meta.json')?JSON.parse(fs.readFileSync(OUT+'meta.json')):{};
const R=b=>b&&{x:+b.x.toFixed(1),y:+b.y.toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1)};
async function dismiss(page){
  for(const re of [/^Accept all( cookies)?$/i,/^Accept$/i,/^Allow all( cookies)?$/i,/^I agree$/i,/^Got it$/i,/^OK$/i,/^Accept All Cookies$/i,/^Only allow essential cookies$/i,/^Reject all$/i,/^Close$/i]){
    const b=page.getByRole('button',{name:re}).first();if(await b.isVisible().catch(()=>false)){await b.click({timeout:2000}).catch(()=>{});await page.waitForTimeout(500);}}
}
async function popupFor(tab,name,{expand=null,exports=false}={}){
  const pop=await ctx.newPage();await pop.setViewportSize({width:360,height:600});
  await pop.addInitScript(t=>{const q=chrome.tabs.query.bind(chrome.tabs);chrome.tabs.query=async o=>(o&&o.active)?[{id:t.id,url:t.url,active:true}]:q(o);
    window.__copied=[];const w=navigator.clipboard&&navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText=async s=>{window.__copied.push(s);try{await w(s)}catch(e){}};},tab);
  await pop.goto(`chrome-extension://${id}/popup/popup.html`);
  await pop.waitForFunction(()=>!document.querySelector('#results')?.hidden||!document.querySelector('#empty')?.hidden,null,{timeout:30000}).catch(()=>{});
  await pop.waitForTimeout(800);
  // natural (capped, like the real popup) + full-height versions
  const natH=await pop.evaluate(()=>Math.min(document.body.scrollHeight,560));await pop.setViewportSize({width:360,height:natH});
  await pop.screenshot({path:OUT+`pop-${name}-nat.png`,scale:'device'});
  await pop.addStyleTag({content:'body{max-height:none!important;overflow:visible!important}.header,.footer{position:static!important}'});
  const boxes=async()=>pop.evaluate(()=>{const R=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};
    return {status:document.querySelector('#status')?.innerText,headline:R(document.querySelector('#headline')),headlineText:document.querySelector('#headline')?.innerText,
      sections:[...document.querySelectorAll('.section')].map(s=>({title:s.querySelector('.section-title')?.innerText,...R(s)})),
      hits:[...document.querySelectorAll('.hit-row')].map(h=>({text:h.innerText.replace(/\s+/g,' '),...R(h),badge:R(h.querySelector('.badge,[class*=badge],[class*=conf]')||h.lastElementChild)})),
      low:(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/Lower confidence/i.test(e.textContent));return e?R(e):null})(),
      evidence:[...document.querySelectorAll('.hit.open .evidence')].map(R),
      buttons:Object.fromEntries([...document.querySelectorAll('button')].map(b=>[b.innerText.trim()||b.title,R(b)])),
      local:(()=>{const e=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&/^Local only$/.test(e.textContent.trim()));return e?R(e):null})(),
      url:document.querySelector('#page-url')?.innerText,H:document.body.scrollHeight}});
  let h=await pop.evaluate(()=>document.body.scrollHeight);await pop.setViewportSize({width:360,height:h});await pop.waitForTimeout(200);
  const m={nat:natH,...await boxes()};await pop.screenshot({path:OUT+`pop-${name}.png`,scale:'device'});
  if(expand){const row=pop.locator('.hit-row',{hasText:expand}).first();await row.click();await pop.waitForTimeout(400);
    h=await pop.evaluate(()=>document.body.scrollHeight);await pop.setViewportSize({width:360,height:h});await pop.waitForTimeout(200);
    m.expanded=await boxes();m.expanded.evidenceText=await pop.evaluate(()=>[...document.querySelectorAll('.hit.open .evidence li')].map(l=>l.innerText));
    await pop.screenshot({path:OUT+`pop-${name}-open.png`,scale:'device'});await row.click();await pop.waitForTimeout(300);}
  if(exports){m.exports={};for(const [label,key] of [['Copy','text'],['MD','md'],['JSON','json']]){
      await pop.getByRole('button',{name:label,exact:true}).first().click().catch(e=>console.log('btn',label,e.message.slice(0,80)));await pop.waitForTimeout(400);
      m.exports[key]=await pop.evaluate(()=>window.__copied[window.__copied.length-1]||null);m.exports[key+'Status']=await pop.evaluate(()=>document.querySelector('#status')?.innerText);}}
  await pop.close();return m;
}
const sites=[['stripe','https://stripe.com/'],['notion','https://www.notion.com/'],['nextjs','https://nextjs.org/'],['netflix','https://www.netflix.com/'],
             ['react','https://react.dev/'],['vuejs','https://vuejs.org/'],['airbnb','https://www.airbnb.com/'],['github','https://github.com/']];
for(const [name,url] of sites){ if(only&&!only.includes(name))continue;
  const page=await ctx.newPage();
  try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});}catch(e){console.log(name,'nav fail');continue;}
  await page.waitForTimeout(4000);await dismiss(page);await page.waitForTimeout(2500);await page.mouse.move(2,2);
  await page.screenshot({path:OUT+`page-${name}.jpg`,type:'jpeg',quality:90});
  const host=new URL(page.url()).host;
  const tab=await sw.evaluate(async h=>{const t=(await chrome.tabs.query({})).find(t=>t.url&&new URL(t.url).host===h);return {id:t.id,url:t.url}},host);
  const light=await sw.evaluate(async i=>({badge:await chrome.action.getBadgeText({tabId:i}),title:await chrome.action.getTitle({tabId:i})}),tab.id);
  const pm=await popupFor(tab,name,{expand:name==='stripe'?'Next.js':null,exports:name==='stripe'});
  const deep=await sw.evaluate(async i=>({badge:await chrome.action.getBadgeText({tabId:i}),title:await chrome.action.getTitle({tabId:i})}),tab.id);
  meta[name]={url:page.url(),light,deep,popup:pm};
  console.log(name,'| light',light.badge,'| deep',deep.badge,'|',pm.status,'|',(pm.headlineText||'').replace(/\s+/g,' '));
  if(name==='stripe'){const r=await ctx.request.get(url,{headers:{'user-agent':'Mozilla/5.0'}});fs.writeFileSync(OUT+'src-stripe.html',await r.text());}
  await page.close();
}
// Chrome Web Store listing (logged out) — top of page only
if(!only||only.includes('store')){
  const st=await ctx.newPage();
  await st.goto('https://chromewebstore.google.com/detail/whatstack/kpmbanlddakoocgimdenfeppfaidmcgk?hl=en',{waitUntil:'networkidle',timeout:60000}).catch(()=>{});
  await st.waitForTimeout(3000);await st.getByRole('button',{name:/No thanks/i}).first().click({timeout:3000}).catch(()=>{});await st.waitForTimeout(600);await dismiss(st);await st.mouse.move(2,2);
  const add=st.getByRole('button',{name:/Add to Chrome|Remove from Chrome/}).first();
  meta.store={add:R(await add.boundingBox().catch(()=>null)),addText:await add.innerText().catch(()=>null),
    title:R(await st.getByRole('heading',{name:'WhatStack'}).first().boundingBox().catch(()=>null))};
  await st.screenshot({path:OUT+'store.jpg',type:'jpeg',quality:90});console.log('store',meta.store);await st.close();
}
fs.writeFileSync(OUT+'meta.json',JSON.stringify(meta,null,1));await ctx.close();
