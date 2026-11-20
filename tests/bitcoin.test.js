import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transaction, networks, payments} from 'bitcoinjs-lib';
import {checkPayment, compareRecipient, hex, inspectTransaction, makeWallet, outputScript, parseBtc, parseSats, paymentUri, prepareSweep} from '../src/bitcoin.js';
const wallet=makeWallet(), other=makeWallet(), txid='a'.repeat(64);
const invoice={address:wallet.address,sats:2500,txid};
const out=(w,value)=>({scriptpubkey:hex(w.script),value});
const tx=(vout, confirmed=true)=>({txid,vout,status:{confirmed,block_height:99}});
const utxo={txid,vout:2,value:2500,status:{confirmed:true}};

test('generates distinct, valid native SegWit Signet/testnet receive addresses',()=>{
  assert.match(wallet.address,/^tb1q/);assert.notEqual(wallet.address,other.address);assert.deepEqual(outputScript(wallet.address),wallet.script);
  const main=payments.p2wpkh({hash:new Uint8Array(20).fill(1),network:networks.bitcoin}).address;
  assert.throws(()=>outputScript(main));assert.throws(()=>outputScript(wallet.address.slice(0,-1)+'!'));
});
test('parses exact integer sats; rejects fractional, exponential, zero and out-of-supply amounts',()=>{
  assert.equal(parseSats('2500'),2500);for(const s of ['0','-1','1.5','1e4','+10','2100000000000001']) assert.throws(()=>parseSats(s));
  assert.equal(paymentUri(wallet.address,2500),`bitcoin:${wallet.address}?amount=0.00002500`);
});
test('sums only outputs to the receiving script, then checks exact amount and confirmations',()=>{
  const result=checkPayment(tx([out(wallet,600),out(other,100),out(wallet,1900)]),invoice,100);
  assert.deepEqual(result,{state:'matched',paid:2500,expected:2500,confirmations:2});
});
test('rejects overpayment, underpayment and wrong address; flags exact mempool match pending',()=>{
  for(const amount of [1500,3000]) assert.equal(checkPayment(tx([out(wallet,amount)]),invoice,100).state,'amount');
  assert.equal(checkPayment(tx([out(other,2500)]),invoice,100).state,'mismatch');
  assert.equal(checkPayment(tx([out(wallet,2500)],false),invoice,NaN).state,'pending');
});
test('fails closed on malformed or inconsistent transaction data',()=>{
  assert.throws(()=>checkPayment(tx([out(wallet,2500)]),{...invoice,txid:'b'.repeat(64)},100));
  assert.throws(()=>checkPayment(tx([out(wallet,2500)]),invoice,98));
  assert.throws(()=>checkPayment(tx([out(wallet,2.1)]),invoice,100));
  assert.throws(()=>checkPayment({...tx([out(wallet,2500)]),status:{confirmed:'true',block_height:99}},invoice,100));
});
test('signs a standard SegWit sweep and excludes unconfirmed outputs',()=>{
  const signed=prepareSweep(wallet,[utxo,{...utxo,vout:3,status:{confirmed:false}}],other.address,2);
  const decoded=Transaction.fromHex(signed.raw);
  assert.equal(signed.id,decoded.getId());assert.equal(decoded.ins.length,1);assert.equal(decoded.ins[0].index,2);
  assert.equal(decoded.ins[0].witness.length,2);assert.deepEqual(decoded.outs[0].script,other.script);
  assert.equal(signed.amount+signed.fee,2500);assert.ok(signed.fee>=2*decoded.virtualSize());
});
test('blocks self-sweep, duplicate outputs, invalid fees and insufficient confirmed balance',()=>{
  assert.throws(()=>prepareSweep(wallet,[utxo],wallet.address,2));assert.throws(()=>prepareSweep(wallet,[utxo,utxo],other.address,2));
  assert.throws(()=>prepareSweep(wallet,[utxo],other.address,51));assert.throws(()=>prepareSweep(wallet,[],other.address,2));
  assert.throws(()=>prepareSweep(wallet,[{...utxo,value:550}],other.address,2));
});

test('parses exactly eight decimal places without binary rounding and allows a label-only request',()=>{
  assert.equal(parseBtc('0.00000001'),1);assert.equal(parseBtc('21000000.00000000'),2100000000000000);
  for(const value of ['0','1e-8','0.000000001','-0.2','21000000.00000001','1,000'])assert.throws(()=>parseBtc(value));
  assert.equal(paymentUri(wallet.address,null, 'Flyer & layout'),`bitcoin:${wallet.address}?label=Flyer%20%26%20layout`);
  assert.equal(paymentUri(wallet.address,null),`bitcoin:${wallet.address}`);
  assert.throws(()=>paymentUri(wallet.address,null,'text\nnot a label'));
});
test('inspects fee, rounded virtual size and explicit sequence signalling',()=>{
  const original={...tx([out(wallet,2500)]),fee:453,weight:401,vin:[{sequence:0xfffffffd}]};
  assert.deepEqual(inspectTransaction(original,wallet.address),{paid:2500,outputMatch:true,fee:453,vsize:101,feeRate:453/101,rbf:'Signalled'});
  assert.equal(inspectTransaction({...original,vin:[{sequence:0xffffffff}]},wallet.address).rbf,'Not detected');
  assert.equal(inspectTransaction({...original,vin:undefined},wallet.address).rbf,'Unknown');
  assert.equal(inspectTransaction({...original,weight:undefined},wallet.address).feeRate,null);
});
test('normalizes uppercase Bech32 and distinguishes similar valid addresses from exact/no match',()=>{
  const first='tb1qf4x56n2df4x56n2df4x56n2df4x56ngqrwsv98', near='tb1qf4x56n2df4x56n2df4x56n2df4x56ngp7cyec4';
  const entries=[{address:first,label:'Public fixture'}];
  assert.equal(compareRecipient(first.toUpperCase(),entries).state,'exact');
  assert.equal(compareRecipient(near,entries).state,'similar');
  assert.equal(compareRecipient(first,[]).state,'none');
  assert.throws(()=>compareRecipient(first.slice(0,-1)+'p',entries));
});

test('rejects a confirmed history item without a positive integer block height',()=>{
  const entry=tx([out(wallet,2500)]);
  for(const height of [null,undefined,0,-1,1.2,'99']){
    assert.throws(()=>inspectTransaction({...entry,status:{confirmed:true,block_height:height}},wallet.address),/confirmation height/);
  }
  assert.equal(inspectTransaction({...entry,status:{confirmed:false}},wallet.address).paid,2500);
});
