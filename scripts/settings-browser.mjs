import assert from 'node:assert/strict';
import {TOUR_KEY} from '../src/tour.js';
const PROFILE='you.checkout.profile.v1', PREFS='you.checkout.preferences.v2';

export async function runSettingsBrowser(browser,origin){
  for(const [width,height] of [[320,640],[390,844],[768,1024],[1366,900]]){
    const ctx=await browser.newContext({viewport:{width,height},colorScheme:'light',hasTouch:width<800,isMobile:width<800});
    try{
      await ctx.addInitScript(({tour,prefs})=>{
        localStorage.setItem(tour,JSON.stringify('complete'));
        if(localStorage.getItem(prefs)===null)localStorage.setItem(prefs,JSON.stringify({name:'Legacy Profile',theme:'system',network:'signet'}));
      },{tour:TOUR_KEY,prefs:PREFS});
      const page=await ctx.newPage(),issues=[],external=[];
      page.on('pageerror',err=>issues.push(err.message));
      page.on('console',msg=>{if(/Content Security Policy/.test(msg.text()))issues.push(msg.text());});
      page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(origin))external.push(r.url());});
      const el=id=>page.locator('#'+id), click=id=>el(id).click();
      const mode=value=>page.locator(`input[name=appearance][value=${value}]`);
      const appearance=()=>page.locator('html').getAttribute('data-theme');
      const prefs=()=>page.evaluate(key=>localStorage.getItem(key),PREFS);
      const profile=()=>page.evaluate(key=>localStorage.getItem(key),PROFILE);
      const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`);
      const locked=async()=>{
        assert(await el('profile-view').isVisible());assert(!(await el('profile-form').isVisible()));
        assert(await el('profile-name').isDisabled());assert(await el('profile-image').isDisabled());
        assert.equal(await el('profile-edit').getAttribute('aria-expanded'),'false');
        assert(await mode('dark').isVisible());assert(await mode('dark').isEnabled());
      };
      await page.goto(origin);await click('settings-open');await locked();await fit();
      assert.deepEqual(await page.locator('#settings-panel > section > div > h3').allTextContents(),
        ['Getting started','Profile','Appearance','Network preferences','Privacy and security','About YOU']);
      assert.equal(await el('profile-display-name').textContent(),'Legacy Profile');
      assert.equal(await page.locator('#profile-form input').count(),2);
      assert.equal(await page.locator('#profile-form input[name=appearance], #settings-profile #profile-theme').count(),0);
      assert.equal(await page.locator('#settings-appearance input[name=appearance]').count(),3);
      await mode('dark').check();assert.equal(await appearance(),'dark');await locked();assert.equal(await profile(),null);
      await page.reload();assert.equal(await appearance(),'dark');await click('settings-open');await locked();assert(await mode('dark').isChecked());
      await mode('light').check();assert.equal(await appearance(),'light');await locked();
      await mode('system').check();await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');
      await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');
      await click('profile-edit');assert(await el('profile-form').isVisible());assert(await el('profile-name').isEnabled());await fit();
      await el('profile-name').fill('Nneka Example');await mode('dark').check();assert.equal(await appearance(),'dark');
      assert(await el('profile-form').isVisible());assert.equal(await el('profile-name').inputValue(),'Nneka Example');
      assert.equal(await profile(),null);assert.equal(JSON.parse(await prefs()).name,'Legacy Profile');
      const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=32;
        const ctx=c.getContext('2d');ctx.fillStyle='#421629';ctx.fillRect(0,0,20,32);return c.toDataURL().split(',')[1];});
      await el('profile-image').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
      await page.waitForFunction(()=>document.querySelector('#draft-photo').naturalWidth===128);
      assert(!(await el('settings-photo').isVisible()));
      const before=await prefs();await click('profile-save');await locked();
      assert.equal(await el('profile-message').textContent(),'Profile saved successfully.');
      assert.equal(await el('profile-display-name').textContent(),'Nneka Example');assert(await el('settings-photo').isVisible());
      assert.equal(await prefs(),before,'Save Profile must not write theme or network settings');
      assert.equal((JSON.parse(await profile())).name,'Nneka Example');
      await page.reload();assert.equal(await appearance(),'dark');assert(await el('settings-photo').isVisible());
      await click('settings-open');await locked();assert.equal(await el('profile-display-name').textContent(),'Nneka Example');
      const committed=await profile();await click('profile-edit');await el('profile-name').fill('Discard me');
      await click('profile-initials');assert(await el('draft-avatar').isVisible());await click('profile-cancel');await locked();
      assert.equal(await el('profile-display-name').textContent(),'Nneka Example');assert.equal(await profile(),committed);assert(await el('profile-photo').isVisible());
      await click('profile-edit');await el('profile-image').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
      await page.waitForFunction(()=>document.querySelector('#profile-message').textContent.includes('Could not open'));
      await page.evaluate(key=>{const put=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw Error('Blocked');return put.call(this,k,v);};},PROFILE);
      await el('profile-name').fill('Not saved');await click('profile-save');assert(await el('profile-form').isVisible());
      assert.match(await el('profile-message').textContent(),/could not be saved/);assert.equal(await profile(),committed);
      await click('profile-cancel');await locked();await click('tour-start');await el('tour-layer').waitFor({state:'visible'});
      await click('tour-skip');await click('settings-open');await click('tour-replay');await el('tour-layer').waitFor({state:'visible'});
      await click('tour-skip');assert.deepEqual(issues,[]);assert.deepEqual(external,[]);
    }finally{await ctx.close();}
  }
  console.log('Settings sections and profile: order, locked defaults, independent radios/storage, local picture validation, save, cancel, reload, failed write, and both tour links passed at all four viewport sizes.');
}
