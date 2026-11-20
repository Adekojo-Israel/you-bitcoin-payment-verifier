import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { outputFiles } = await build({entryPoints:['src/app.js'], bundle:true, write:false, minify:true, target:'es2022', legalComments:'inline'});
const js = outputFiles[0].text.replace(/<\/script/gi,'<\\/script')
  // esbuild may emit raw Bitcoin message-prefix control bytes inside a template literal.
  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g,c=>'\\x'+c.charCodeAt(0).toString(16).padStart(2,'0'));
const hash = createHash('sha256').update(js).digest('base64');
const html = (await readFile('src/index.html','utf8')).replace('__JS_HASH__',hash);
const css = await readFile('src/style.css','utf8');
await mkdir('site',{recursive:true});
await writeFile('site/index.html',html.replace('/*INLINE_CSS*/',()=>css).replace('/*INLINE_JS*/',()=>js));
