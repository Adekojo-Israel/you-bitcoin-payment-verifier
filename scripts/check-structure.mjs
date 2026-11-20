import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const html=await readFile('src/index.html','utf8'), js=await readFile('src/app.js','utf8'), built=await readFile('site/index.html','utf8');
const ids=[...html.matchAll(/\bid="([\w-]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'Duplicate IDs');
for(const re of [/\b(?:for|aria-labelledby|data-view|data-copy)="([\w-]+)"/g,/(?:\$|set|visible|readAddress)\('([\w-]+)'/g]){
  const source=re.source.includes('data-copy')?html:js;
  for(const m of source.matchAll(re))assert.ok(ids.includes(m[1]),`Missing element: ${m[1]}`);
}
for (const apparent of [/<!doctype html>/i, /<html lang="en">/, /<meta name="viewport"/, /<main\b/, /<h1\b/, /<nav\b/]) assert.match(html,apparent);
assert.ok(!built.includes('/*INLINE_JS*/')&&!built.includes('/*INLINE_CSS*/')&&!built.includes('__JS_HASH__'));
const script=built.match(/<script>([\s\S]+)<\/script>/)[1];
assert.ok(built.includes(`sha256-${createHash('sha256').update(script).digest('base64')}`),'CSP hash does not match the embedded script');
assert.doesNotMatch(js,/innerHTML\s*=|console\./);
console.log(`HTML structure and CSP checked: ${ids.length} unique IDs, no missing literal references.`);
