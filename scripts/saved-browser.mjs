import assert from 'node:assert/strict';
import {TOUR_KEY} from '../src/tour.js';
import {address, networks} from 'bitcoinjs-lib';

export async function runSavedBrowser(browser,origin){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
    await context.addInitScript(key=>localStorage.setItem(key,JSON.stringify('complete')),TOUR_KEY);
    const page=await context.newPage();
    const key='you.checkout.checks.v1';
    const fixture='tb1qxc9rhgpdjcp42nmhg6lepe7pp5g86tx25vlv8h';
    const id='a'.repeat(64);
    const script=Buffer.from(address.toOutputScript(fixture,networks.testnet)).toString('hex');
    const tx={txid:id,weight:400,fee:200,vin:[{sequence:0xfffffffd}],status:{confirmed:false},vout:[{scriptpubkey:script,value:2500}]};
    const faults=[],requests=[];
    page.on('pageerror',err=>faults.push(err.message));
    page.on('console',msg=>{if(/Content Security Policy/.test(msg.text()))faults.push(msg.text());});
    page.on('request',req=>{if(/^https?:/.test(req.url())&&!req.url().startsWith(origin))requests.push(req.url());});
    await context.route('https://mempool.space/**',route=>{
      const r=route.request(),path=new URL(r.url()).pathname;
      assert.equal(r.method(),'GET');
      assert.match(path,/^\/(signet|testnet4)\/api\/(tx\/|address\/)/);
      return route.fulfill({json:path.includes('/address/')?[tx]:tx});
    });
    const at=id=>page.locator('#'+id);
    const click=id=>at(id).click();
    const state=value=>page.waitForFunction(value=>document.getElementById('result').dataset.state===value,value);
    const group=network=>page.locator(`[data-saved-network="${network}"]`);
    const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const fill=async(txid=id)=>{await at('lookup-address').fill(fixture);await at('lookup-sats').fill('0.00002500');await at('lookup-txid').fill(txid);};
    const check=async(txid=id)=>{await fill(txid);await click('lookup-check');await state(txid?'pending':'history');};
    const noRequests=async(callback)=>{const count=requests.length;await callback();assert.equal(requests.length,count);};

    await page.goto(origin);
    assert(await at('first-hint').isVisible());
    await noRequests(async()=>{await click('hint-dismiss');assert(!(await at('first-hint').isVisible()));await page.reload();});
    assert(!(await at('first-hint').isVisible()));
    assert.equal(await stored(),null);
    await check();assert.equal(requests.length,1);assert.equal(await stored(),null,'No automatic verification storage');
    await noRequests(async()=>{
      await click('copy-result');const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
      assert.match(clipboard,/Network: Signet/);assert.match(clipboard,/Expected amount: 0\.00002500 BTC/);
      assert.match(clipboard,/Status: Unconfirmed\nConfirmations: 0\nResult as of /);
      assert.doesNotMatch(clipboard,/\bsafe\b|paid in full/i);assert.equal(await stored(),null);
      await click('save-check');await click('save-check');assert.equal(await group('signet').locator('li').count(),1);
      const [entry]=await stored();assert.deepEqual(Object.keys(entry).sort(),['address','expectedSats','label','network','timestamp','txid']);
      assert.equal(entry.txid,id);assert.equal(entry.expectedSats,2500);
      assert.match(await group('signet').textContent(),/Result as of .+\. Status may have changed\./);
      await page.reload();assert.equal(await group('signet').locator('li').count(),1);
    });
    await at('verify-network').selectOption('testnet4');await check();assert.match(requests.at(-1),/\/testnet4\/api\//);
    await noRequests(async()=>{await click('save-check');assert.equal(await group('testnet4').locator('li').count(),1);assert.equal(await group('signet').locator('li').count(),1);});
    await noRequests(async()=>{
      await group('signet').getByRole('button',{name:'Recheck'}).click();
      assert.equal(await at('verify-network').inputValue(),'signet');assert.equal(await at('lookup-address').inputValue(),fixture);
      assert.equal(await at('lookup-sats').inputValue(),'0.00002500');assert.equal(await at('lookup-txid').inputValue(),id);await state('idle');
    });
    await check('');assert.match(requests.at(-1),/\/signet\/api\/address\//);
    await noRequests(async()=>{
      await click('save-check');const historyRow=group('signet').locator('li').filter({hasText:'Address history only'});
      await historyRow.getByRole('button',{name:'Recheck'}).click();assert.equal(await at('lookup-txid').inputValue(),'');await state('idle');
      await group('testnet4').getByRole('button',{name:'Remove'}).click();assert.equal(await group('testnet4').count(),0);
      await click('saved-clear');assert.deepEqual(await stored(),[]);await page.reload();assert.equal(await page.locator('[data-saved-network]').count(),0);
      await page.evaluate(key=>localStorage.setItem(key,'{broken'),key);await page.reload();assert.equal(await page.locator('[data-saved-network]').count(),0);
    });
    await page.addInitScript(key=>{const get=Storage.prototype.getItem, set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k===key)return get.call(this,k);throw new Error('Storage blocked for test');};Storage.prototype.setItem=function(k,v){if(k===key)return set.call(this,k,v);throw new Error('Storage blocked for test');};},TOUR_KEY);
    await page.reload();await click('hint-dismiss');assert(!(await at('first-hint').isVisible()));
    await check();await noRequests(async()=>{
      await click('save-check');assert.match(await at('result-action-message').textContent(),/Could not save/);
      assert.equal(await page.locator('[data-saved-network]').count(),0);
    });
    assert.deepEqual(faults,[]);
    console.log('Saved checks UI: explicit save, dedupe, reload, removal, clear, network separation, fill-only Recheck, no extra requests, copy, hint persistence, and corrupt/blocked storage passed (routed fixtures).');
  }finally{await context.close();}
}
