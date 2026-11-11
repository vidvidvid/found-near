// Read-only, local-only enrichment. Never sends a message or validates identity.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createArchiveRpc} from './archive-rpc.mjs';
import {validAccount} from '../dist/rpc.js';
const root=new URL('../outreach/local/',import.meta.url);
const shortlist=JSON.parse(await readFile(new URL('shortlist.json',root),'utf8'));
const selected=shortlist.accounts;
assert.ok(selected.every(x=>validAccount(x.account)));
const headers=new Map();
const {request}=await createArchiveRpc({cacheDir:'/tmp/found-outreach-profile-cache/'+Date.now(),endpoint:'https://rpc.mainnet.fastnear.com',intervalMs:1000,validate:(result,method,params)=>{
 if(method==='block'){assert.ok(Number.isSafeInteger(result?.header?.height));assert.equal(typeof result.header.hash,'string');}
 if(method==='query'){assert.equal(result?.block_height,params.block_id);assert.equal(result.block_hash,headers.get(params.block_id));}
 return result;
}});
const {header}=await request('block',{finality:'final'});headers.set(header.height,header.hash);
const profiles={},raw=[];
for(let offset=0;offset<selected.length;offset+=25){
 const batch=selected.slice(offset,offset+25);
 const params={request_type:'call_function',account_id:'social.near',method_name:'get',args_base64:Buffer.from(JSON.stringify({keys:batch.map(x=>x.account+'/profile/**')})).toString('base64'),block_id:header.height};
 const response=await request('query',params),data=JSON.parse(Buffer.from(response.result).toString());
 assert.ok(data&&typeof data==='object'&&!Array.isArray(data));
 assert.ok(Object.keys(data).every(key=>batch.some(x=>x.account===key)));
 Object.assign(profiles,data);raw.push({method:'query',params,response});
}
const leaf=value=>typeof value==='string'?value:typeof value?.['']==='string'?value['']:null;
const rows=[];let codeChecks=0;
for(const row of selected){
 const p=profiles[row.account]?.profile;
 assert.ok(p===undefined||(p&&typeof p==='object'&&!Array.isArray(p)));
 let code='not-checked';
 if(p&&codeChecks++<20)try{const r=await request('query',{request_type:'view_account',account_id:row.account,block_id:header.height});code=r.code_hash==='11111111111111111111111111111111'?'no-deployed-code':'contract-code-present';}
 catch{code='unknown';}
 const rawTwitter=leaf(p?.linktree?.twitter),handle=rawTwitter?.replace(/^@/,'');
 rows.push({...row,currentCodeStatus:code,profileName:leaf(p?.name)?.slice(0,200)||null,selfPublishedXHandle:handle&&/^[A-Za-z0-9_]{1,15}$/.test(handle)?handle:null,profileFound:!!p,identityVerified:false,contacted:false});
}
await mkdir(root,{recursive:true});
await writeFile(new URL('profiles-raw.json',root),JSON.stringify(raw,null,2));
await writeFile(new URL('profile-shortlist.json',root),JSON.stringify({block:header.height,hash:header.hash,checkedAt:new Date().toISOString(),methodReference:'https://github.com/NearSocial/social-db#reading-data',warning:'Self-published profile hints only. Not verified identity or current withdrawal readiness. No-code does not prove human control. Manually confirm association and recheck live before a private message. Nothing sent.',accounts:rows},null,2));
console.log(JSON.stringify({checked:rows.length,profilesFound:rows.filter(r=>r.profileFound).length,selfPublishedHandles:rows.filter(r=>r.selfPublishedXHandle).length,contracts:rows.filter(r=>r.currentCodeStatus==='contract-code-present').length,output:'outreach/local/profile-shortlist.json',messagesSent:0}));
