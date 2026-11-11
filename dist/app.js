import {readTiming,unlockEstimate,calendarReminder} from './unlock.js';
import {recoveryTotals} from './tracking.js';
import {createWalletUi} from './wallet-ui.js';
import {scanProtocols,rpc,normalizeAccount,validAccount,formatNear,compactNear,exactNear,PROTOCOLS,protocolInfo} from './rpc.js';
const $=id=>document.getElementById(id);
function accountUrl(account){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('account',account);return url;}
let request=null,current=null,example=false,walletUi;
let welcomeExit=null,validation=null;
function journey(state){$('discovery').dataset.journey=state;}
const smallBalance=row=>row.state==='found'&&BigInt(row.amount)<10n**19n;
function resultJourney(result){
 if(result.results.some(item=>item.state==='found'&&!smallBalance(item)))return 'found';
 if(incompleteScan(result))return 'error';
 if(result.results.some(item=>item.state==='pending'||item.state==='unsupported'))return 'pending';
 return 'empty';
}
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function linkIcon(){const span=document.createElement('span');span.className='icon-wrap';span.innerHTML='<svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>';return span;}
function nearIcon(){const img=document.createElement('img');img.src='./near.svg';img.alt='';img.className='near-icon';return img;}
function openWithdrawal(result){
 const protocol=protocolInfo(result.protocol);
 $('withdraw-account').textContent=result.account;
 $('copy-account').textContent='Copy';
 $('withdraw-description').textContent=`Withdraw from ${protocol.name} here on FOUND. The protocol sends NEAR straight to your wallet.`;
 const steps=['Connect the wallet that controls this account.','Choose Withdraw NEAR on the result card.','Approve in your wallet. FOUND checks the receipt and refreshes your balance.'];
 $('withdraw-steps').replaceChildren(...steps.map(step=>element('li',step)));
 $('withdraw-link').href=protocol.appUrl;
 $('withdraw-link').replaceChildren(protocol.kind==='pool'?'Open NEAR Staking':`Use the official ${protocol.name} app instead`,linkIcon());
 $('withdraw-domain').textContent=protocol.appHost+' · Network fees may apply';
 journey('guide');
 $('withdraw-dialog').showModal();
}
function amountElement(amount){
 const display=formatNear(amount,4),heading=element('h2',display+' ','amount');
 if(display.length>10)heading.classList.add('amount-long');
 if(display.length>16)heading.classList.add('amount-huge');
 heading.title=exactNear(amount)+' NEAR';
 const unit=element('small','','amount-unit');
 unit.append(nearIcon(),element('span','NEAR'));
 heading.append(unit);
 return heading;
}
function welcomePanel(){
 const panel=element('div','','pocket-welcome'),art=element('div','','welcome-art');
 art.setAttribute('aria-hidden','true');
 const wallet=element('span','','welcome-wallet'),sprite=element('span','','friend-sprite wallet-sprite');wallet.append(sprite);
 const coin=element('span','','welcome-coin');coin.append(nearIcon());
 art.append(wallet,coin,element('span','','welcome-spark spark-left'),element('span','','welcome-spark spark-right'));
 const title=element('h2','See what’s waiting.');title.id='welcome-title';
 const description=element('p','Find NEAR you unstaked but haven’t withdrawn.','welcome-description');
 const button=element('button','Try a real account','welcome-example');button.type='button';button.onclick=()=>scan('ru.near',true);
 panel.append(art,title,description,button,element('p','LiNEAR · Meta Pool · rNEAR + validator pools','welcome-coverage'));
 return panel;
}
const timingReads=new Map(),unlockReads=new Map();
function addUnlockEstimate(section,result){
 const key=result.block+':'+result.protocol+':'+result.account;
 if(!unlockReads.has(key)){
  if(!timingReads.has(result.block)){
   if(timingReads.size>=8)timingReads.delete(timingReads.keys().next().value);
   // Share timing reads across all pending pools at this same scan block.
   const clock=readTiming(result.block);clock.catch(()=>{});timingReads.set(result.block,clock);
  }
  if(unlockReads.size>=192)unlockReads.delete(unlockReads.keys().next().value);
  unlockReads.set(key,unlockEstimate(result,{timing:timingReads.get(result.block)}));
 }
 unlockReads.get(key).then(estimate=>{
  if(!estimate||!section.isConnected)return;
  const when=new Date(Math.round(Date.parse(estimate.estimatedAt)/900000)*900000),caption=section.querySelector('.result-caption');
  caption.textContent='Estimated unlock: '+when.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})+'. Recheck before withdrawing.';
  caption.title=estimate.method+' Unlock epoch '+estimate.unlockEpoch+'.';
  const link=element('button','Add calendar reminder','withdraw-help');link.type='button';
  link.onclick=()=>{
   const data=calendarReminder({account:result.account,protocol:result.protocol,estimatedAt:when.toISOString()});
   const url=URL.createObjectURL(new Blob([data],{type:'text/calendar;charset=utf-8'}));
   const download=document.createElement('a');download.href=url;download.download='found-withdrawal-reminder.ics';download.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  };
  section.append(link);
 });
}
function protocolResult(result){
 const protocol=protocolInfo(result.protocol),section=element('section','','protocol-result');
 section.dataset.result=result.state;
 const heading=element('div','','protocol-result-heading');
 const labels={idle:'Not checked',loading:'Checking…',found:'Ready to withdraw',readonly:'Balance checked · read only',pending:'Still unlocking',unsupported:result.reason==='implementation'?'Not supported yet':'Lockup account',unavailable:'Availability unknown',empty:'All clear',error:'Couldn’t check'};
 const title=element('h3',protocol.name);title.title=protocol.contract;
 heading.append(title,element('span',labels[result.state],'result-state'));
 section.append(heading);
 const known=result.amount!==undefined;
 section.append(known?amountElement(result.amount):element('div',['error','unsupported'].includes(result.state)?'Unknown':'—','balance-placeholder'));
 if(result.state==='found'){
  const actions=element('div','','withdraw-actions'),link=element('button',walletUi.actionLabel(result),'withdraw-button');
  link.type='button';link.disabled=walletUi.disabled();link.onclick=()=>walletUi.withdraw(result);
  const help=element('button','Help','withdraw-help');help.type='button';help.setAttribute('aria-label',`How to withdraw from ${protocol.name}`);help.onclick=()=>openWithdrawal(result);
  actions.append(link,help);section.append(actions);
 }else if(result.state==='readonly'){
  section.append(element('p',BigInt(result.amount)===0n?'No unstaked NEAR here. This pool is read-only in FOUND.':result.reportedCanWithdraw?'Unstaked NEAR reported by the pool. Use MyNearWallet to check and withdraw.':'The pool reports this balance is still unlocking. Manage it in MyNearWallet.','result-caption'));
  const link=element('a','Open MyNearWallet','withdraw-help');link.href=protocol.appUrl;link.target='_blank';link.rel='noopener noreferrer';link.append(linkIcon());section.append(link);
 }else if(result.state==='unavailable'||result.state==='error'){
  const button=element('button','Check again','retry-button');button.type='button';button.onclick=()=>scan(result.account,example,{force:true});section.append(button);
 }else{
  const captions={idle:'Your balance will appear here.',loading:'Reading directly from NEAR…',pending:'Still unlocking. Check back after the waiting period.',unsupported:result.reason==='implementation'?'This contract version isn’t supported by FOUND yet.':'Use this account’s lockup contract to withdraw.',empty:'No unfinished withdrawals here.'};
  section.append(element('p',captions[result.state]||'','result-caption'));
 }
 if(result.state==='pending')addUnlockEstimate(section,result);
 return section;
}
function incompleteScan(result){return result.pools?.state&&result.pools.state!=='complete'||result.results.some(item=>['error','unavailable','unsupported'].includes(item.state));}
function resultPanels(result){
 const fragment=document.createDocumentFragment();
 const tiny=result.results.filter(smallBalance);
 const active=result.results.filter(row=>row.state!=='empty'&&!smallBalance(row));
 const empty=result.results.filter(row=>row.state==='empty');
 const rank={found:0,pending:1,readonly:2,unavailable:3,error:4,unsupported:5};
 active.sort((a,b)=>(rank[a.state]??5)-(rank[b.state]??5));
 if(active.length){
  const ready=active.filter(row=>row.state==='found').length;
  if(ready)fragment.append(element('p',`${ready} ${ready===1?'withdrawal':'withdrawals'} ready`,'results-summary'));
  fragment.append(...active.map(protocolResult));
 }else{
  const clear=element('div','','all-clear');clear.append(nearIcon(),element('h3',incompleteScan(result)?'A few places still to check.':tiny.length?'Only tiny balances here.':'Nothing waiting here.'),element('p',tiny.length?'Below 0.00001 NEAR each. Fees may exceed their value.':incompleteScan(result)?'The completed checks found no unfinished withdrawals.':'No unfinished withdrawals in the places checked.'));fragment.append(clear);
 }
 if(result.pools?.state!=='complete'){
  const note=element('div','','discovery-notice');
  note.append(element('p',result.pools?.state==='partial'?`Checked ${result.pools.checked} of ${result.pools.discovered} indexed validator pools. Coverage is incomplete.`:'Validator pools couldn’t be discovered. Their balances are unknown.'));
  const retry=element('button','Try again','coverage-retry');retry.type='button';retry.onclick=()=>scan(result.account,example,{force:true});note.append(retry);fragment.append(note);
 }
 if(tiny.length){
  const details=element('details','','checked-sources');details.dataset.group='tiny';details.append(element('summary',`${tiny.length} tiny ${tiny.length===1?'balance':'balances'} below 0.00001 NEAR`),element('p','Fees may exceed these balances.','result-coverage'),...tiny.map(protocolResult));fragment.append(details);
 }
 if(empty.length){
  const details=element('details','','checked-sources');details.dataset.group='empty';details.append(element('summary',`${empty.length} ${empty.length===1?'place':'places'} with nothing waiting`));
  const list=element('ul','');
  for(const row of empty){const item=element('li','');item.append(element('span',protocolInfo(row.protocol).name),element('span','0 NEAR'));list.append(item);}
  details.append(list);fragment.append(details);
 }
 const coverage=result.pools?.state==='complete'?`3 protocols · ${result.pools.checked} indexed validator ${result.pools.checked===1?'pool':'pools'}`:'3 protocols + partial pool coverage';
 fragment.append(element('p',coverage,'result-coverage'));
 return fragment;
}
function leaveWelcome(content){
 const panel=content.querySelector('.pocket-welcome');
 if(!panel||typeof panel.animate!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 // Keep the actual illustration alive above the incoming result. Freeze its exact
 // current pose so changing state cannot restart an animation halfway through.
 for(const node of panel.querySelectorAll('.welcome-wallet,.welcome-coin,.friend-sprite,.welcome-spark')){
  const style=getComputedStyle(node);
  const pose={transform:style.transform,translate:style.translate,backgroundPosition:style.backgroundPosition,boxShadow:style.boxShadow};
  node.style.animation='none';node.style.transition='none';Object.assign(node.style,pose);
 }
 panel.classList.add('welcome-leaving');panel.inert=true;panel.setAttribute('aria-hidden','true');
 panel.querySelector('#welcome-title')?.removeAttribute('id');
 $('pocket').append(panel);welcomeExit=panel;
 const fade=panel.animate([{opacity:1},{opacity:0}],{duration:560,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
 fade.finished.catch(()=>{}).finally(()=>{panel.remove();if(welcomeExit===panel)welcomeExit=null;});
}
function render(state,result,{reveal=true}={}){
 const discovery=$('discovery'),content=$('pocket-content'),account=$('checked-account'),proof=$('result-proof');
 const quietRefresh=state==='loading'?!!result.refreshing:discovery.dataset.refreshing==='true';
 const finishing=reveal&&discovery.dataset.state==='loading'&&['done','error'].includes(state)&&!quietRefresh;
 if(state==='loading'&&welcomeExit){welcomeExit.remove();welcomeExit=null;}
 if(finishing)leaveWelcome(content);
 discovery.dataset.state=state;
 discovery.dataset.refreshing=String(state==='loading'&&quietRefresh);
 $('refresh-balance').hidden=state!=='done'&&!(state==='loading'&&quietRefresh);
 $('refresh-balance').disabled=state==='loading';
 discovery.classList.toggle('just-found',finishing);
 if(state==='loading'){
  // Keep the existing illustration or explicitly labelled previous result in place.
  // Disabling the old card prevents actions against stale balances during the scan.
  if(!quietRefresh)journey('searching');$('pocket').setAttribute('aria-busy','true');content.inert=true;
  $('scan-summary').hidden=true;
  const welcome=content.querySelector('.pocket-welcome');
  if(welcome){
   const label=welcome.querySelector('.welcome-coverage');
   const name=result.account.length>28?result.account.slice(0,12)+'…'+result.account.slice(-10):result.account;
   label.textContent='Checking '+name+'…';label.title=result.account;
   const button=welcome.querySelector('button');button.textContent='Checking…';button.disabled=true;
  }else{
   $('status').textContent=quietRefresh?'Refreshing…':'Checking…';$('status').classList.remove('incomplete');
   if(!quietRefresh){proof.textContent='Checking '+result.account+'…';proof.title=result.account;}
  }
  return;
 }
 content.inert=false;discovery.dataset.view=state;proof.removeAttribute('title');
 journey(state==='idle'?'idle':state==='loading'?'searching':state==='done'?resultJourney(result):'error');
 $('pocket').setAttribute('aria-busy',String(state==='loading'));
 $('pocket').setAttribute('aria-labelledby',state==='idle'?'welcome-title':'pocket-title');
 const incomplete=state==='done'&&incompleteScan(result);
 $('status').textContent=incomplete?(result.pools?.state==='complete'&&result.results.every(r=>!['error','unavailable'].includes(r.state))?'Limited coverage':'Needs a recheck'):{idle:'Mainnet',loading:'Checking…',done:'Checked',error:'Try again'}[state];
 $('status').classList.toggle('incomplete',incomplete);
 account.textContent=state==='idle'?'Enter your account to see what’s waiting.':state==='error'?(result.code==='UNKNOWN_ACCOUNT'||/does not exist/.test(result.message)?'Account not found. Check the spelling.':'Couldn’t reach NEAR. Please try again.'):result.account+(example?' · public example':'');
 account.title=state==='error'?result.message:account.textContent;
 const summary=$('scan-summary');summary.replaceChildren();summary.hidden=!['done','error'].includes(state);
 if(!summary.hidden){const jump=element('a',state==='error'?'View details':'View results');jump.href='#pocket';summary.append(state==='error'?'Couldn’t check. ':incomplete?'Check incomplete. ':'Check complete. ',jump);}
 account.classList.toggle('check-error',state==='error');
 // Positive balances take priority; empty sources stay available in a compact disclosure.
 const rows=state==='done'?result.results:Object.keys(PROTOCOLS).map(protocol=>({protocol,state,account:result?.account||$('account').value}));
 const scroll=quietRefresh||state==='done'&&!finishing?content.scrollTop:0;
 const openGroups=[...content.querySelectorAll('details[open]')].map(el=>el.dataset.group);
 content.replaceChildren(...(state==='idle'?[welcomePanel()]:state==='done'?[resultPanels(result)]:rows.map(protocolResult)));if(!finishing)for(const group of openGroups){const node=content.querySelector(`details[data-group="${group}"]`);if(node)node.open=true;}
 content.scrollTop=scroll;content.tabIndex=state==='done'?0:-1;
 proof.replaceChildren();
 if(state!=='done'){
  proof.textContent=state==='loading'?'Checking services at the same block…':state==='error'?'Balances unknown. Nothing has moved.':'LiNEAR, Meta Pool, rNEAR and indexed validator pools.';
  return;
 }
 const link=element('a','View account');
 link.href='https://nearblocks.io/address/'+encodeURIComponent(result.account);link.append(linkIcon());link.target='_blank';link.rel='noopener noreferrer';
 const block=element('a','Block '+result.height.toLocaleString('en-US'));block.append(linkIcon());block.href='https://nearblocks.io/blocks/'+result.height;block.target='_blank';block.rel='noopener noreferrer';proof.append(link,block);
 const share=element('button','Copy link','share-result');share.type='button';share.setAttribute('aria-label','Copy a link to check this account');
 share.onclick=async()=>{try{await navigator.clipboard.writeText(accountUrl(result.account).href);share.textContent='Link copied';setTimeout(()=>{if(share.isConnected)share.textContent='Copy link';},2000);}catch{share.textContent='Link in address bar';}};
 proof.append(share);
}
function alreadyShowing(account){
 return current?.account===account&&$('discovery').dataset.state==='done'&&(!current.pools||current.pools.state==='complete')&&current.results.every(r=>!['error','unavailable'].includes(r.state));
}
function searchBusy(busy){
 const complete=!busy&&alreadyShowing(normalizeAccount($('account').value));
 $('scan-button').disabled=busy||complete;$('scan-button').dataset.complete=String(complete);$('try-example').disabled=busy;
 $('scan-button').setAttribute('aria-label',busy?'Checking your NEAR':complete?'Already checked this account':'Find my NEAR');
 $('scan-form').setAttribute('aria-busy',String(busy));
}
function clearFieldError(){
 $('form-error').hidden=true;$('account').removeAttribute('aria-invalid');
}
function fieldError(error){
 if(!error){clearFieldError();return;}
 const invalid=['INVALID','UNKNOWN_ACCOUNT'].includes(error.code);
 const message=error.code==='INVALID'?error.message:error.code==='UNKNOWN_ACCOUNT'?'Account not found on NEAR mainnet. Check the spelling.':'Couldn’t verify the account. Please try again.';
 if($('form-error').textContent!==message)$('form-error').textContent=message;
 $('form-error').hidden=false;
 if(invalid)$('account').setAttribute('aria-invalid','true');else $('account').removeAttribute('aria-invalid');
}
function checkField(account){
 // Blur and submit share a pending check; typing cancels it. Never guess an address.
 if(validation?.account===account&&!['UNAVAILABLE','AbortError'].includes(validation.error?.code||validation.error?.name))return validation;
 validation?.controller.abort();
 const check={account,controller:new AbortController(),error:null};validation=check;
 check.promise=(async()=>{
  if(!validAccount(account))return {code:'INVALID',message:account?'Enter a valid NEAR account, such as you.near.':'Enter your NEAR account.'};
  try{await rpc({request_type:'view_account',account_id:account,finality:'final'},{signal:check.controller.signal});return null;}
  catch(error){return error;}
 })().then(error=>{check.error=error;return error;});
 return check;
}
async function validateOnBlur(){
 const account=normalizeAccount($('account').value);
 if(alreadyShowing(account)){clearFieldError();return;}
 const check=checkField(account),error=await check.promise;
 if(validation===check&&normalizeAccount($('account').value)===account&&document.activeElement!==$('account')&&error?.name!=='AbortError')fieldError(error);
}
async function scan(value,isExample=false,{force=false}={}){
 const account=normalizeAccount(value);clearFieldError();$('account').value=account;
 // Repeated searches keep the currently displayed snapshot, including its block.
 // Explicit refreshes and every wallet-driven scan bypass this guard.
 if(!force&&alreadyShowing(account)){searchBusy(false);return current;}
 if(request?.account===account)return;
 const previous=current?{result:current,example}:request?.previous;
 const refreshing=current?.account===account&&$('discovery').dataset.state==='done';
 request?.abort();const controller=new AbortController();controller.account=account;controller.previous=previous;request=controller;
 searchBusy(true);
 try{
  if(!force){
   const check=checkField(account),error=await check.promise;
   if(request!==controller||check!==validation||error?.name==='AbortError')return;
   if(error){if(normalizeAccount($('account').value)===account)fieldError(error);return;}
  }
  example=isExample;current=null;render('loading',{account,refreshing});
  const result=await scanProtocols(account,{signal:controller.signal});if(request!==controller)return;current=result;render('done',result);
  const url=new URL(location.href);url.searchParams.set('account',account);history.replaceState(null,'',url);
 }catch(error){
  if(error.name!=='AbortError'&&request===controller){
   if(['INVALID','UNKNOWN_ACCOUNT'].includes(error.code)){
    current=previous?.result||null;example=previous?.example||false;
    render(current?'done':'idle',current,{reveal:false});
    if(normalizeAccount($('account').value)===account)fieldError(error);
   }else render('error',error);
  }
 }finally{if(request===controller){request=null;searchBusy(false);}}
}
$('scan-form').addEventListener('submit',e=>{e.preventDefault();$('account').blur();scan($('account').value);});
$('try-example').addEventListener('click',()=>scan('ru.near',true));
$('account').addEventListener('blur',validateOnBlur);
$('account').addEventListener('input',()=>{
 validation?.controller.abort();validation=null;clearFieldError();searchBusy(!!request);
});
$('refresh-balance').onclick=()=>{if(current)scan(current.account,example,{force:true});};
$('withdraw-dialog').addEventListener('close',()=>{if(current)journey(resultJourney(current));});
$('withdraw-dialog').querySelector('.close-dialog').onclick=()=>$('withdraw-dialog').close();
$('withdraw-dialog').addEventListener('click',e=>{if(e.target===$('withdraw-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('copy-account').onclick=async()=>{try{await navigator.clipboard.writeText(current.account);$('copy-account').textContent='Copied ✓';}catch{$('copy-account').textContent='Select to copy';}};
$('recheck').onclick=()=>{$('withdraw-dialog').close();if(current)scan(current.account,example,{force:true});};
const PAGE_SIZE=10;
let leaderboardPage=1,leaderboardLoading=false;
const leaderboardPages=new Map();
async function loadLeaderboard(page=1){
 if(leaderboardLoading)return;
 leaderboardLoading=true;$('leaderboard').setAttribute('aria-busy','true');
 $('leaderboard-error').hidden=true;
 for(const button of $('pagination').querySelectorAll('button'))button.disabled=true;
 try{
  let data=leaderboardPages.get(page);
  if(!data){
   const response=await fetch('./api/leaderboard?page='+page,{signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error('Snapshot unavailable');data=await response.json();
   if(data.version!==2||!data.complete||data.page!==page||data.pageSize!==PAGE_SIZE||!Array.isArray(data.accounts)||!data.accounts.length||data.accounts.length>PAGE_SIZE||!Number.isSafeInteger(data.totalPages))throw Error('Invalid snapshot page');
   // Do not mix pages from two different census versions after a deployment.
   const previous=leaderboardPages.values().next().value;
   if(previous&&previous.hash!==data.hash)leaderboardPages.clear();
   if(leaderboardPages.size>=20)leaderboardPages.delete(leaderboardPages.keys().next().value);
   leaderboardPages.set(page,data);
  }
  leaderboardPage=page;
  const date=new Date(data.asOf).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  $('leaderboard-count').textContent=data.counts.accountsWithWaiting.toLocaleString('en-US');
  $('leaderboard-count-label').textContent='accounts with NEAR waiting';
  $('leaderboard-total').textContent=compactNear(data.totalListedYocto);$('leaderboard-total').title=exactNear(data.totalListedYocto)+' NEAR';
  $('leaderboard-protocols').textContent=data.counts.protocols.toLocaleString('en-US');
  $('leaderboard-pools').textContent=data.counts.validatorPools.toLocaleString('en-US');
  $('snapshot-date').textContent=date+' · snapshot';
  $('leaderboard-caption').textContent=`Matured NEAR withdrawal balances across supported staking sources, ${date} snapshot`;
  $('snapshot-note').textContent='At least one matured balance above 0.01 NEAR per account. Owners may be waiting intentionally. Click an account to check what is available now.';
  $('census-details').hidden=false;
  $('census-lockup-detail').textContent=`Includes ${data.lockups.accounts} accounts ending in .lockup.near with ${formatNear(data.lockups.totalYocto,2)} NEAR. These are labelled Lockup and need their lockup contract to withdraw; FOUND cannot withdraw them directly. Other contract accounts may also need a different route.`;
  $('census-coverage-detail').textContent=`${data.counts.validatorPools} recognized validator pools from the poolv1.near and pool.near factories. ${data.counts.unsupportedPools} other contract versions and ${data.counts.closedPools} closed accounts are excluded. Pools outside these factories are not part of this census.`;
  const source=$('snapshot-source');source.href='https://nearblocks.io/blocks/'+data.block;source.firstChild.textContent=`${data.counts.accountsChecked.toLocaleString('en-US')} unique accounts checked · block ${data.block} `;
  const body=$('leaderboard'),rows=[],start=(page-1)*PAGE_SIZE;
  data.accounts.forEach((a,i)=>{
   const row=element('tr',''),rank=element('td',String(start+i+1).padStart(2,'0'),'rank'),name=element('td','');
   const short=a.account_id.length>32?a.account_id.slice(0,10)+'…'+a.account_id.slice(-8):a.account_id;
   const button=element('button',short,'account-link');button.title=a.account_id;button.setAttribute('aria-label','Check '+a.account_id+' live');button.onclick=()=>{scan(a.account_id,true);document.querySelector('.hero').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
   name.append(button);
   if(a.accountKind==='lockup'){
    const badge=element('span','Lockup','lockup-badge');badge.title='Requires the lockup contract; FOUND cannot withdraw this directly.';name.append(badge);
   }
   const labels=[],known={'linear-protocol.near':'LiNEAR','meta-pool.near':'Meta Pool','lst.rhealab.near':'rNEAR'};let pools=0;
   for(const source of a.sources){if(known[source.contract])labels.push(known[source.contract]);else pools++;}
   if(pools)labels.push(`${pools} validator ${pools===1?'pool':'pools'}`);
   const note=element('span',labels.join(' · '),'leaderboard-sources');note.title=a.sources.map(s=>s.contract).join(', ');name.append(note);
   const amount=element('td',compactNear(a.unstaked_balance),'align-right');amount.title=exactNear(a.unstaked_balance)+' NEAR';row.append(rank,name,amount);rows.push(row);
  });
  body.replaceChildren(...rows);$('pagination').hidden=false;
  const last=start+data.accounts.length,number=n=>n.toLocaleString('en-US');
  $('page-range').textContent=`${number(start+1)}${last>start+1?'–'+number(last):''} of ${number(data.counts.accountsWithWaiting)} accounts`;
  $('page-numbers').replaceChildren();
  const pages=[...new Set([1,page-1,page,page+1,data.totalPages])].filter(p=>p>=1&&p<=data.totalPages).sort((a,b)=>a-b);
  pages.forEach((number,i)=>{if(i&&number-pages[i-1]>1)$('page-numbers').append(element('span','…','page-ellipsis'));
   const button=element('button',String(number),'page-number');button.type='button';button.setAttribute('aria-label',`Page ${number}`);if(number===page){button.setAttribute('aria-current','page');button.disabled=true;}button.onclick=()=>loadLeaderboard(number);$('page-numbers').append(button);
  });
  $('previous-page').onclick=()=>loadLeaderboard(leaderboardPage-1);
  $('next-page').onclick=()=>loadLeaderboard(leaderboardPage+1);
 }catch{
  const message=$('leaderboard-error');message.replaceChildren('This page couldn’t load. ');
  const retry=element('button','Try again','share-result');retry.type='button';retry.onclick=()=>loadLeaderboard(page);message.append(retry);message.hidden=false;
  if(!leaderboardPages.size)$('pagination').hidden=true;
 }finally{
  leaderboardLoading=false;$('leaderboard').setAttribute('aria-busy','false');
  for(const button of $('pagination').querySelectorAll('button'))button.disabled=button.hasAttribute('aria-current');
  $('previous-page').disabled=leaderboardPage===1;
  $('next-page').disabled=leaderboardPage===(leaderboardPages.get(leaderboardPage)?.totalPages||1);
 }
}
walletUi=createWalletUi({current:()=>current,isExample:()=>example,scan:(account,isExample=false)=>scan(account,isExample,{force:true}),refresh:()=>{if(current&&$('discovery').dataset.state==='done')render('done',current);},accept:result=>{current=result;render('done',result);}});
render('idle');
loadLeaderboard();
const linkedAccount=new URL(location.href).searchParams.get('account');
if(linkedAccount!==null)void scan(linkedAccount);

function refreshRecoveryTotals(){return recoveryTotals().then(data=>{const node=$('recovery-totals');if(!node||!data)return;node.replaceChildren(`${formatNear(data.totalYocto)} `,nearIcon(),` NEAR brought home · ${data.accounts} ${data.accounts===1?'account':'accounts'} helped`);node.hidden=BigInt(data.totalYocto)===0n;});}
void refreshRecoveryTotals();
window.addEventListener('found:recovery-recorded',refreshRecoveryTotals);
