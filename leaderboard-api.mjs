import {dormancyPresentation} from './dormancy-api.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const PAGE_SIZE=10;
// Derived presentation metadata. The archived census stays byte-for-byte reproducible.
export function createLeaderboard(snapshot,{dormancy=null,dormancyText=null,dormancyCode=null}={}){
 if(snapshot.version!==2||!snapshot.complete||!Array.isArray(snapshot.accounts)||snapshot.accounts.length!==snapshot.counts?.accountsWithWaiting)throw Error('Incomplete census');
 const ages=dormancyPresentation(snapshot,dormancy,{text:dormancyText,code:dormancyCode});
 const total=snapshot.accounts.reduce((sum,row)=>sum+BigInt(row.unstaked_balance),0n);
 if(total.toString()!==snapshot.totalListedYocto)throw Error('Census total mismatch');
 const lockups=snapshot.accounts.filter(row=>row.account_id.endsWith('.lockup.near'));
 const metadata={version:2,block:snapshot.block,hash:snapshot.hash,asOf:snapshot.asOf,complete:true,counts:snapshot.counts,totalListedYocto:snapshot.totalListedYocto,
  lockups:{accounts:lockups.length,totalYocto:lockups.reduce((sum,row)=>sum+BigInt(row.unstaked_balance),0n).toString(),classification:'Account ID ends with .lockup.near; requires its lockup contract, not direct withdrawal in FOUND.'},
  totalPages:Math.ceil(snapshot.accounts.length/PAGE_SIZE),pageSize:PAGE_SIZE,...(ages.metadata?{dormancy:ages.metadata}: {})};
 const revision=createHash('sha256').update(JSON.stringify(snapshot)+ages.revision).digest('hex').slice(0,20);
 return {revision,page(number){
  if(!Number.isSafeInteger(number)||number<1||number>metadata.totalPages)return null;
  return {...metadata,page:number,accounts:snapshot.accounts.slice((number-1)*PAGE_SIZE,number*PAGE_SIZE).map(row=>({...row,accountKind:row.account_id.endsWith('.lockup.near')?'lockup':'unclassified',...(ages.rows.has(row.account_id)?{dormancy:ages.rows.get(row.account_id)}:{})}))};
 }};
}
export function createLeaderboardApi({file=new URL('./dist/leaderboard.json',import.meta.url),dormancyFile=new URL('./dist/dormancy.json',import.meta.url),codeFile=new URL('./dist/dormancy-code.json',import.meta.url)}={}){
 let cached;
 return async(req,res,url)=>{
  if(url.pathname!=='/api/leaderboard')return false;
  res.setHeader('Access-Control-Allow-Origin','*');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
  const param=url.searchParams.get('page')??'1';
  if(!/^[1-9]\d{0,5}$/.test(param)||url.searchParams.getAll('page').length>1){res.writeHead(400,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'Use a positive integer page number.'}));return true;}
  try{
   const optional=path=>readFile(path,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
   // A malformed contract-code file is withheld rather than failing the census.
   const parseCode=text=>{try{return text?JSON.parse(text):null;}catch{return null;}};
   cached??=Promise.all([readFile(file,'utf8'),optional(dormancyFile),optional(codeFile)]).then(([text,age,code])=>createLeaderboard(JSON.parse(text),{dormancy:age?JSON.parse(age):null,dormancyText:age,dormancyCode:parseCode(code)})).catch(error=>{cached=null;throw error;});
   const dataset=await cached,page=dataset.page(Number(param));
   if(!page){res.writeHead(404,{'Content-Type':'application/json'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'Page not found.'}));return true;}
   const etag=`"${dataset.revision}-${param}"`;
   res.setHeader('ETag',etag);res.setHeader('Cache-Control','public, max-age=300');
   if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return true;}
   const body=JSON.stringify(page);res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:JSON.stringify({error:'Census temporarily unavailable.'}));}
  return true;
 };
}
