// Read-only mainnet verification. No keys, broadcasts, or wallet integration.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {scanProtocols,POOL_CODE_HASHES,RNEAR_CODE_HASH} from '../dist/rpc.js';
async function request(method,params,endpoint='https://free.rpc.fastnear.com'){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'found-verify',method,params}),signal:AbortSignal.timeout(15000)});
 assert.ok(response.ok,`HTTP ${response.status}`);const data=await response.json();assert.ok(!data.error&&!data.result?.error,JSON.stringify(data.error||data.result?.error));return data.result;
}
const encode=args=>Buffer.from(JSON.stringify(args)).toString('base64');
function hash(bytes){let n=BigInt('0x'+createHash('sha256').update(bytes).digest('hex')),value='';const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';while(n){value=alphabet[Number(n%58n)]+value;n/=58n;}return value;}
const view=await request('query',{request_type:'view_account',account_id:'lst.rhealab.near',finality:'final'}),block=view.block_height;
assert.equal(view.code_hash,RNEAR_CODE_HASH,'rNEAR changed; review before adding a new code hash');
async function code(account){const r=await request('query',{request_type:'view_code',account_id:account,block_id:block});assert.equal(r.block_height,block);const bytes=Buffer.from(r.code_base64,'base64');assert.equal(hash(bytes),r.hash);return {bytes,hash:r.hash};}
const [legacyFactory,legacyPool,modernPool,modernFactory]=await Promise.all(['poolv1.near','meteor.poolv1.near','shitzu.pool.near','pool.near'].map(code));
assert.equal(legacyPool.hash,POOL_CODE_HASHES[0]);assert.equal(modernPool.hash,POOL_CODE_HASHES[1]);assert.ok(legacyFactory.bytes.includes(legacyPool.bytes),'Legacy factory does not embed this pool code');
const factoryCode=await request('query',{request_type:'call_function',account_id:'pool.near',method_name:'get_code',args_base64:encode({code_hash:modernPool.hash}),block_id:block});assert.deepEqual(Buffer.from(factoryCode.result),modernPool.bytes,'Modern factory code differs');
const protocol=await request('EXPERIMENTAL_protocol_config',{block_id:block});assert.equal(protocol.runtime_config.storage_amount_per_byte,'10000000000000000000');
const metadata=await request('query',{request_type:'call_function',account_id:'lst.rhealab.near',method_name:'contract_source_metadata',args_base64:encode({}),block_id:block});
const report={checkedAt:new Date().toISOString(),block,blockHash:view.block_hash,factoryProof:{legacyFactory:legacyFactory.hash,legacyPool:legacyPool.hash,legacyEmbedsExactPool:true,modernFactory:modernFactory.hash,modernPool:modernPool.hash,modernReturnsExactPool:true},storageCost:protocol.runtime_config.storage_amount_per_byte,protocolVersion:protocol.protocol_version,rnearMetadata:JSON.parse(Buffer.from(metadata.result).toString()),accounts:[]};
for(const account of ['deportivo.near','within4d45.near','ru.near','lb3.near','root.near']){
 const result=await scanProtocols(account),independent=[];
 for(const row of result.results.filter(r=>r.state==='found'&&(r.protocol==='rnear'||r.protocol.startsWith('pool:')))){
  const contract=row.protocol==='rnear'?'lst.rhealab.near':row.protocol.slice(5);
  const r=await request('query',{request_type:'call_function',account_id:contract,method_name:row.protocol==='rnear'?'get_account_details':'get_account',args_base64:encode({account_id:account}),block_id:result.height},'https://rpc.intea.rs');
  const details=JSON.parse(Buffer.from(r.result).toString());assert.equal(r.block_hash,result.block);assert.equal(details.account_id,account);assert.equal(details.unstaked_balance,row.amount);assert.equal(details.can_withdraw,true);
  independent.push({contract,provider:'https://rpc.intea.rs',block:r.block_hash,amount:details.unstaked_balance,can_withdraw:details.can_withdraw});
 }
 report.accounts.push({result,independent});console.log(`${account}: ${result.results.length} sources, ${independent.length} new ready balances cross-checked`);
}
const index=process.argv.indexOf('--output');if(index!==-1){const output=process.argv[index+1];assert.ok(output);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(`Saved ${output}`);}else console.log(JSON.stringify(report,null,2));
