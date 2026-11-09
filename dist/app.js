import {scanAccount,normalizeAccount,validAccount,formatNear,exactNear} from './rpc.js';
const $=id=>document.getElementById(id);let request=null,current=null,example=false;
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function linkIcon(){const span=document.createElement('span');span.className='icon-wrap';span.innerHTML='<svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>';return span;}
function nearIcon(){const img=document.createElement('img');img.src='./near.svg';img.alt='';img.className='near-icon';return img;}
function render(state,result){
 $('discovery').dataset.state=state;
 const content=$('pocket-content');content.replaceChildren();
 const statuses={loading:'Checking mainnet…',found:'Ready to withdraw',empty:'Pocket checked',pending:'Still unlocking',error:'Couldn’t check',unavailable:'Needs a recheck'};
 $('status').textContent=statuses[state];
 if(state==='loading'){content.append(element('h2','Looking in your pocket…'),element('p','Reading LiNEAR’s finalized account state.'));const bars=element('div','','empty-line');for(let i=0;i<3;i++)bars.append(element('span',''));content.append(bars);return;}
 if(state==='error'){content.append(element('h2','Let’s try that again.'),element('p',result.message));return;}
 content.append(element('p',result.account+(example?' · public example':''),'account-name'));
 if(state==='empty'){content.append(element('h2','All clear in this pocket.'),element('p','No NEAR waiting in LiNEAR. Other protocols haven’t been checked.'));}
 else {
  const amount=element('h2',formatNear(result.amount,4)+' ','amount');if(formatNear(result.amount,4).length>10)amount.classList.add('amount-long');amount.title=exactNear(result.amount)+' NEAR';amount.append(nearIcon(),element('small','NEAR'));content.append(amount);
  content.append(element('p',state==='found'?'Unstaked. Available. Still yours.':state==='pending'?'Your NEAR is still unlocking in LiNEAR. Check again after the waiting period.':'Your balance is there, but availability couldn’t be confirmed. Recheck before withdrawing.','result-caption'));
  if(state==='found') {const button=element('button',example?'See how the owner can withdraw':'Bring it home','withdraw-button');button.append(linkIcon());button.type='button';button.addEventListener('click',()=>{ $('withdraw-account').textContent=result.account;$('copy-account').textContent='Copy';$('withdraw-dialog').showModal();});content.append(button);}
  else if(state==='unavailable'){const button=element('button','Check availability again ↻','withdraw-button');button.type='button';button.onclick=()=>scan(result.account,example);content.append(button);}
 }
 const proof=element('div','','proof');const link=element('a','View account');link.href='https://nearblocks.io/address/'+encodeURIComponent(result.account);link.append(linkIcon());link.target='_blank';link.rel='noopener noreferrer';const block=element('a','Block '+result.height.toLocaleString('en-US'));block.append(linkIcon());block.href='https://nearblocks.io/blocks/'+result.height;block.target='_blank';block.rel='noopener noreferrer';proof.append(link,block);content.append(proof);
}
async function scan(value,isExample=false){
 const account=normalizeAccount(value);$('form-error').hidden=true;
 if(!validAccount(account)){$('form-error').textContent='Enter a NEAR account such as you.near (not an Ethereum address).';$('form-error').hidden=false;$('account').setAttribute('aria-invalid','true');$('account').focus();return;}
 $('account').removeAttribute('aria-invalid');$('account').value=account;request?.abort();const controller=new AbortController();request=controller;example=isExample;current=null;
 $('scan-button').disabled=true;$('try-example').disabled=true;$('scan-button').textContent='Checking…';render('loading');
 try{const result=await scanAccount(account,{signal:controller.signal});if(request!==controller)return;current=result;render(result.state,result);}
 catch(error){if(error.name!=='AbortError'&&request===controller)render('error',error);}
 finally{if(request===controller){$('scan-button').disabled=false;$('try-example').disabled=false;$('scan-button').textContent='Find my NEAR ';$('scan-button').append(linkIcon());}}
}
$('scan-form').addEventListener('submit',e=>{e.preventDefault();scan($('account').value);});
$('try-example').addEventListener('click',()=>scan('ru.near',true));
$('withdraw-dialog').querySelector('.close-dialog').onclick=()=>$('withdraw-dialog').close();
$('withdraw-dialog').addEventListener('click',e=>{if(e.target===$('withdraw-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('copy-account').onclick=async()=>{try{await navigator.clipboard.writeText(current.account);$('copy-account').textContent='Copied ✓';}catch{$('copy-account').textContent='Select to copy';}};
$('recheck').onclick=()=>{$('withdraw-dialog').close();if(current)scan(current.account,example);};

let leaderboardExpanded=false;
async function loadLeaderboard(){
 try{const response=await fetch('./leaderboard.json');if(!response.ok)throw Error();const data=await response.json();
 const renderRows=()=>{const body=$('leaderboard');body.replaceChildren();data.accounts.slice(0,leaderboardExpanded?10:5).forEach((a,i)=>{
 const row=element('tr',''),rank=element('td',String(i+1).padStart(2,'0'),'rank'),name=element('td','');
 const short=a.account_id.length>32?a.account_id.slice(0,10)+'…'+a.account_id.slice(-8):a.account_id;
 const button=element('button',short,'account-link');button.title=a.account_id;button.setAttribute('aria-label','Check '+a.account_id+' live');button.onclick=()=>{scan(a.account_id,true);document.querySelector('.hero').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 name.append(button);const amount=element('td',formatNear(a.unstaked_balance,2),'align-right');amount.title=exactNear(a.unstaked_balance)+' NEAR';row.append(rank,name,amount);body.append(row);
 });$('more-accounts').textContent=leaderboardExpanded?'Show fewer accounts':'Show all 10 accounts';};
 $('more-accounts').onclick=()=>{leaderboardExpanded=!leaderboardExpanded;renderRows();};renderRows();
 }catch{$('leaderboard').replaceChildren();$('more-accounts').hidden=true;const row=element('tr',''),cell=element('td','The snapshot couldn’t load. The live account checker above still works.');cell.colSpan=3;row.append(cell);$('leaderboard').append(row);}
}
loadLeaderboard();
