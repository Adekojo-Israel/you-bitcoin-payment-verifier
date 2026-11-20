import QRCode from 'qrcode';
import {initTour} from './tour.js';
import {prepareProfilePhoto, validStoredPhoto} from './profile.js';
import {canonicalAddress, checkPayment, compareRecipient, formatBtc, hex, inspectTransaction, isTxid, makeWallet, outputScript, parseBtc, parseSats, paymentUri, prepareSweep} from './bitcoin.js';
import {addSavedCheck, cleanSavedChecks, savedKey, SAVEABLE_LABELS} from './saved-checks.js';

const $ = id => document.getElementById(id);
const EXPLORER = 'https://mempool.space';
const NETWORKS = Object.freeze({
  signet:{label:'Signet', address:'tb1qxc9rhgpdjcp42nmhg6lepe7pp5g86tx25vlv8h', sats:9963, txid:'811ec5114573b185f3db8e2f971472b52d8c570f7971edc0a8b78b1e140dcb40'},
  testnet4:{label:'Testnet 4', address:'tb1qt5ksxdfak69r8ycpxlsfsmjqla3ucp28f7jqsm', sats:1000000, txid:'78ea15869c07e79a540eded377596d5c65b85273503dd12e2d157ea79f8d56d4'}
});
const fmt = n => n.toLocaleString('en-NG');
const set = (id,text) => { $(id).textContent = text; };
const visible = (id,show) => { $(id).hidden=!show; };
const currentNetwork = () => preferences.network;
const networkName = () => NETWORKS[currentNetwork()].label;
const storage = {preferences:'you.checkout.preferences.v2', addresses:'you.checkout.addresses.v2', checks:'you.checkout.checks.v1', hint:'you.checkout.hint.v1', profile:'you.checkout.profile.v1'};
const themeQuery = matchMedia('(prefers-color-scheme: dark)');
function read(key,fallback) {try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,data) {try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{return false;}}
const existing=read(storage.preferences,{});
const themes=['system','light','dark'];
function validLabel(value,max) {return typeof value==='string'&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);}
const preferences={network:Object.hasOwn(NETWORKS,existing?.network)?existing.network:'signet',
  theme:themes.includes(existing?.theme)?existing.theme:'system',name:validLabel(existing?.name,40)?existing.name:''};
const savedProfile=read(storage.profile,null);
let profile={name:validLabel(savedProfile?.name,40)?savedProfile.name:preferences.name,
  photo:validStoredPhoto(savedProfile?.photo)?savedProfile.photo:null};
function applyTheme(){
  const dark=preferences.theme==='dark'||preferences.theme==='system'&&themeQuery.matches;
  document.documentElement.dataset.theme=dark?'dark':'light';
  document.querySelector('meta[name="theme-color"]').content=dark?'#171316':'#421629';
}
// The bundle runs in the head so the saved theme is set before the body paints.
applyTheme();
document.addEventListener('DOMContentLoaded',init,{once:true});

function init(){
const saved=read(storage.addresses,[]);
let checksSaved=cleanSavedChecks(read(storage.checks,[])), lastCheck;
const checkedDate=timestamp=>new Date(timestamp).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'medium'});
let known=[];
if(Array.isArray(saved))for(const item of saved.slice(0,100)) {
  if(!item||!Object.hasOwn(NETWORKS,item.network)||!validLabel(item.label,40))continue;
  try{known.push({...item,address:canonicalAddress(item.address)});}catch{/* ignore invalid local data */}
}
let wallet, invoice, sweep, view='lookup', liveAbort, historyAbort, sweepAbort, sweepTurn=0, qrTurn=0, sweeping=false;
const statements = {
  idle:['Not checked yet','Enter the address and amount to check a payment.'],
  loading:['Checking the explorer','Waiting for a response from the selected test network.'],
  pending:['Unconfirmed','The address and amount match. Wait for a confirmation and check again before delivering.'],
  mismatch:['Receiving-address mismatch','The transaction did not send any Bitcoin to this receiving address. Check the address and transaction ID.'],
  amount:['Amount mismatch','The Bitcoin sent to this address differs from the amount you entered. Check the agreed amount before delivering.'],
  matched:['Confirmed','The address and exact amount match. For a large order, consider waiting for more confirmations. A confirmation does not prove finality.'],
  history:['Address history only','The explorer found an incoming transaction. It may be old. Enter the exact transaction ID to check this order.'],
  missing:['Transaction not found','The explorer did not return this transaction. Check the network and ID.'],
  invalid:['Invalid input','Check the address and amount. If you entered a transaction ID, check that too.'],
  error:['Explorer unavailable','No payment was verified. Check your connection or verify independently.']
};
function show(state='idle',{source='PAYMENT CHECK',detail,result,meta,txid,network,query,example}={}) {
  $('result').dataset.state=state;
  const [title,description]=statements[state];
  const outcome = state==='missing'&&query&&!query.txid ? 'No recent incoming payment found' : title;
  const label = example ? `Public example: ${outcome}` : outcome;
  lastCheck = query&&Object.hasOwn(SAVEABLE_LABELS,state) ? {entry:{...query,label,timestamp:Date.now()},result} : undefined;
  visible('result-actions',!!lastCheck);
  set('result-action-message','');
  set('result-source',source);set('result-title',title);set('result-detail',detail||description);
  set('check-exists',result?(result.confirmations?'Found, confirmed':'Found, unconfirmed'):state==='missing'?'Not found':'Not checked');
  set('check-address',result?(meta.outputMatch?'Address found in outputs':'No matching output'):'Not checked');
  set('check-amount',result?`${formatBtc(result.paid)} / ${formatBtc(result.expected)} BTC`:'Not checked');
  set('check-confirmations',result?fmt(result.confirmations):'Not checked');
  const unknown=result?'Unavailable':'Not checked';
  set('check-fee',meta?.fee!=null?`${fmt(meta.fee)} sats`:unknown);
  set('check-rate',meta?.feeRate!=null?`${meta.feeRate.toFixed(2)} sat/vB (${meta.vsize} vB)`:unknown);
  set('check-rbf',meta?.rbf||unknown);
  visible('checked-scope',!!result);
  set('checked-scope',source.startsWith('DEMO')?'Simulated result. No transaction was checked on the network.':
    result?'The explorer supplied the transaction details. YOU compared the outputs with the address and amount you entered.':'');
  set('result-time',lastCheck?`Checked ${checkedDate(lastCheck.entry.timestamp)}. Results are not monitored.`:'');
  visible('result-link',!!txid);
  if(txid)$('result-link').href=`${EXPLORER}/${network}/tx/${txid}`;
  else $('result-link').removeAttribute('href');
}
function renderSavedChecks(){
  const root=$('saved-checks-list');root.replaceChildren();
  $('saved-clear').disabled=!checksSaved.length;
  if(!checksSaved.length){
    const info=document.createElement('p');info.className='desc';info.textContent='No checks saved. Run a network check, then choose Save this check.';root.append(info);return;
  }
  for(const net of new Set(checksSaved.map(row=>row.network))){
    const heading=document.createElement('h4'), list=document.createElement('ul');
    heading.textContent=NETWORKS[net].label;list.className='saved-ledger';list.dataset.savedNetwork=net;
    for(const row of checksSaved.filter(x=>x.network===net)){
      const item=document.createElement('li'),label=document.createElement('strong'),address=document.createElement('code');
      const amount=document.createElement('p'),time=document.createElement('p'),controls=document.createElement('div');
      label.textContent=row.label;address.textContent=row.address;
      amount.textContent=`Expected: ${formatBtc(row.expectedSats)} BTC`;
      time.textContent=`Result as of ${checkedDate(row.timestamp)}. Status may have changed.`;
      amount.className=time.className='fine';controls.className='action-row';
      item.append(label,address,amount);
      if(row.txid){const code=document.createElement('code');code.textContent=`ID: ${row.txid}`;item.append(code);}
      item.append(time,controls);
      const recheck=document.createElement('button'),remove=document.createElement('button');
      for(const button of [recheck,remove]){button.type='button';button.className='secondary';}
      recheck.textContent='Recheck';remove.textContent='Remove';
      recheck.addEventListener('click',()=>{
        setNetwork(row.network);cancelCheck();
        $('lookup-address').value=row.address;$('lookup-sats').value=formatBtc(row.expectedSats);$('lookup-txid').value=row.txid??'';
        set('saved-checks-message','Form filled. Choose Check payment when ready.');$('lookup-address').focus();
      });
      remove.addEventListener('click',()=>{
        if(updateSavedChecks(checksSaved.filter(x=>savedKey(x)!==savedKey(row)),'Saved check removed.'))$('saved-heading').focus();
      });
      controls.append(recheck,remove);list.append(item);
    }
    root.append(heading,list);
  }
}
function updateSavedChecks(next,message){
  if(!write(storage.checks,next)){set('saved-checks-message','Browser storage is unavailable. No saved checks changed.');return false;}
  checksSaved=next;renderSavedChecks();set('saved-checks-message',message);return true;
}
$('save-check').addEventListener('click',()=>{
  if(!lastCheck)return;
  const success=updateSavedChecks(addSavedCheck(checksSaved,lastCheck.entry),'Check saved in this browser.');
  set('result-action-message',success?'Check saved in this browser.':'Could not save. Browser storage is unavailable.');
});
$('copy-result').addEventListener('click',async()=>{
  const snapshot=lastCheck;if(!snapshot)return;
  const {entry,result}=snapshot;
  const summary=[`Network: ${NETWORKS[entry.network].label} (test network)`,`Receiving address: ${entry.address}`,
    `Expected amount: ${formatBtc(entry.expectedSats)} BTC`,
    `Amount received at this address: ${result?formatBtc(result.paid)+' BTC':'Not verified'}`,
    `Status: ${entry.label}`,`Confirmations: ${result?result.confirmations:'Not verified'}`,
    `Result as of ${new Date(entry.timestamp).toISOString()}. Status may have changed.`];
  if(entry.txid)summary.splice(2,0,`Transaction ID: ${entry.txid}`);
  if(entry.label.endsWith('Address history only'))summary.push('This lookup does not link a payment to a specific order.');
  if(entry.label.startsWith('Public example:'))summary.push('Historical example. Not a payment to you.');
  try{await navigator.clipboard.writeText(summary.join('\n'));if(lastCheck===snapshot)set('result-action-message','Result summary copied.');}
  catch{if(lastCheck===snapshot)set('result-action-message','Clipboard unavailable. Select and copy the result details instead.');}
});
$('saved-clear').addEventListener('click',()=>{
  if(updateSavedChecks([],'All saved checks cleared.'))$('saved-heading').focus();
});
visible('first-hint',read(storage.hint,false)!==true);
$('hint-dismiss').addEventListener('click',()=>{
  write(storage.hint,true);visible('first-hint',false);$('lookup-address').focus();
});
renderSavedChecks();
function revealResult() {if(matchMedia('(max-width:720px)').matches)$('result-title').focus();}
function cancelCheck() {liveAbort?.abort();liveAbort=undefined;$('lookup-check').disabled=false;show();}
function switchView(next) {
  if(!['lookup','wallet','recipient','checklist','practice','settings-panel'].includes(next)||next===view)return;
  if(view==='wallet'&&!sweeping)resetSweep();
  if(view==='settings-panel'&&!$('profile-form').hidden)closeProfile();
  cancelCheck();view=next;
  document.querySelectorAll('[data-panel]').forEach(el=>{el.hidden=el.id!==view;});
  document.querySelectorAll('[data-view]').forEach(el=>{if(el.dataset.view===view)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  const withResult=['lookup','practice'].includes(view);visible('result',withResult);visible('saved-panel',view==='lookup');document.querySelector('.layout').classList.toggle('solo',!withResult);
  $('settings-open').setAttribute('aria-expanded',String(view==='settings-panel'));
  if(view==='settings-panel'){syncSettings();renderProfile();}
  const title=$(next).querySelector('h2');title.tabIndex=-1;title.focus({preventScroll:true});
}
async function api(network,path,{signal,method='GET',body,text=false}={}) {
  if(!Object.hasOwn(NETWORKS,network)||(method==='POST'&&(network!=='signet'||path!=='/tx')))throw Error('Unsupported test network or method.');
  const ctrl=new AbortController(),abort=()=>ctrl.abort();
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,10000);
  try{
    const options={method,signal:ctrl.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'};
    if(method==='POST'){options.headers={'Content-Type':'text/plain'};options.body=body;}
    const r=await fetch(`${EXPLORER}/${network}/api${path}`,options);
    if(!r.ok){const error=Error(r.status===429?'The explorer limited requests; try again later.':'The explorer could not complete this request.');error.status=r.status;throw error;}
    return text||method==='POST'?(await r.text()).trim():await r.json();
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
function readAddress(id) {
  try{return canonicalAddress($(id).value);}catch{throw Error('Enter a valid public test-network address. Mainnet addresses are not accepted.');}
}
async function runLive() {
  cancelCheck();const job=new AbortController(); liveAbort=job;
  const network=currentNetwork(),sample=NETWORKS[network],id=$('lookup-txid').value.trim().toLowerCase();
  const source=`LIVE · ${sample.label.toUpperCase()}`;
  let address,sats;
  try{address=readAddress('lookup-address');sats=parseBtc($('lookup-sats').value);if(id&&!isTxid(id))throw Error('Enter exactly 64 hexadecimal characters for a transaction ID.');}
  catch(err){show('invalid',{source,detail:err.message});revealResult();return;}
  const query={network,address,expectedSats:sats,txid:id||null};
  $('lookup-check').disabled=true;show('loading',{source});
  try{
    let tx;
    if(id){
      try{tx=await api(network,'/tx/'+id,{signal:job.signal});}
      catch(err){
        if(err.status!==404)throw err;
        if(!job.signal.aborted){show('missing',{source,query});revealResult();}
        return;
      }
    }else{
      const rows=await api(network,'/address/'+encodeURIComponent(address)+'/txs',{signal:job.signal});
      if(!Array.isArray(rows))throw Error('Invalid explorer history.');
      tx=rows.find(row=>inspectTransaction(row,address).paid>0);
    }
    if(job.signal.aborted)return;
    if(!tx){show('missing',{source,query,detail:'No recent incoming payment was found for this address. This does not prove that no payment was attempted.'});revealResult();return;}
    const meta=inspectTransaction(tx,address);
    let tip;
    if(tx.status.confirmed){const height=await api(network,'/blocks/tip/height',{signal:job.signal,text:true});tip=/^\d+$/.test(height)?Number(height):NaN;}
    const result=checkPayment(tx,{address,sats,txid:id||tx.txid},tip);
    if(job.signal.aborted)return;
    const isExample=tx.txid===sample.txid;
    show(id?result.state:'history',{result,meta,query,example:isExample,source:isExample?source+' · PUBLIC EXAMPLE':source,
      detail:isExample?(id?'This is a historical public transaction, not a payment to you. '+statements[result.state][1]:statements.history[1]):undefined,txid:tx.txid,network});
    revealResult();
  }catch(err){
    if(job.signal.aborted)return;
    show('error',{source,detail:err.status===429?'Explorer request limit reached. No payment conclusion can be made. Try again later.':undefined});
    revealResult();
  }finally{if(liveAbort===job){$('lookup-check').disabled=false;liveAbort=undefined;}}
}
function practice() {
  const scenario=$('scenario').value, txid='a'.repeat(64), address=NETWORKS.signet.address;
  const tx={txid,fee:380,weight:560,vin:[{sequence:scenario==='pending'?0xfffffffd:0xffffffff}],status:{confirmed:scenario!=='pending',block_height:100},vout:[{scriptpubkey:scenario==='wrong'?'6a':hex(outputScript(address)),value:scenario==='short'?1500:2500}]};
  const result=checkPayment(tx,{address,txid,sats:2500},101);
  show(result.state,{source:'DEMO · SIMULATED TRANSACTION',result,meta:inspectTransaction(tx,address)});revealResult();
}
const appearanceRadios=Array.from($('profile-theme').querySelectorAll('input[type=radio]'));
let draftPhoto=null, photoRequest=0, pictureBusy=false;
function syncSettings(){
  for(const radio of appearanceRadios)radio.checked=radio.value===preferences.theme;
  $('profile-network').value=currentNetwork();
}
function renderPicture(initialId,photoId,name,photo){
  const letters=name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toUpperCase().slice(0,4)||'Y';
  set(initialId,letters);visible(initialId,!photo);visible(photoId,!!photo);
  if(photo)$(photoId).src=photo;else $(photoId).removeAttribute('src');
}
function renderProfile(){
  set('profile-display-name',profile.name||'Not set');
  renderPicture('profile-avatar','profile-photo',profile.name,profile.photo);
  renderPicture('settings-initials','settings-photo',profile.name,profile.photo);
}
function renderDraft(){renderPicture('draft-avatar','draft-photo',$('profile-name').value,draftPhoto);}
function openProfile(){
  draftPhoto=profile.photo;photoRequest++;pictureBusy=false;
  $('profile-name').value=profile.name;$('profile-image').value='';
  $('profile-fields').disabled=false;$('profile-save').disabled=false;
  $('profile-edit').setAttribute('aria-expanded','true');
  visible('profile-view',false);visible('profile-form',true);
  set('profile-message','');renderDraft();$('profile-name').focus();
}
function closeProfile({message='',focus=false}={}){
  photoRequest++;pictureBusy=false;draftPhoto=null;
  $('profile-form').reset();$('draft-photo').removeAttribute('src');
  $('profile-fields').disabled=true;$('profile-save').disabled=false;
  $('profile-edit').setAttribute('aria-expanded','false');
  visible('profile-form',false);visible('profile-view',true);
  set('profile-message',message);renderProfile();if(focus)$('profile-edit').focus();
}
$('profile-edit').addEventListener('click',openProfile);
$('profile-cancel').addEventListener('click',()=>closeProfile({focus:true}));
$('profile-name').addEventListener('input',()=>{renderDraft();set('profile-message','');});
$('profile-initials').addEventListener('click',()=>{
  photoRequest++;pictureBusy=false;draftPhoto=null;$('profile-image').value='';$('profile-save').disabled=false;
  renderDraft();set('profile-message','');
});
$('profile-image').addEventListener('change',async()=>{
  const file=$('profile-image').files[0];if(!file)return;
  const stamp=++photoRequest;pictureBusy=true;$('profile-save').disabled=true;
  set('profile-message','Preparing picture...');
  try{
    const photo=await prepareProfilePhoto(file);
    if(stamp!==photoRequest)return;
    draftPhoto=photo;renderDraft();set('profile-message','Picture ready to save.');
  }catch(err){if(stamp===photoRequest){$('profile-image').value='';set('profile-message',err.message);}}
  finally{if(stamp===photoRequest){pictureBusy=false;$('profile-save').disabled=false;}}
});
$('profile-form').addEventListener('submit',event=>{
  event.preventDefault();if($('profile-form').hidden||pictureBusy)return;
  const name=$('profile-name').value.trim();
  if(!validLabel(name,40)){set('profile-message','Use a display name of up to 40 characters without control characters.');return;}
  const next={name,photo:draftPhoto};
  if(!write(storage.profile,next)){set('profile-message','Your profile could not be saved in this browser.');return;}
  profile=next;closeProfile({message:'Profile saved successfully.',focus:true});
});
function syncNetwork(){
  const network=currentNetwork();$('verify-network').value=network;$('profile-network').value=network;set('network-badge',networkName().toUpperCase());
  set('sample-load',`Load real ${networkName()} example`);$('wallet-create').disabled=network!=='signet';
  set('wallet-create',network!=='signet'?'Wallet generation is Signet only':'Create temporary Signet wallet');
  syncSweepAvailability();renderKnown();
}
function setNetwork(network){
  if(!Object.hasOwn(NETWORKS,network)||network===currentNetwork())return;
  preferences.network=network;cancelCheck();clearHistory();clearInvoice();resetSweep();
  for(const id of ['lookup-address','lookup-sats','lookup-txid','receive-address','wallet-sats','wallet-label','recipient-input','known-address','known-label','destination'])$(id).value='';
  if(wallet&&network==='signet')$('receive-address').value=wallet.address;
  for(const id of ['wallet-message','recipient-feedback','known-feedback'])set(id,'');
  resetChecklist();syncNetwork();
}
function clearInvoice(){invoice=undefined;qrTurn++;visible('invoice-body',false);visible('request-qr',false);$('request-qr').removeAttribute('src');set('request-uri','');}
function clearHistory(){historyAbort?.abort();historyAbort=undefined;$('history-load').disabled=false;$('history-list').replaceChildren();set('history-message','');}
function syncSweepAvailability(){
  const own=currentNetwork()==='signet'&&wallet&&$('receive-address').value.trim().toLowerCase()===wallet.address;
  visible('sweep',Boolean(own));
}
function resetSweep(){sweepAbort?.abort();sweepAbort=undefined;sweep=undefined;sweepTurn++;visible('sweep-review',false);$('sweep-prepare').disabled=sweeping;set('sweep-details','');if(!sweeping)set('sweep-message','');}
function useReceiveAddress(address){$('receive-address').value=address;$('receive-address').dispatchEvent(new Event('input'));}
$('wallet-create').addEventListener('click',()=>{
  if(currentNetwork()!=='signet')return;
  try{
    const fresh=!wallet;wallet??=makeWallet();useReceiveAddress(wallet.address);
    set('wallet-message',fresh?'Temporary Signet wallet created. Keep this tab open.':'Showing the existing temporary wallet for this tab.');$('receive-address').focus();
  }catch{set('wallet-message','Could not generate a key in this browser. Use a current browser over HTTPS.');}
});
$('receive-address').addEventListener('input',()=>{clearInvoice();clearHistory();resetSweep();syncSweepAvailability();set('wallet-message','');});
for(const id of ['wallet-sats','wallet-label'])$(id).addEventListener('input',()=>{clearInvoice();set('wallet-message','');});
$('request-create').addEventListener('click',async()=>{
  clearInvoice();const stamp=qrTurn;
  try{
    const address=readAddress('receive-address'), field=$('wallet-sats').value.trim();
    const sats=field?parseBtc(field):null;
    if(sats!==null&&sats<546)throw Error('Use at least 546 sats (0.00000546 BTC) for this demo request, or leave the amount blank.');
    const uri=paymentUri(address,sats,$('wallet-label').value);invoice={address,sats};
    set('request-uri',uri);visible('invoice-body',true);set('wallet-message',`Request created for ${networkName()}. This does not send funds.`);
    try{
      const data=await QRCode.toDataURL(uri,{width:256,margin:4,errorCorrectionLevel:'M'});
      if(stamp===qrTurn){$('request-qr').src=data;visible('request-qr',true);}
    }catch{if(stamp===qrTurn)set('wallet-message','QR unavailable. You can still copy the request text.');}
  }catch(err){set('wallet-message',err.message);}
});
$('invoice-verify').addEventListener('click',()=>{
  if(!invoice)return;
  switchView('lookup');cancelCheck();$('lookup-address').value=invoice.address;$('lookup-sats').value=invoice.sats===null?'':formatBtc(invoice.sats);$('lookup-txid').value='';
  $(invoice.sats===null?'lookup-sats':'lookup-txid').focus();
});
for(const b of document.querySelectorAll('[data-copy]'))b.addEventListener('click',async()=>{
  try{
    const text=b.dataset.copy==='receive-address'?readAddress('receive-address'):invoice?$('request-uri').textContent:'';
    if(!text)throw Error('Generate a request first.');
    try{await navigator.clipboard.writeText(text);set('wallet-message','Copied.');}
    catch{if(b.dataset.copy==='receive-address')$('receive-address').select();set('wallet-message','Clipboard unavailable here. Select the address or request and copy it manually.');}
  }catch(err){set('wallet-message',err.message);}
});
$('history-load').addEventListener('click',async()=>{
  clearHistory();const job=new AbortController();historyAbort=job;
  const network=currentNetwork();let address;
  try{address=readAddress('receive-address');}catch(err){set('history-message',err.message);return;}
  $('history-load').disabled=true;set('history-message','Loading recent transactions…');
  try{
    const rows=await api(network,'/address/'+encodeURIComponent(address)+'/txs',{signal:job.signal});
    if(job.signal.aborted)return;
    if(!Array.isArray(rows))throw Error('Invalid response.');
    const incoming=rows.map(tx=>({tx,paid:inspectTransaction(tx,address).paid})).filter(x=>x.paid>0).slice(0,10);
    set('history-message',incoming.length?`Showing ${incoming.length} recent incoming ${incoming.length===1?'transaction':'transactions'}.`:'No recent payments were returned.');
    for(const {tx,paid} of incoming){
      const li=document.createElement('li'),id=document.createElement('code');
      li.textContent=`${formatBtc(paid)} BTC · ${tx.status.confirmed?'Confirmed':'Unconfirmed'}`;
      id.textContent=tx.txid;li.append(id);$('history-list').append(li);
    }
  }catch{if(!job.signal.aborted)set('history-message','Could not load history. Check the network or try again later.');}
  finally{if(historyAbort===job){historyAbort=undefined;$('history-load').disabled=false;}}
});
for(const id of ['destination','fee-rate'])$(id).addEventListener('input',resetSweep);
$('sweep').addEventListener('toggle',()=>{if(!$('sweep').open&&!sweeping)resetSweep();});
$('sweep-prepare').addEventListener('click',async()=>{
  if(!wallet||currentNetwork()!=='signet'||$('sweep').hidden||sweeping)return;
  resetSweep();const stamp=sweepTurn,job=new AbortController();sweepAbort=job;$('sweep-prepare').disabled=true;
  try {
    const dest=readAddress('destination'),rate=parseSats($('fee-rate').value);
    if(rate>50)throw Error('Fee rate must be 1–50 sat/vB.');
    set('sweep-message','Checking confirmed outputs…');
    const utxos=await api('signet','/address/'+encodeURIComponent(wallet.address)+'/utxo',{signal:job.signal});
    if(stamp!==sweepTurn)return;
    sweep=prepareSweep(wallet,utxos,dest,rate);
    set('sweep-details',`Send: ${fmt(sweep.amount)} sats\nFee: ${fmt(sweep.fee)} sats\nDestination: ${sweep.destination}`);
    set('sweep-message','Signed locally. Verify the destination before broadcasting. Broadcasting cannot be undone.');visible('sweep-review',true);
  }catch(err){if(stamp===sweepTurn)set('sweep-message',err.name==='AbortError'||err instanceof TypeError?'Could not reach the Signet explorer.':err.message);}
  finally{if(stamp===sweepTurn){sweepAbort=undefined;$('sweep-prepare').disabled=false;}}
});
$('sweep-send').addEventListener('click',async()=>{
  if(!sweep||currentNetwork()!=='signet'||$('sweep').hidden||sweeping)return;
  const tx=sweep;sweeping=true;resetSweep();$('destination').disabled=true;$('fee-rate').disabled=true;
  set('sweep-message','Broadcasting signed Signet test transaction…');
  try {
    const id=await api('signet','/tx',{method:'POST',body:tx.raw});
    if(id!==tx.id)throw Error('Unexpected broadcast response.');
    set('sweep-message',`Broadcast accepted (not yet confirmed). Transaction ID: ${id}`);
  }catch{set('sweep-message',`Broadcast status unknown. Check the Signet explorer before attempting again. Transaction ID: ${tx.id}`);}
  finally{sweeping=false;$('sweep-prepare').disabled=false;$('destination').disabled=false;$('fee-rate').disabled=false;}
});
function localKnown(){return known.filter(entry=>entry.network===currentNetwork());}
function renderKnown(){
  const list=$('known-list'),entries=localKnown();list.replaceChildren();
  if(!entries.length){const li=document.createElement('li');li.textContent=`No addresses saved on ${networkName()}.`;list.append(li);return;}
  for(const entry of entries){
    const item=document.createElement('li'),code=document.createElement('code'),button=document.createElement('button');
    item.textContent=entry.label||'Saved address';code.textContent=entry.address;
    button.type='button';button.className='secondary';button.textContent='Remove';button.setAttribute('aria-label',`Remove ${entry.label||'saved address'} ending ${entry.address.slice(-6)}`);
    button.addEventListener('click',()=>{
      const next=known.filter(x=>x!==entry);
      if(!write(storage.addresses,next)){set('known-feedback','Could not update this browser’s storage.');return;}
      known=next;renderKnown();set('known-feedback','Saved address removed.');set('recipient-feedback','');$('known-save').focus();
    });
    item.append(code,button);list.append(item);
  }
}
$('known-save').addEventListener('click',()=>{
  try{
    const address=readAddress('known-address'),label=$('known-label').value.trim();
    if(!validLabel(label,40))throw Error('Use a label of up to 40 characters without line breaks.');
    if(localKnown().some(x=>x.address===address))throw Error('This address is already saved on this network.');
    if(known.length>=100)throw Error('Address list is full. Remove an entry first.');
    const next=[...known,{address,label,network:currentNetwork()}];
    if(!write(storage.addresses,next))throw Error('Could not save in this browser.');
    known=next;$('known-address').value='';$('known-label').value='';renderKnown();set('known-feedback','Address saved on this device.');set('recipient-feedback','');
  }catch(err){set('known-feedback',err.message);}
});
$('recipient-check').addEventListener('click',()=>{
  try{
    const {state}=compareRecipient(readAddress('recipient-input'),localKnown());
    set('recipient-feedback',{
      exact:'Exact match. This does not prove ownership or trust. Confirm through a separate channel if in doubt.',
      similar:'Warning: similar but not identical. Pause and confirm the full address independently.',
      none:'No match on this network. That does not mean the address is trustworthy or fraudulent.'
    }[state]);
  }catch(err){set('recipient-feedback',err.message);}
});
const tasks=[
  'Confirm that the transaction exists on the selected network.', 'Check the full receiving address.', 'Check the expected amount.',
  'Check the confirmation status.', 'Review the transaction details independently.', 'Do not rely on screenshots as payment proof.',
  'Do not treat an unconfirmed payment as final.', 'Do not confuse a Bitcoin payment with a naira bank transfer.'
];
const checks=tasks.map(text=>{
  const row=document.createElement('label'),box=document.createElement('input'),label=document.createElement('span');
  row.className='tick';box.type='checkbox';label.textContent=text;row.append(box,label);$('check-items').append(row);box.addEventListener('change',checkProgress);return box;
});
function checkProgress(){const count=checks.filter(x=>x.checked).length;$('check-progress').value=count;set('check-count',`${count} of ${checks.length} checked`);}
function resetChecklist(){checks.forEach(x=>{x.checked=false;});checkProgress();}
$('check-reset').addEventListener('click',resetChecklist);checkProgress();
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>switchView(b.dataset.view));
$('brand').addEventListener('click',e=>{e.preventDefault();switchView('lookup');window.scrollTo(0,0);});
$('settings-open').addEventListener('click',()=>switchView('settings-panel'));
$('practice-check').addEventListener('click',practice);$('scenario').addEventListener('change',cancelCheck);
$('sample-load').addEventListener('click',()=>{
  cancelCheck();const sample=NETWORKS[currentNetwork()];$('lookup-address').value=sample.address;$('lookup-sats').value=formatBtc(sample.sats);$('lookup-txid').value=sample.txid;
});
$('lookup-check').addEventListener('click',runLive);
for(const id of ['lookup-address','lookup-sats','lookup-txid'])$(id).addEventListener('input',cancelCheck);
$('recipient-input').addEventListener('input',()=>set('recipient-feedback',''));
$('verify-network').addEventListener('change',e=>{setNetwork(e.currentTarget.value);write(storage.preferences,preferences);});
function settingsFeedback(message='',saved=false){
  const button=$('settings-save');
  button.dataset.saved=String(saved);
  button.textContent=saved?'Saved':'Save network';
  set('settings-message',message);
}
for(const radio of appearanceRadios)radio.addEventListener('change',()=>{
  if(!radio.checked||!themes.includes(radio.value))return;
  preferences.theme=radio.value;applyTheme();
  set('appearance-message',write(storage.preferences,preferences)?'Appearance updated and saved.':'Appearance updated for this visit. Browser storage is unavailable.');
});
$('settings-save').addEventListener('click',()=>{
  const net=$('profile-network').value;
  if(!Object.hasOwn(NETWORKS,net)){settingsFeedback('Choose a supported test network.');return;}
  setNetwork(net);
  const saved=write(storage.preferences,preferences);
  settingsFeedback(saved?'Network preference saved in this browser.':'Applied for this visit. The network preference could not be saved in this browser.',saved);
});
$('profile-network').addEventListener('change',()=>settingsFeedback());
themeQuery.addEventListener?.('change',applyTheme);
syncSettings();syncNetwork();applyTheme();renderProfile();
initTour({read,write,openView:switchView});
}
