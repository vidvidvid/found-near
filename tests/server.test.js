import test from 'node:test';import assert from 'node:assert/strict';import {server} from '../server.mjs';
test('public server serves assets but not source, metadata, traversal or write requests',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/')).status,200);assert.equal(await (await fetch(base+'/health')).text(),'ok');
  const compressed=await fetch(base+'/leaderboard.json',{headers:{'Accept-Encoding':'gzip'}});assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'gzip');assert.ok(Array.isArray((await compressed.json()).accounts));
  const plain=await fetch(base+'/leaderboard.json',{headers:{'Accept-Encoding':'gzip;q=0'}});assert.equal(plain.headers.get('content-encoding'),null);assert.equal(plain.headers.get('vary'),'Accept-Encoding');assert.ok(Number(plain.headers.get('content-length'))>2048);await plain.arrayBuffer();
  for(const path of ['/spirit-sprite.webp','/wallet-sprite.webp','/found-night-plate.webp']){const response=await fetch(base+path);assert.equal(response.status,200,path);assert.equal(response.headers.get('content-type'),'image/webp');}
  for(const path of ['/.openai/hosting.json','/.git/config','/server.mjs','/%2e%2e%2fpackage.json','/nope.png'])assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  assert.equal(await (await fetch(base+'/',{method:'HEAD'})).text(),'');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
