import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {runSavedBrowser} from './saved-browser.mjs';
import {runOnboardingBrowser} from './onboarding-browser.mjs';
import {runSettingsBrowser} from './settings-browser.mjs';
import {TOUR_KEY} from '../src/tour.js';
import {address, networks, Transaction} from 'bitcoinjs-lib';

const first='tb1qf4x56n2df4x56n2df4x56n2df4x56ngqrwsv98',near='tb1qf4x56n2df4x56n2df4x56n2df4x56ngp7cyec4';
const html=await readFile('site/index.html');
const mount='/you-project/';
const server=createServer((req,res)=>req.url===mount?res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(html):res.writeHead(404).end());
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://localhost:${server.address().port}${mount}`;
let browser;
try{
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await context.addInitScript(key=>localStorage.setItem(key,JSON.stringify('complete')),TOUR_KEY);
  const page=await context.newPage();const clientErrors=[],apiMethods=[];
  page.on('pageerror',e=>clientErrors.push(e.message));page.on('console',e=>{if(/Content Security Policy/.test(e.text()))clientErrors.push(e.text());});
  page.on('request',r=>{if(r.url().startsWith('https://mempool.space/'))apiMethods.push(r.method());});
  // Deny every public explorer write; the later regtest route handles its own local POST.
  await page.route('https://mempool.space/**',r=>r.request().method()==='GET'?r.fallback():r.abort());
  const go=view=>page.click(`[data-view=${view}]`);
  const fill=(id,v)=>page.fill('#'+id,v);
  const click=id=>page.click('#'+id);
  const insert=async(id,value)=>{await fill(id,'');await page.focus('#'+id);await page.keyboard.insertText(value);assert.equal(await page.locator('#'+id).inputValue(),value);};
  async function liveValues(chain){
    const id=await page.locator('#lookup-txid').inputValue();
    const recipient=await page.locator('#lookup-address').inputValue();
    const base=`https://mempool.space/${chain}/api`;
    const txResponse=page.waitForResponse(`${base}/tx/${id}`), tipResponse=page.waitForResponse(`${base}/blocks/tip/height`);
    await click('lookup-check');await result('matched');
    const tx=await (await txResponse).json(), tip=Number(await (await tipResponse).text());
    const script=Buffer.from(address.toOutputScript(recipient,networks.testnet)).toString('hex');
    const sats=tx.vout.filter(o=>o.scriptpubkey===script).reduce((sum,o)=>sum+o.value,0);
    const vsize=Math.ceil(tx.weight/4);
    const contents=id=>page.locator('#'+id).textContent();
    assert.equal(await contents('check-amount'),`${(sats/1e8).toFixed(8)} / ${(sats/1e8).toFixed(8)} BTC`);
    assert.equal(await contents('check-confirmations'),(tip-tx.status.block_height+1).toLocaleString('en-NG'));
    assert.equal(await contents('check-fee'),`${tx.fee.toLocaleString('en-NG')} sats`);
    assert.equal(await contents('check-rate'),`${(tx.fee/vsize).toFixed(2)} sat/vB (${vsize} vB)`);
    assert.equal(await contents('check-rbf'),tx.vin.some(v=>v.sequence<0xfffffffe)?'Signalled':'Not detected');
  }
  const expectText=async(id,value)=>{await page.waitForFunction(({id,source,flags})=>new RegExp(source,flags).test(document.getElementById(id).textContent),{id,source:value.source,flags:value.flags},{timeout:15000});};
  const result=state=>page.waitForFunction(state=>document.querySelector('#result').dataset.state===state,state,{timeout:15000});
  async function fit(width,height){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'Horizontal overflow');}
  await page.goto(origin);
  for(const [width,height] of [[320,640],[390,844],[768,1024],[1366,900]]){
    await fit(width,height);
    for(const panel of ['wallet','recipient','checklist','practice','lookup']){await go(panel);await fit(width,height);}
    await click('settings-open');await fit(width,height);await go('lookup');
  }
  await fit(390,844);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('html>head,html>body,main,nav,h1')].length),5);
  assert.equal(await page.evaluate(()=>{const elems=[...document.querySelectorAll('[id]')];return elems.length-new Set(elems.map(x=>x.id)).size;}),0);
  await context.setOffline(true);await go('practice');
  for(const [scenario,state] of [['short','amount'],['wrong','mismatch'],['pending','pending'],['matched','matched']]){
    await page.selectOption('#scenario',scenario);await click('practice-check');await result(state);await expectText('result-source',/^DEMO/);
    assert(!(await page.locator('#result-link').isVisible()));
  }
  assert.equal(apiMethods.length,0);await context.setOffline(false);
  await go('checklist');await page.getByRole('checkbox').nth(0).check();await page.getByRole('checkbox').nth(2).check();await expectText('check-count',/^2 of 8/);await click('check-reset');await expectText('check-count',/^0 of 8/);
  await click('settings-open');await page.locator('input[name=appearance][value=dark]').check();await click('profile-edit');await fill('profile-name','Amaka Example');await click('profile-save');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');await expectText('settings-initials',/^AE$/);
  await click('settings-open');assert.equal(await page.locator('#profile-display-name').textContent(),'Amaka Example');
  await page.locator('input[name=appearance][value=light]').check();assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.locator('input[name=appearance][value=system]').check();await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.emulateMedia({colorScheme:'light'});
  await go('recipient');await fill('known-address',first);await fill('known-label','My test fixture');await click('known-save');await expectText('known-list',/My test fixture/);
  for(const [target,msg] of [[first.toUpperCase(),/^Exact match/],[near,/^Warning: similar/],['tb1qxc9rhgpdjcp42nmhg6lepe7pp5g86tx25vlv8h',/^No match/],['invalid',/valid public test-network address/]]){await fill('recipient-input',target);await click('recipient-check');await expectText('recipient-feedback',msg);}
  await page.reload();await go('recipient');await expectText('known-list',/My test fixture/);await page.getByRole('button',{name:/Remove My test fixture/}).click();await expectText('known-list',/^No addresses saved/);
  await go('wallet');await click('wallet-create');let receive=await page.locator('#receive-address').inputValue();assert.match(receive,/^tb1q/);
  await page.getByRole('button',{name:'Copy address'}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),receive);
  await fill('wallet-label','Flyer & layout');await click('request-create');await expectText('request-uri',/\?label=Flyer%20%26%20layout$/);
  await page.waitForFunction(()=>{const i=document.querySelector('#request-qr');return !i.hidden&&i.complete&&i.naturalWidth>=128;});
  await fill('wallet-sats','0.00002500');await click('request-create');await expectText('request-uri',/amount=0\.00002500&label=/);
  await click('invoice-verify');assert.equal(await page.locator('#lookup-address').inputValue(),receive);assert.equal(await page.locator('#lookup-sats').inputValue(),'0.00002500');
  await fill('lookup-txid','nothex');await click('lookup-check');await result('invalid');await expectText('result-detail',/64 hexadecimal/);
  await fill('lookup-txid','');await fill('lookup-sats','1e-8');await click('lookup-check');await result('invalid');
  await fill('lookup-sats','0.00002500');await fill('lookup-address','1BitcoinEaterAddressDontSendf59kuE');await click('lookup-check');await result('invalid');
  await click('sample-load');const validId=await page.locator('#lookup-txid').inputValue();
  await insert('lookup-txid',validId+'a');await click('lookup-check');await result('invalid');
  await fill('lookup-txid',validId);await insert('lookup-sats','10000000.000000019');await click('lookup-check');await result('invalid');
  await go('wallet');await insert('wallet-sats','10000000.000000019');await click('request-create');await expectText('wallet-message',/eight decimal places/);
  await page.locator('#sweep summary').click();await fill('destination',first);await insert('fee-rate','100');await click('sweep-prepare');await expectText('sweep-message',/1–50/);
  await fill('fee-rate','2');await go('lookup');
  if(process.env.SKIP_LIVE!=='1'){
    await click('sample-load');const fid=await page.locator('#lookup-txid').inputValue();const exampleAddress=await page.locator('#lookup-address').inputValue();
    await liveValues('signet');await expectText('result-source',/SIGNET · PUBLIC EXAMPLE/);await expectText('check-amount',/0\.00009963 \/ 0\.00009963 BTC/);await expectText('check-fee',/sats/);await expectText('check-rate',/sat\/vB/);
    await fill('lookup-address',first);await click('lookup-check');await result('mismatch');
    await click('sample-load');await fill('lookup-sats','0.00010000');await click('lookup-check');await result('amount');
    await click('sample-load');await fill('lookup-txid','');await click('lookup-check');await result('history');
    await fill('lookup-txid','f'.repeat(64));await click('lookup-check');await result('missing');
    const path=`https://mempool.space/signet/api/tx/${fid}`;
    const tipPath='https://mempool.space/signet/api/blocks/tip/height';
    await page.route(tipPath,r=>r.fulfill({status:404,body:'tip unavailable'}));await click('sample-load');await click('lookup-check');await result('error');await page.unroute(tipPath);
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await page.route(path,async r=>{await gate;await r.fulfill({status:503,body:'temporarily unavailable'});});
    await click('lookup-check');await result('loading');assert(await page.locator('#lookup-check').isDisabled());release();await result('error');await page.unroute(path);
    await page.route(path,r=>r.abort());await click('sample-load');await click('lookup-check');await result('error');await page.unroute(path);
    await page.route(path,r=>r.fulfill({status:429,body:'rate limited'}));await click('lookup-check');await result('error');await expectText('result-detail',/request limit/);await page.unroute(path);
    await go('wallet');await fill('receive-address',exampleAddress);assert(!(await page.locator('#sweep').isVisible()));await click('history-load');await expectText('history-list',/BTC · (Confirmed|Unconfirmed)/);
    await go('lookup');await page.selectOption('#verify-network','testnet4');await click('sample-load');await liveValues('testnet4');await expectText('result-source',/TESTNET 4 · PUBLIC EXAMPLE/);
    await fill('lookup-txid',fid);await click('lookup-check');await result('missing');
    await page.reload();assert.equal(await page.locator('#verify-network').inputValue(),'testnet4');
    await go('recipient');await expectText('known-list',/Testnet 4/);await go('wallet');assert(await page.locator('#wallet-create').isDisabled());
    await go('lookup');await page.selectOption('#verify-network','signet');
    console.log('Live browser checks: Signet and Testnet 4 references, history, 404, mismatch, network failure and 429 handling.');
  }
  assert.deepEqual(clientErrors,[]);assert(!apiMethods.includes('POST'));console.log('Browser UI: four viewport sizes, navigation, HTML IDs, offline demo, checklist, themes, preferences, address book, QR and clipboard passed.');

  await runSavedBrowser(browser,origin);
  await runOnboardingBrowser(browser,origin);
  await runSettingsBrowser(browser,origin);

  if(process.env.CORE_DATA){
    // Intercept only this test browser's Signet Esplora requests. Never broadcast to the actual public network.
    const core=(...args)=>execFileSync(process.env.CLI||'bitcoin-cli',['-regtest',`-datadir=${process.env.CORE_DATA}`,`-rpcport=${process.env.CORE_RPC_PORT||'28443'}`,'-rpcwallet=judge',...args],{encoding:'utf8'}).trim();
    const convert=(addr,prefix)=>{const d=address.fromBech32(addr);return address.toBech32(d.data,d.version,prefix);};
    const miner=core('getnewaddress');core('generatetoaddress','101',miner);
    const apiURL='https://mempool.space/signet/api/**';let deposit, confirmed, owner, broadcastCount=0, spendId;
    const coreTx=(id,confirmed)=>{
      const t=JSON.parse(confirmed?core('getrawtransaction',id,'true',confirmed):core('getrawtransaction',id,'true'));
      const fee=Math.round(Math.abs(JSON.parse(core('gettransaction',id)).fee)*1e8);
      return {txid:t.txid,fee,weight:t.weight,vin:t.vin,vout:t.vout.map(o=>({scriptpubkey:o.scriptPubKey.hex,value:Math.round(o.value*1e8)})),status:{confirmed:!!confirmed,block_height:confirmed?Number(core('getblockcount')):undefined}};
    };
    await page.route(apiURL,async route=>{
      const r=route.request(), path=new URL(r.url()).pathname.replace('/signet/api','');
      const reply=(body,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*'},body:typeof body==='string'?body:JSON.stringify(body)});
      if(path==='/blocks/tip/height')return reply(core('getblockcount'));
      if(path===`/tx/${deposit}`)return reply(coreTx(deposit,confirmed));
      if(path===`/address/${owner}/txs`)return reply([coreTx(deposit,confirmed)]);
      if(path===`/address/${owner}/utxo`){const real=coreTx(deposit,confirmed);const d=address.fromBech32(owner);const script=`0014${Buffer.from(d.data).toString('hex')}`;
        return reply(real.vout.flatMap((o,vout)=>o.scriptpubkey===script?[{txid:deposit,vout,value:o.value,status:{confirmed:!!confirmed}}]:[]));}
      if(path==='/tx'&&r.method()==='POST'){
        const raw=r.postData();assert.equal(raw,Transaction.fromHex(raw).toHex());
        assert.equal(JSON.parse(core('testmempoolaccept',JSON.stringify([raw])))[0].allowed,true);
        broadcastCount++;spendId=core('sendrawtransaction',raw);return reply(spendId);
      }
      return reply('No fixture for this request',404);
    });
    await go('lookup');await page.selectOption('#verify-network','signet');await go('wallet');await click('wallet-create');owner=await page.locator('#receive-address').inputValue();
    deposit=core('-named','sendtoaddress',`address=${convert(owner,'bcrt')}`,'amount=0.00002500','fee_rate=2');
    await click('history-load');await expectText('history-list',/0\.00002500 BTC · Unconfirmed/);
    await fill('wallet-sats','0.00002500');await click('request-create');await click('invoice-verify');await fill('lookup-txid',deposit);await click('lookup-check');await result('pending');
    [confirmed]=JSON.parse(core('generatetoaddress','1',miner));await click('lookup-check');await result('matched');
    const receiver=core('getnewaddress');await go('wallet');
    await fill('receive-address',first);assert(!(await page.locator('#sweep').isVisible()));
    await click('wallet-create');assert.equal(await page.locator('#receive-address').inputValue(),owner);await page.getByText('Advanced: send the confirmed Signet balance').click();await fill('destination',convert(receiver,'tb'));
    await click('sweep-prepare');await expectText('sweep-message',/^Signed locally/);assert.equal(broadcastCount,0);
    await click('sweep-send');await expectText('sweep-message',/^Broadcast accepted/);assert.equal(broadcastCount,1);
    const [sweepBlock]=JSON.parse(core('generatetoaddress','1',miner));const decoded=JSON.parse(core('getrawtransaction',spendId,'true',sweepBlock));
    assert.equal(decoded.vout[0].scriptPubKey.address,receiver);
    const fee=2500-Math.round(decoded.vout[0].value*1e8);assert.ok(fee>=2*decoded.vsize);
    await page.reload();await go('wallet');assert(!(await page.locator('#sweep').isVisible()));await click('wallet-create');
    assert.notEqual(await page.locator('#receive-address').inputValue(),owner);
    console.log('Browser → Bitcoin Core regtest integration: real Core-funded receipt, unconfirmed/confirmed states, local signing, explicit POST, mempool acceptance and mined sweep.');
  }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
