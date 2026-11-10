import {createWalletUi} from './wallet-ui.js';
import {scanProtocols,normalizeAccount,validAccount,formatNear,exactNear,PROTOCOLS} from './rpc.js';
const $=id=>document.getElementById(id);let request=null,current=null,example=false,walletUi;
let welcomeExit=null;
function journey(state){$('discovery').dataset.journey=state;}
function resultJourney(result){
 if(result.results.some(item=>item.state==='found'))return 'found';
 if(result.results.some(item=>item.state==='error'||item.state==='unavailable'))return 'error';
 if(result.results.some(item=>item.state==='pending'||item.state==='unsupported'))return 'pending';
 return 'empty';
}
function element(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function linkIcon(){const span=document.createElement('span');span.className='icon-wrap';span.innerHTML='<svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6m0-6-9 9M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg>';return span;}
function nearIcon(){const img=document.createElement('img');img.src='./near.svg';img.alt='';img.className='near-icon';return img;}
function openWithdrawal(result){
 const protocol=PROTOCOLS[result.protocol];
 $('withdraw-account').textContent=result.account;
 $('copy-account').textContent='Copy';
 $('withdraw-description').textContent=`Withdraw from ${protocol.name} here on FOUND. The protocol sends NEAR straight to your wallet.`;
 const steps=['Connect the wallet that controls this account.','Choose Withdraw NEAR on the result card.','Approve in your wallet. FOUND checks the receipt and refreshes your balance.'];
 $('withdraw-steps').replaceChildren(...steps.map(step=>element('li',step)));
 $('withdraw-link').href=protocol.appUrl;
 $('withdraw-link').replaceChildren(`Use the official ${protocol.name} app instead`,linkIcon());
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
 panel.append(art,title,description,button,element('p','Checks LiNEAR + Meta Pool','welcome-coverage'));
 return panel;
}
function protocolResult(result){
 const protocol=PROTOCOLS[result.protocol],section=element('section','','protocol-result');
 section.dataset.result=result.state;
 const heading=element('div','','protocol-result-heading');
 const labels={idle:'Not checked',loading:'Checking…',found:'Ready to withdraw',pending:'Still unlocking',unsupported:'Lockup account',unavailable:'Availability unknown',empty:'All clear',error:'Couldn’t check'};
 heading.append(element('h3',protocol.name),element('span',labels[result.state],'result-state'));
 section.append(heading);
 const known=result.amount!==undefined;
 section.append(known?amountElement(result.amount):element('div',result.state==='error'?'Unknown':'—','balance-placeholder'));
 if(result.state==='found'){
  const actions=element('div','','withdraw-actions'),link=element('button',walletUi.actionLabel(result),'withdraw-button');
  link.type='button';link.disabled=walletUi.disabled();link.onclick=()=>walletUi.withdraw(result);
  const help=element('button','Help','withdraw-help');help.type='button';help.setAttribute('aria-label',`How to withdraw from ${protocol.name}`);help.onclick=()=>openWithdrawal(result);
  actions.append(link,help);section.append(actions);
 }else if(result.state==='unavailable'||result.state==='error'){
  const button=element('button','Check again','retry-button');button.type='button';button.onclick=()=>scan(result.account,example,{force:true});section.append(button);
 }else{
  const captions={idle:'Your balance will appear here.',loading:'Reading directly from NEAR…',pending:'Still unlocking. Check back after the waiting period.',unsupported:'Use this account’s lockup contract to withdraw.',empty:'No unfinished withdrawals here.'};
  section.append(element('p',captions[result.state]||'','result-caption'));
 }
 return section;
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
function render(state,result){
 const discovery=$('discovery'),content=$('pocket-content'),account=$('checked-account'),proof=$('result-proof');
 const quietRefresh=state==='loading'?!!result.refreshing:discovery.dataset.refreshing==='true';
 const finishing=discovery.dataset.state==='loading'&&['done','error'].includes(state)&&!quietRefresh;
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
 const incomplete=state==='done'&&result.results.some(item=>item.state==='error'||item.state==='unavailable');
 $('status').textContent=incomplete?'Needs a recheck':{idle:'Mainnet',loading:'Checking…',done:'Checked',error:'Try again'}[state];
 $('status').classList.toggle('incomplete',incomplete);
 account.textContent=state==='idle'?'Enter your account to see what’s waiting.':state==='error'?(result.code==='UNKNOWN_ACCOUNT'||/does not exist/.test(result.message)?'Account not found. Check the spelling.':'Couldn’t reach NEAR. Please try again.'):result.account+(example?' · public example':'');
 account.title=state==='error'?result.message:account.textContent;
 const summary=$('scan-summary');summary.replaceChildren();summary.hidden=!['done','error'].includes(state);
 if(!summary.hidden){const jump=element('a',state==='error'?'View details':'View results');jump.href='#pocket';summary.append(state==='error'?'Couldn’t check. ':incomplete?'Check incomplete. ':'Check complete. ',jump);}
 account.classList.toggle('check-error',state==='error');
 // Both services keep their place throughout a lookup, including partial failures.
 const rows=state==='done'?result.results:Object.keys(PROTOCOLS).map(protocol=>({protocol,state,account:result?.account||$('account').value}));
 content.replaceChildren(...(state==='idle'?[welcomePanel()]:rows.map(protocolResult)));
 proof.replaceChildren();
 if(state!=='done'){
  proof.textContent=state==='loading'?'Checking both services at the same block…':state==='error'?'Balances unknown. Nothing has moved.':'LiNEAR and Meta Pool only.';
  return;
 }
 const link=element('a','View account');
 link.href='https://nearblocks.io/address/'+encodeURIComponent(result.account);link.append(linkIcon());link.target='_blank';link.rel='noopener noreferrer';
 const block=element('a','Block '+result.height.toLocaleString('en-US'));block.append(linkIcon());block.href='https://nearblocks.io/blocks/'+result.height;block.target='_blank';block.rel='noopener noreferrer';proof.append(link,block);
}
function alreadyShowing(account){
 return current?.account===account&&$('discovery').dataset.state==='done'&&current.results.every(result=>!['error','unavailable'].includes(result.state));
}
function searchBusy(busy){
 const complete=!busy&&alreadyShowing(normalizeAccount($('account').value));
 $('scan-button').disabled=busy||complete;$('scan-button').dataset.complete=String(complete);$('try-example').disabled=busy;
 $('scan-button').setAttribute('aria-label',busy?'Checking your NEAR':complete?'Already checked this account':'Find my NEAR');
 $('scan-form').setAttribute('aria-busy',String(busy));
}
async function scan(value,isExample=false,{force=false}={}){
 const account=normalizeAccount(value);$('form-error').hidden=true;
 if(!validAccount(account)){$('form-error').textContent='Enter a NEAR account such as you.near or an implicit account ID.';$('form-error').hidden=false;$('account').setAttribute('aria-invalid','true');$('account').focus();return;}
 $('account').removeAttribute('aria-invalid');$('account').value=account;
 // Repeated searches keep the currently displayed snapshot, including its block.
 // Explicit refreshes and every wallet-driven scan bypass this guard.
 if(!force&&alreadyShowing(account)){searchBusy(false);return current;}
 if(request?.account===account&&$('discovery').dataset.state==='loading')return;
 const refreshing=current?.account===account&&$('discovery').dataset.state==='done';
 request?.abort();const controller=new AbortController();controller.account=account;request=controller;example=isExample;current=null;
 searchBusy(true);render('loading',{account,refreshing});
 try{const result=await scanProtocols(account,{signal:controller.signal});if(request!==controller)return;current=result;render('done',result);}
 catch(error){if(error.name!=='AbortError'&&request===controller)render('error',error);}
 finally{if(request===controller){request=null;searchBusy(false);}}
}
$('scan-form').addEventListener('submit',e=>{e.preventDefault();scan($('account').value);});
$('try-example').addEventListener('click',()=>scan('ru.near',true));
$('account').addEventListener('input',()=>searchBusy($('discovery').dataset.state==='loading'));
$('refresh-balance').onclick=()=>{if(current)scan(current.account,example,{force:true});};
$('withdraw-dialog').addEventListener('close',()=>{if(current)journey(resultJourney(current));});
$('withdraw-dialog').querySelector('.close-dialog').onclick=()=>$('withdraw-dialog').close();
$('withdraw-dialog').addEventListener('click',e=>{if(e.target===$('withdraw-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('copy-account').onclick=async()=>{try{await navigator.clipboard.writeText(current.account);$('copy-account').textContent='Copied ✓';}catch{$('copy-account').textContent='Select to copy';}};
$('recheck').onclick=()=>{$('withdraw-dialog').close();if(current)scan(current.account,example,{force:true});};
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
walletUi=createWalletUi({current:()=>current,isExample:()=>example,scan:(account,isExample=false)=>scan(account,isExample,{force:true}),refresh:()=>{if(current&&$('discovery').dataset.state==='done')render('done',current);},accept:result=>{current=result;render('done',result);}});
render('idle');
loadLeaderboard();
