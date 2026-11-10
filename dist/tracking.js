// Only withdrawal requests and public receipts. No page-view events, cookies, or wallet keys.
const QUEUE='found:unreported-recoveries:v1';
function queue(){try{const rows=JSON.parse(localStorage.getItem(QUEUE)||'[]');return Array.isArray(rows)?rows.slice(-50):[];}catch{return [];}}
function save(rows){try{localStorage.setItem(QUEUE,JSON.stringify(rows));}catch{}}
async function post(path,data){const response=await fetch('/api/recoveries/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(path==='confirm'?20000:4000)});return {status:response.status,data:await response.json()};}
export async function startRecoveryTracking(result){try{const response=await post('start',{account:result.account,protocol:result.protocol,amount:result.amount,codeHash:result.codeHash});return response.status===201&&/^[a-f0-9]{48}$/.test(response.data.intentId)?response.data.intentId:null;}catch{return null;}}
let flushing=null;
export function flushRecoveries(){
 if(flushing)return flushing;
 flushing=(async()=>{for(const item of queue()){
  try{const r=await post('confirm',item);if(r.status===200&&r.data.recorded){save(queue().filter(x=>x.hash!==item.hash));window.dispatchEvent(new Event('found:recovery-recorded'));}else if([400,404,409,422].includes(r.status))save(queue().filter(x=>x.hash!==item.hash));}catch{}
 }})().finally(()=>{flushing=null;});return flushing;
}
export function trackConfirmedRecovery(pending){
 if(!pending.trackingId)return;
 const items=queue();if(!items.some(x=>x.hash===pending.hash))items.push({intentId:pending.trackingId,hash:pending.hash});save(items.slice(-50));void flushRecoveries();
}
export async function recoveryTotals(){try{const r=await fetch('/api/recoveries');if(!r.ok)return null;const data=await r.json();return Number.isSafeInteger(data.withdrawals)&&data.withdrawals>=0&&Number.isSafeInteger(data.accounts)&&data.accounts>=0&&/^\d+$/.test(data.totalYocto)?data:null;}catch{return null;}}
