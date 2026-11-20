import { address, networks, payments, Psbt } from 'bitcoinjs-lib';
import { secp256k1 } from '@noble/curves/secp256k1';

// Signet uses the same address encoding as testnet; the API selects the chain.
export const NETWORK = networks.testnet;
export const MAX_SATS = 2_100_000_000_000_000;
export const isTxid = x => typeof x === 'string' && /^[a-f0-9]{64}$/i.test(x);
export function parseSats(value) {
  const s = String(value).trim(), n = Number(s);
  if (!/^\d{1,16}$/.test(s) || !Number.isSafeInteger(n) || n < 1 || n > MAX_SATS) throw Error('Enter a positive whole number of sats.');
  return n;
}
export const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export function outputScript(value, network = NETWORK) {
  if (typeof value !== "string" || value.trim().length > 90) throw Error("Invalid address length.");
  return address.toOutputScript(value.trim(), network);
}
export function makeWallet(network = NETWORK) {
  const key = secp256k1.utils.randomSecretKey();
  const publicKey = secp256k1.getPublicKey(key, true);
  const payment = payments.p2wpkh({pubkey:publicKey, network});
  return {
    address: payment.address, script: payment.output, network,
    signer: { publicKey, sign: hash => secp256k1.sign(hash, key, {lowS:true, prehash:false}).toCompactRawBytes() }
  };
}
export function parseBtc(value) {
  const raw = String(value).trim();
  if (!/^\d{1,8}(?:\.\d{1,8})?$/.test(raw)) throw Error('Enter a positive BTC amount with up to eight decimal places (for example, 0.00002500).');
  const [whole, decimal = ''] = raw.split('.');
  return parseSats(Number(whole) * 100_000_000 + Number(decimal.padEnd(8, '0')));
}
export function formatBtc(sats) {
  return `${Math.floor(sats / 100_000_000)}.${String(sats % 100_000_000).padStart(8, '0')}`;
}
export function canonicalAddress(to, network = NETWORK) {
  const value = to.trim();
  outputScript(value, network);
  return /^(bc1|tb1|bcrt1)/i.test(value) ? value.toLowerCase() : value;
}
export function paymentUri(to, sats, label = '') {
  const dest = canonicalAddress(to);
  const query = [];
  if (sats !== null && sats !== undefined) query.push('amount=' + formatBtc(parseSats(sats)));
  if (typeof label !== 'string' || label.length > 60 || /[\x00-\x1f\x7f]/.test(label)) throw Error('Use a label of up to 60 characters without line breaks.');
  if (label.trim()) query.push('label=' + encodeURIComponent(label.trim()));
  return `bitcoin:${dest}${query.length ? '?' + query.join('&') : ''}`;
}
export function compareRecipient(candidate, items) {
  const value = canonicalAddress(candidate);
  const exact = items.find(item => item.address === value);
  if (exact) return {state:'exact', entry:exact};
  const near = items.find(({address:a}) => (a.slice(0,6) === value.slice(0,6) && a.slice(-6) === value.slice(-6)) ||
    (a.length === value.length && Array.from(a).filter((c,i) => c !== value[i]).length <= 7));
  return near ? {state:'similar', entry:near} : {state:'none'};
}
export function inspectTransaction(tx, address, network = NETWORK) {
  const script = hex(outputScript(address, network));
  if (!isTxid(tx?.txid) || !Array.isArray(tx.vout) || !tx.vout.length || typeof tx?.status?.confirmed !== 'boolean') throw Error('The explorer returned inconsistent transaction data.');
  if (tx.status.confirmed && (!Number.isSafeInteger(tx.status.block_height) || tx.status.block_height < 1)) throw Error('The explorer returned an invalid confirmation height.');
  let paid = 0, outputMatch = false;
  for (const o of tx.vout) {
    if (!o || typeof o.scriptpubkey !== 'string' || !/^(?:[0-9a-f]{2})*$/i.test(o.scriptpubkey) || !Number.isSafeInteger(o.value) || o.value < 0 || o.value > MAX_SATS) throw Error('The explorer returned an invalid output.');
    if (o.scriptpubkey.toLowerCase() === script) {paid += o.value; outputMatch = true;}
  }
  if (!Number.isSafeInteger(paid) || paid > MAX_SATS) throw Error('The explorer returned an invalid total.');
  const fee = Number.isSafeInteger(tx.fee) && tx.fee >= 0 && tx.fee <= MAX_SATS ? tx.fee : null;
  const vsize = Number.isSafeInteger(tx.weight) && tx.weight > 0 ? Math.ceil(tx.weight/4) : null;
  const sequences = Array.isArray(tx.vin) ? tx.vin.map(i=>i?.sequence) : [];
  const rbf = sequences.some(n=>Number.isInteger(n)&&n>=0&&n<0xfffffffe) ? 'Signalled' :
    sequences.length && sequences.every(n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff) ? 'Not detected' : 'Unknown';
  return {paid, outputMatch, fee, vsize, feeRate: fee!==null&&vsize ? fee/vsize : null, rbf};
}
export function checkPayment(tx, invoice, tip, network = NETWORK) {
  const expected = parseSats(invoice.sats);
  if (!isTxid(invoice.txid) || tx?.txid !== invoice.txid.toLowerCase()) throw Error('The explorer returned inconsistent transaction data.');
  const {paid} = inspectTransaction(tx, invoice.address, network);
  const confirmed = tx.status.confirmed;
  const height = tx.status.block_height;
  if (confirmed && (!Number.isSafeInteger(tip) || !Number.isSafeInteger(height) || height < 1 || height > tip)) throw Error('The confirmation height could not be verified.');
  const confirmations = confirmed ? tip - height + 1 : 0;
  const state = !paid ? 'mismatch' : paid !== expected ? 'amount' : confirmations < 1 ? 'pending' : 'matched';
  return {state, paid, expected, confirmations};
}
export function prepareSweep(wallet, utxos, destination, feeRate) {
  const out = outputScript(destination, wallet.network);
  if (hex(out) === hex(wallet.script)) throw Error('Choose a destination outside this wallet.');
  if (!Number.isSafeInteger(feeRate) || feeRate < 1 || feeRate > 50) throw Error('Fee rate must be 1–50 sat/vB.');
  if (!Array.isArray(utxos)) throw Error('Invalid explorer output list.');
  const spendable = utxos.filter(u => u?.status?.confirmed === true);
  if (!spendable.length) throw Error('There are no confirmed outputs to send.');
  if (spendable.length > 20) throw Error('This demo supports at most 20 confirmed outputs.');
  const psbt = new Psbt({network:wallet.network});
  let total = 0;
  const seen = new Set();
  for (const u of spendable) {
    const id = `${String(u.txid).toLowerCase()}:${u.vout}`;
    if (!isTxid(u.txid) || !Number.isInteger(u.vout) || u.vout < 0 || u.vout > 0xffffffff || seen.has(id)) throw Error('Invalid or duplicate wallet output.');
    seen.add(id);
    const sats = parseSats(u.value);
    total += sats;
    if (!Number.isSafeInteger(total) || total > MAX_SATS) throw Error('Invalid wallet total.');
    psbt.addInput({hash:u.txid, index:u.vout, witnessUtxo:{script:wallet.script, value:BigInt(sats)}});
  }
  // Conservative native SegWit input size and a bounded, user-supplied fee rate.
  const fee = (12 + 69 * spendable.length + 9 + out.length) * feeRate;
  if (total - fee < 546) throw Error('Balance is too small after the network fee (546 sats minimum output in this demo).');
  psbt.addOutput({script:out, value:BigInt(total - fee)});
  psbt.signAllInputs(wallet.signer);
  if (!psbt.validateSignaturesOfAllInputs((key, hash, sig) => secp256k1.verify(sig,hash,key,{prehash:false,lowS:true}))) throw Error('Could not validate the transaction signatures.');
  const tx = psbt.finalizeAllInputs().extractTransaction();
  return {id:tx.getId(), raw:tx.toHex(), amount:total-fee, fee, destination};
}
