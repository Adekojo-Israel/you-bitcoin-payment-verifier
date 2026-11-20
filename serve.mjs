import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html = await readFile(new URL('./site/index.html',import.meta.url));
const port = Number(process.env.PORT || 4173);
createServer((req,res)=>{
  const path=req.url.split('?')[0];
  if (!['/','/index.html'].includes(path) || !['GET','HEAD'].includes(req.method)) {res.writeHead(404).end('Not found');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
  res.end(req.method==='HEAD'?undefined:html);
}).listen(port,'0.0.0.0',()=>console.log(`YOU listening on port ${port}`));
