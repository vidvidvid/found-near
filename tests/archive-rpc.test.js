import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createArchiveRpc} from '../scripts/archive-rpc.mjs';
test('shared archive client validates cached evidence, keys every parameter, and preserves provider failures',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'found-archive-test-'));
 try{
  let requests=0;
  const fetcher=async(_url,{body})=>{requests++;const {params}=JSON.parse(body);return {ok:true,json:async()=>params.fail?{error:{cause:{name:'UNKNOWN_ACCOUNT'}}}:{result:{block_height:params.block_id,block_hash:'pinned'}}};};
  const validate=r=>{assert.equal(r.block_hash,'pinned');return r;};
  const client=await createArchiveRpc({cacheDir:directory,endpoint:'fixture',intervalMs:0,retries:1,fetcher,validate});
  await client.request('query',{block_id:1});await client.request('query',{block_id:1});await client.request('query',{block_id:2});
  assert.equal(requests,2);assert.equal(client.stats.cacheHits,1);
  const wrong=await createArchiveRpc({cacheDir:directory,endpoint:'fixture',intervalMs:0,retries:1,fetcher,validate:()=>{throw Error('wrong cached block');}});
  await assert.rejects(wrong.request('query',{block_id:1}),/wrong cached block/);assert.equal(requests,2);
  await assert.rejects(client.request('query',{block_id:3,fail:true}),e=>e.missingAccount&&e.permanent&&e.rpcError.cause.name==='UNKNOWN_ACCOUNT');
 }finally{await rm(directory,{recursive:true});}
});
