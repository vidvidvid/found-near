import {scanProtocols,normalizeAccount,validAccount,formatNear,exactNear,PROTOCOLS} from './rpc.js';
const $=id=>document.getElementById(id);let request=null,current=null,example=false;
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function linkIcon(){const span=document.createElement('span');span.className='icon-wrap';span.innerHTML='<svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>';return span;}
function nearIcon(){const img=document.createElement('img');img.src='./near.svg';img.alt='';img.className='near-icon';return img;}
function openWithdrawal(result){
 const protocol=PROTOCOLS[result.protocol];
 $('withdraw-account').textContent=result.account;
 $('copy-account').textContent='Copy';
 $('withdraw-description').textContent=`Withdraw through ${protocol.name}’s official app. FOUND never handles your money.`;
 const steps=result.protocol==='linear'?['Connect the wallet that controls this account.','In My Account, find your available NEAR and choose Withdraw.','Review and approve in your wallet.']:['Connect the wallet that controls this account.','Select NEAR and find your completed delayed unstake on the Dashboard.','Choose Withdraw, then review and approve in your wallet.'];
 $('withdraw-steps').replaceChildren(...steps.map(step=>element('li',step)));
 $('withdraw-link').href=protocol.appUrl;
 $('withdraw-link').replaceChildren(`Open ${protocol.name} to withdraw`,linkIcon());
 $('withdraw-domain').textContent=protocol.appHost+' · Network fees may apply';
 $('withdraw-dialog').showModal();
}
function amountElement(amount){
 const display=formatNear(amount,4),heading=element('h2',display+' ','amount');
 if(display.length>10)heading.classList.add('amount-long');
 heading.title=exactNear(amount)+' NEAR';
 heading.append(nearIcon(),element('small','NEAR'));
 return heading;
}
function protocolResult(result){
 const protocol=PROTOCOLS[result.protocol],section=element('section','','protocol-result');
 const heading=element('div','','protocol-result-heading');
 heading.append(element('h3',protocol.name),element('span',result.state==='found'?'Ready to withdraw':result.state==='pending'?'Still unlocking':result.state==='unsupported'?'Lockup account':'Needs a recheck','result-state'));
 section.append(heading,amountElement(result.amount));
 const captions={
  found:'Unstaked. Available. Still yours.',
  pending:`Your NEAR is still unlocking in ${protocol.name}. Check again after the waiting period.`,
  unavailable:'Your balance is there, but availability couldn’t be confirmed. Recheck before withdrawing.',
  unsupported:'This lockup account has matured NEAR in Meta Pool. Withdraw through its lockup contract, not a regular wallet session.'
 };
 section.append(element('p',captions[result.state],'result-caption'));
 if(result.state==='found'){
  const button=element('button',example?'See how the owner can withdraw':'Bring it home','withdraw-button');
  button.append(linkIcon());button.type='button';button.onclick=()=>openWithdrawal(result);section.append(button);
 }else if(result.state==='unavailable'){
  const button=element('button','Check availability again ↻','withdraw-button');button.type='button';button.onclick=()=>scan(result.account,example);section.append(button);
 }
 return section;
}
function render(state,result){
 $('discovery').dataset.state=state;
 const content=$('pocket-content');content.replaceChildren();
 const statuses={loading:'Checking mainnet…',done:'Pockets checked',error:'Couldn’t check'};
 $('status').textContent=statuses[state];
 if(state==='loading'){
  content.append(element('h2','Looking in your pockets…'),element('p','Reading finalized LiNEAR and Meta Pool state.'));
  const bars=element('div','','empty-line');for(let i=0;i<3;i++)bars.append(element('span',''));content.append(bars);return;
 }
 if(state==='error'){content.append(element('h2','Let’s try that again.'),element('p',result.message));return;}
 content.append(element('p',result.account+(example?' · public example':''),'account-name'));
 const positive=result.results.filter(item=>item.amount&&BigInt(item.amount)>0n);
 const empty=result.results.filter(item=>item.state==='empty');
 const failed=result.results.filter(item=>item.state==='error');
 if(positive.length===0&&failed.length===0)content.append(element('h2','All clear in these pockets.'),element('p','No NEAR waiting in LiNEAR or Meta Pool. Other protocols haven’t been checked.'));
 else{
  content.append(...positive.map(protocolResult));
  if(empty.length)content.append(element('p',empty.map(item=>PROTOCOLS[item.protocol].name).join(' · ')+': no NEAR waiting.','other-pockets'));
  failed.forEach(item=>content.append(element('p',`${PROTOCOLS[item.protocol].name}: couldn’t check. Balance unknown, not zero. ${item.message}`,'protocol-error')));
 }
 const proof=element('div','','proof'),link=element('a','View account');
 link.href='https://nearblocks.io/address/'+encodeURIComponent(result.account);link.append(linkIcon());link.target='_blank';link.rel='noopener noreferrer';
 const block=element('a','Block '+result.height.toLocaleString('en-US'));block.append(linkIcon());block.href='https://nearblocks.io/blocks/'+result.height;block.target='_blank';block.rel='noopener noreferrer';proof.append(link,block);content.append(proof);
}
async function scan(value,isExample=false){
 const account=normalizeAccount(value);$('form-error').hidden=true;
 if(!validAccount(account)){$('form-error').textContent='Enter a NEAR account such as you.near (not an Ethereum address).';$('form-error').hidden=false;$('account').setAttribute('aria-invalid','true');$('account').focus();return;}
 $('account').removeAttribute('aria-invalid');$('account').value=account;request?.abort();const controller=new AbortController();request=controller;example=isExample;current=null;
 $('scan-button').disabled=true;$('try-example').disabled=true;$('scan-button').textContent='Checking…';render('loading');
 try{const result=await scanProtocols(account,{signal:controller.signal});if(request!==controller)return;current=result;render('done',result);}
 catch(error){if(error.name!=='AbortError'&&request===controller)render('error',error);}
 finally{if(request===controller){$('scan-button').disabled=false;$('try-example').disabled=false;$('scan-button').textContent='Find my NEAR ';$('scan-button').append(linkIcon());}}
}
$('scan-form').addEventListener('submit',e=>{e.preventDefault();scan($('account').value);});
$('try-example').addEventListener('click',()=>scan('ru.near',true));
$('withdraw-dialog').querySelector('.close-dialog').onclick=()=>$('withdraw-dialog').close();
$('withdraw-dialog').addEventListener('click',e=>{if(e.target===$('withdraw-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('copy-account').onclick=async()=>{try{await navigator.clipboard.writeText(current.account);$('copy-account').textContent='Copied ✓';}catch{$('copy-account').textContent='Select to copy';}};
$('recheck').onclick=()=>{$('withdraw-dialog').close();if(current)scan(current.account,example);};
const PAGE_SIZE=10;
let leaderboardPage=0;
async function loadLeaderboard(){
 try{const response=await fetch('./leaderboard.json');if(!response.ok)throw Error();const data=await response.json();
 const pageCount=Math.ceil(data.accounts.length/PAGE_SIZE);
 const renderRows=()=>{const body=$('leaderboard');body.replaceChildren();const start=leaderboardPage*PAGE_SIZE;
 data.accounts.slice(start,start+PAGE_SIZE).forEach((a,i)=>{
 const row=element('tr',''),rank=element('td',String(start+i+1).padStart(2,'0'),'rank'),name=element('td','');
 const short=a.account_id.length>32?a.account_id.slice(0,10)+'…'+a.account_id.slice(-8):a.account_id;
 const button=element('button',short,'account-link');button.title=a.account_id;button.setAttribute('aria-label','Check '+a.account_id+' live');button.onclick=()=>{scan(a.account_id,true);document.querySelector('.hero').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 name.append(button);const amount=element('td',formatNear(a.unstaked_balance,4),'align-right');amount.title=exactNear(a.unstaked_balance)+' NEAR';row.append(rank,name,amount);body.append(row);
 });
 $('page-range').textContent=`${start+1}–${Math.min(start+PAGE_SIZE,data.accounts.length)} of ${data.accounts.length} accounts`;
 $('previous-page').disabled=leaderboardPage===0;$('next-page').disabled=leaderboardPage===pageCount-1;
 $('page-numbers').replaceChildren();
 const pages=[...new Set([0,leaderboardPage-1,leaderboardPage,leaderboardPage+1,pageCount-1])].filter(p=>p>=0&&p<pageCount).sort((a,b)=>a-b);
 pages.forEach((page,i)=>{if(i&&page-pages[i-1]>1)$('page-numbers').append(element('span','…','page-ellipsis'));
 const button=element('button',String(page+1),'page-number');button.type='button';button.setAttribute('aria-label',`Page ${page+1}`);if(page===leaderboardPage)button.setAttribute('aria-current','page');button.onclick=()=>{leaderboardPage=page;renderRows();};$('page-numbers').append(button);});
 };
 $('previous-page').onclick=()=>{if(leaderboardPage>0){leaderboardPage--;renderRows();}};
 $('next-page').onclick=()=>{if(leaderboardPage<pageCount-1){leaderboardPage++;renderRows();}};renderRows();
 }catch{$('leaderboard').replaceChildren();$('pagination').hidden=true;const row=element('tr',''),cell=element('td','The snapshot couldn’t load. The live account checker above still works.');cell.colSpan=3;row.append(cell);$('leaderboard').append(row);}
}
loadLeaderboard();
