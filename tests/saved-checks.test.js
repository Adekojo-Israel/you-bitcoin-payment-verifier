import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addSavedCheck, cleanSavedChecks, SAVED_CAP} from '../src/saved-checks.js';
const row = {network:'signet',address:'tb1qxc9rhgpdjcp42nmhg6lepe7pp5g86tx25vlv8h',txid:'a'.repeat(64),expectedSats:2500,label:'Unconfirmed',timestamp:1795114500000};

test('caps saved checks across networks and keeps the newest first',()=>{
  const rows = Array.from({length:25},(_,i)=>({...row,network:i%2?'testnet4':'signet',expectedSats:i+1,timestamp:row.timestamp+i}));
  const saved=cleanSavedChecks(rows);
  assert.equal(saved.length,SAVED_CAP);
  assert.deepEqual(saved.map(r=>r.expectedSats),Array.from({length:20},(_,i)=>25-i));
  assert.equal(addSavedCheck(saved,{...row,timestamp:row.timestamp+26})[0].expectedSats,2500);
});
test('deduplicates the same query and keeps distinct network, ID and amount queries',()=>{
  const later={...row,label:'Confirmed',timestamp:row.timestamp+1};
  const duplicate={...row,address:row.address.toUpperCase(),txid:row.txid.toUpperCase()};
  assert.deepEqual(cleanSavedChecks([duplicate,later]),[later]);
  assert.deepEqual(addSavedCheck([duplicate],later),[later]);
  const different=[{...row,network:'testnet4'},{...row,txid:null},{...row,expectedSats:2501}];
  assert.equal(cleanSavedChecks([row,...different]).length,4);
});
test('skips corrupted records and drops fields outside the permitted public data',()=>{
  for(const value of ['{not JSON',{},null,0])assert.deepEqual(cleanSavedChecks(value),[]);
  assert.deepEqual(cleanSavedChecks([null,{...row,network:'mainnet'},{...row,address:'fake'},
    {...row,expectedSats:1.5},{...row,txid:'xyz'},{...row,timestamp:1e20},{...row,label:'safe'},
    {...row,extra:'must not persist'}]),[row]);
});
