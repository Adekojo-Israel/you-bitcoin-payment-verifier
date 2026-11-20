import assert from 'node:assert/strict';
import {TOUR_KEY} from '../src/tour.js';

export async function runOnboardingBrowser(browser,origin){
  const prefs='you.checkout.preferences.v2';
  const targets=['#lookup h2','#wallet h2','#recipient h2','#checklist h2','#settings-open'];
  for(const [width,height] of [[320,640],[390,844],[768,1024],[1366,900]]){
    const reduced=width===768;
    const ctx=await browser.newContext({viewport:{width,height},reducedMotion:reduced?'reduce':'no-preference',
      colorScheme:'light',hasTouch:width<800,isMobile:width<800});
    try{
      const page=await ctx.newPage(), failures=[],external=[];page.on('pageerror',e=>failures.push(e.message));
      page.on('console',e=>{if(/Content Security Policy/.test(e.text()))failures.push(e.text());});
      page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
      const loc=id=>page.locator('#'+id), click=id=>loc(id).click(), hidden=id=>loc(id).waitFor({state:'hidden'});
      const visible=id=>loc(id).waitFor({state:'visible'});
      const persisted=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),TOUR_KEY);
      const theme=()=>page.locator('html').getAttribute('data-theme');
      const mode=value=>page.locator(`input[name=appearance][value=${value}]`);
      const step=async n=>{await page.waitForFunction(n=>document.querySelector('#tour-layer').dataset.tourStep===String(n),n);};
      const fit=async()=>{
        const bounds=await loc('tour-popover').boundingBox();
        assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,`Popover overflow at ${width}`);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      };
      async function assertTarget(selector){
        await page.waitForFunction(selector=>document.querySelector(selector).classList.contains('tour-target'),selector);
        await visible('tour-spotlight');await fit();
        const bounds=await page.locator(selector).boundingBox(); const pop=await loc('tour-popover').boundingBox();
        assert(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height+1&&bounds.x>=0&&bounds.x+bounds.width<=width+1,`Target off screen at ${width}: ${selector}`);
        assert(bounds.x+bounds.width<=pop.x||pop.x+pop.width<=bounds.x||bounds.y+bounds.height<=pop.y||pop.y+pop.height<=bounds.y,`Popover covers ${selector} at ${width}`);
        assert(await page.locator(selector).evaluate(element=>{
          const r=element.getBoundingClientRect();return element.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));
        }),`Overlay intercepts ${selector} at ${width}`);
      }
      await page.goto(origin,{waitUntil:'domcontentloaded'});
      if(reduced){await step(0);assert(!(await loc('tour-intro').isVisible()));}
      else {await visible('tour-intro');assert.equal(await loc('tour-intro').evaluate(el=>getComputedStyle(el).animationName),'tour-intro');await hidden('tour-intro');}
      await step(0);await fit();assert.match(await loc('tour-title').textContent(),/Welcome to YOU/);
      assert.equal(await loc('tour-title').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Tab');assert.equal(await loc('tour-next').evaluate(el=>el===document.activeElement),true);
      await page.keyboard.press('Enter');await step(1);await assertTarget(targets[0]);
      await click('tour-next');await step(2);await assertTarget(targets[1]);
      await click('tour-back');await step(1);await assertTarget(targets[0]);
      for(let i=2;i<=5;i++){await click('tour-next');await step(i);await assertTarget(targets[i-1]);}
      assert.equal(await loc('tour-progress').textContent(),'Step 5 of 6');
      // Click the actual profile control through the spotlight. The overlay must not eat the click.
      await click('settings-open');await visible('settings-panel');
      await click('tour-next');await step(6);await fit();
      assert.equal(await loc('tour-next').textContent(),'Start using YOU');await click('tour-next');await hidden('tour-layer');
      await visible('lookup');assert.equal(await persisted(),'complete');
      await page.reload();await hidden('tour-layer');await hidden('tour-intro');
      assert.match(await loc('settings-open').getAttribute('aria-label'),/Open settings/);
      assert.equal(await loc('settings-open').getAttribute('aria-describedby'),'settings-tip');
      assert.equal(await loc('settings-tip').getAttribute('role'),'tooltip');
      const hit=await loc('settings-open').boundingBox();assert(hit.width>=44&&hit.height>=44);
      await loc('settings-open').focus();await visible('settings-tip');
      const tip=await loc('settings-tip').boundingBox();assert(tip.x>=0&&tip.x+tip.width<=width+1);
      await page.keyboard.press('Enter');await visible('settings-panel');assert.equal(await loc('settings-open').getAttribute('aria-expanded'),'true');
      await mode('dark').check();assert.equal(await theme(),'dark');
      await page.reload();assert.equal(await theme(),'dark');await click('settings-open');await visible('settings-panel');
      assert(await mode('dark').isChecked());
      await click('tour-replay');await step(0);await fit();
      assert.equal(await loc('tour-popover').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(33, 26, 31)');
      await page.keyboard.press('Escape');await hidden('tour-layer');await visible('lookup');
      assert.equal(await persisted(),'skipped');await page.reload();await hidden('tour-layer');
      await click('settings-open');await mode('light').check();assert.equal(await theme(),'light');
      await mode('system').check();await page.emulateMedia({colorScheme:'dark'});
      await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
      await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
      await click('profile-edit');await loc('profile-name').fill('Ife Test');await click('profile-save');await loc('profile-network').selectOption('testnet4');
      await click('settings-save');assert.equal(await loc('settings-save').textContent(),'Saved');
      assert.match(await loc('settings-message').textContent(),/Network preference saved/);
      await loc('profile-network').selectOption('signet');assert.equal(await loc('settings-save').textContent(),'Save network');
      await page.reload();assert.equal(await loc('settings-initials').textContent(),'IT');
      assert.equal(await loc('verify-network').inputValue(),'testnet4');
      await click('settings-open');assert.equal(await loc('profile-display-name').textContent(),'Ife Test');
      await page.evaluate(prefs=>{
        const normal=Storage.prototype.setItem;
        Storage.prototype.setItem=function(key,value){if(key===prefs)throw new Error('Storage blocked for test');return normal.call(this,key,value);};
      },prefs);
      await mode('dark').check();assert.equal(await theme(),'dark');
      assert.match(await loc('appearance-message').textContent(),/storage is unavailable/);
      await click('settings-save');assert.equal(await loc('settings-save').textContent(),'Save network');
      assert.match(await loc('settings-message').textContent(),/could not be saved/);
      assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
    }finally{await ctx.close();}
  }
  // A true first-visit Skip (not a replay) is also persisted.
  const ctx=await browser.newContext({reducedMotion:'reduce'});
  try{
    const page=await ctx.newPage();await page.goto(origin);await page.click('#tour-skip');
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),TOUR_KEY),'skipped');
    await page.reload();assert(!(await page.locator('#tour-layer').isVisible()));
  }finally{await ctx.close();}
  console.log('Onboarding and settings: intro, all six steps, real target hit tests, Back, Skip, replay, reduced motion, tooltip and keyboard, immediate theme, blocked writes, and reload persistence passed at all four viewport sizes.');
}
