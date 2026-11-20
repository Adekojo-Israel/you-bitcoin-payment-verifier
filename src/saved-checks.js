import {canonicalAddress, isTxid, parseSats} from './bitcoin.js';

export const SAVED_CAP = 20;
export const SAVEABLE_LABELS = Object.freeze({
  matched:'Confirmed', pending:'Unconfirmed', mismatch:'Receiving-address mismatch',
  amount:'Amount mismatch', history:'Address history only', missing:'Transaction not found'
});
const labels = new Set([...Object.values(SAVEABLE_LABELS),'No recent incoming payment found'].flatMap(label=>[label, `Public example: ${label}`]));

function normalize(row) {
  if (!row || !['signet','testnet4'].includes(row.network) || !labels.has(row.label) ||
    !Number.isSafeInteger(row.timestamp) || row.timestamp < 1 || row.timestamp > 8.64e15 ||
    !Number.isSafeInteger(row.expectedSats) || (row.txid != null && !isTxid(row.txid))) return null;
  try {
    return {network:row.network, address:canonicalAddress(row.address), txid:row.txid?.toLowerCase() ?? null,
      expectedSats:parseSats(row.expectedSats), label:row.label, timestamp:row.timestamp};
  } catch {return null;}
}
export const savedKey = row => `${row.network}:${row.address}:${row.txid ?? ''}:${row.expectedSats}`;

export function cleanSavedChecks(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(), clean = [];
  const normalized = raw.map(normalize).filter(Boolean).sort((a,b)=>b.timestamp-a.timestamp);
  for (const row of normalized) {
    const key = savedKey(row);
    if (seen.has(key)) continue;
    seen.add(key);clean.push(row);
    if (clean.length === SAVED_CAP) break;
  }
  return clean;
}

// Saving the same check replaces the previous snapshot instead of adding a row.
export function addSavedCheck(rows, row) {
  const clean = cleanSavedChecks(rows), next = normalize(row);
  if (!next) return clean;
  return cleanSavedChecks([next, ...clean.filter(entry=>savedKey(entry)!==savedKey(next))]);
}
