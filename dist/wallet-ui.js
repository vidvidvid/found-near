import {PROTOCOLS,validAccount} from './rpc.js';
import {NETWORK,prepareWithdrawal,checkWithdrawal,validPending,validHash} from './withdrawal.js';
const SESSION_PREFIX='found:wallet:',PENDING_KEY='found:pending-withdrawal:v1';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node;};
const cancelled=error=>error?.code===4001||/user (rejected|denied)|cancelled|canceled/i.test(error?.message||'');
export function createWalletUi(hooks){
 let connectorPromise,wallet=null,accounts=[],revision=0,busy=false,workingLabel='',pending=null,checking=null;
 const owns=account=>accounts.some(a=>a.accountId===account);
 const accountName=()=>accounts[0]?.accountId;
 function savePending(value){
  // Persist the unsigned intent before opening a wallet. If storage is unavailable,
  // stop before signing; once signed, retain the hash in memory even if storage fails.
  if(value&&!value.hash){
   try{localStorage.setItem(PENDING_KEY,JSON.stringify(value));}catch{throw Error('Browser storage is unavailable. Enable it before withdrawing.');}
   pending=value;return;
  }
  pending=value;
  try{if(value)localStorage.setItem(PENDING_KEY,JSON.stringify(value));else localStorage.removeItem(PENDING_KEY);}catch{}
 }

 function notice(text,{hash,account,retry=false,clear=false}={}){
  $('wallet-notice').hidden=false;$('wallet-notice-text').textContent=text;
  const link=$('wallet-notice-link');link.hidden=!hash&&!account;
  if(hash){link.href='https://nearblocks.io/txns/'+encodeURIComponent(hash);link.textContent='View transaction';}
  else if(account){link.href='https://nearblocks.io/address/'+encodeURIComponent(account);link.textContent='View wallet activity';}
  $('wallet-retry').hidden=!retry;$('wallet-retry').textContent=hash?'Check confirmation':'Refresh balances';
  $('wallet-clear-request').hidden=!clear;
 }
 function update(){
  const button=$('wallet-connect'),name=accountName();
  button.textContent=busy&&!wallet?'Connecting…':name?(name.length>21?name.slice(0,10)+'…'+name.slice(-7):name):'Connect wallet';
  button.title=name||'Connect a NEAR wallet';button.disabled=busy;button.dataset.connected=String(!!name);
  hooks.refresh();
 }
 function work(value,label=''){busy=value;workingLabel=label;update();}
 function setWallet(value,list){wallet=value;accounts=Array.isArray(list)?list.filter(a=>validAccount(a.accountId||'')):[];revision++;update();}
 async function connector(){
  if(!connectorPromise)connectorPromise=import('./near-connector.js').then(({NearConnector})=>{
   const c=new NearConnector({network:NETWORK,autoConnect:false,features:{mainnet:true,signInWithoutAddKey:true,signAndSendTransaction:true},storage:{get:async key=>localStorage.getItem(SESSION_PREFIX+key),set:async(key,value)=>localStorage.setItem(SESSION_PREFIX+key,value),remove:async key=>localStorage.removeItem(SESSION_PREFIX+key)}});
   c.on('wallet:signIn',({wallet:next,accounts:list,success})=>{if(success)setWallet(next,list);});
   c.on('wallet:signOut',()=>setWallet(null,[]));return c;
  }).catch(error=>{connectorPromise=null;throw error;});
  return connectorPromise;
 }
 async function connect(){
  work(true,'Connecting…');
  try{const c=await connector(),selected=await c.connect();setWallet(selected,await selected.getAccounts({network:NETWORK}));if(!accountName())throw Error('No mainnet account was returned by the wallet.');return selected;}
  catch(error){if(!cancelled(error))notice('Couldn’t connect your wallet. Please try again.');return null;}
  finally{work(false);}
 }
 async function showMine(){
  if(!wallet&&!await connect())return;
  if(accountName())await hooks.scan(accountName(),false);
 }
 function accountMenu(){
  const list=$('wallet-accounts');list.replaceChildren();
  for(const account of accounts){const button=el('button',account.accountId,'wallet-account-choice');button.type='button';button.onclick=()=>{$('wallet-dialog').close();hooks.scan(account.accountId,false);};list.append(button);}
  $('wallet-dialog').showModal();
 }
 function actionLabel(result){
  if(busy)return workingLabel||'Please wait…';
  if(pending?.account===result.account&&pending.protocol===result.protocol)return pending.hash?'Check transaction':'Check wallet activity';
  if(pending)return 'Withdrawal pending';
  if(owns(result.account))return 'Withdraw NEAR';
  return wallet||hooks.isExample()?'Check my wallet':'Connect to withdraw';
 }
 async function confirmPending(){
  if(checking)return checking;
  if(!pending)return;
  if(!pending.hash){notice('The wallet hasn’t returned a receipt. Check its activity before trying again.',{account:pending.account,retry:true,clear:true});return;}
  const item=pending;
  checking=(async()=>{
   work(true,'Confirming…');notice('Confirming your withdrawal on NEAR…',{hash:item.hash});
   try{
    for(let attempt=0;attempt<4;attempt++){
     let result;try{result=await checkWithdrawal(item);}catch{}
     if(result?.state==='confirmed'||result?.state==='failed'){
      savePending(null);
      notice(result.state==='confirmed'?'Withdrawal confirmed. Your NEAR is back in '+item.account+'.':'The withdrawal did not complete. Check the transaction for details.',{hash:item.hash});
      if(!hooks.current()||hooks.current().account===item.account)await hooks.scan(item.account,false);
      return;
     }
     if(attempt<3)await new Promise(resolve=>setTimeout(resolve,1800));
    }
    notice('Still waiting for confirmation. Check this transaction before submitting another.',{hash:item.hash,retry:true});
   }finally{work(false);checking=null;}
  })();
  return checking;
 }
 async function withdraw(result){
  if(busy)return;
  if(pending){await confirmPending();return;}
  if(!wallet){
   if(!await connect())return;
   // Connecting is not payment approval. Show the owner's fresh balance first.
   await hooks.scan(owns(result.account)?result.account:accountName(),false);return;
  }
  if(!owns(result.account)){await showMine();return;}
  const signingWallet=wallet,connectionRevision=revision;
  let signingStarted=false;
  work(true,'Checking balance…');
  try{
   const {fresh,transaction}=await prepareWithdrawal(result,{getAccounts:options=>signingWallet.getAccounts(options)});
   if(wallet!==signingWallet||revision!==connectionRevision)throw Error('Your wallet connection changed. Please try again.');
   if(hooks.current()?.account===result.account)hooks.accept(fresh);
   const item={network:NETWORK,account:result.account,protocol:result.protocol,amount:result.amount,hash:null,createdAt:Date.now()};
   // Store the intent before opening the wallet so reloads cannot silently resubmit it.
   savePending(item);work(true,'Approve in wallet…');
   notice('Approve the withdrawal in your wallet. Network fees are shown there.');
   signingStarted=true;
   const outcome=await signingWallet.signAndSendTransaction(transaction);
   const hash=outcome?.transaction?.hash;
   if(!validHash(hash))throw Error('The wallet did not return a transaction hash.');
   savePending({...item,hash});work(false);
   await confirmPending();
  }catch(error){
   if(error.fresh&&hooks.current()?.account===result.account)hooks.accept(error.fresh);
   if(!signingStarted){if(pending)savePending(null);notice(error.message||'Couldn’t prepare this withdrawal. Please check again.');}
   else if(cancelled(error)){savePending(null);notice('Withdrawal cancelled in your wallet.');}
   else if(pending){notice('The wallet didn’t return a confirmed receipt. Check its activity before trying again.',{hash:pending.hash,account:pending.account,retry:true,clear:!pending.hash});}
   else notice('Couldn’t confirm this withdrawal. Check your wallet activity.');
  }finally{work(false);}
 }
 $('wallet-connect').onclick=()=>wallet?accountMenu():showMine();
 $('wallet-dialog').querySelector('.close-dialog').onclick=()=>$('wallet-dialog').close();
 $('wallet-disconnect').onclick=async()=>{try{const c=await connector();await c.disconnect(wallet);$('wallet-dialog').close();setWallet(null,[]);}catch{notice('Couldn’t disconnect. Please try again.');}};
 $('wallet-notice-close').onclick=()=>$('wallet-notice').hidden=true;
 $('wallet-retry').onclick=()=>pending?.hash?confirmPending():pending&&hooks.scan(pending.account,false);
 $('wallet-clear-request').onclick=()=>{savePending(null);$('wallet-notice').hidden=true;update();};
 try{const stored=JSON.parse(localStorage.getItem(PENDING_KEY)||'null');if(validPending(stored))pending=stored;}catch{}
 // Restore only an existing connection. A fresh visit never opens a wallet prompt.
 try{if(localStorage.getItem(SESSION_PREFIX+'selected-wallet'))connector().then(c=>c.getConnectedWallet()).then(({wallet,accounts})=>setWallet(wallet,accounts)).catch(()=>{});}catch{}
 if(pending)queueMicrotask(()=>confirmPending());
 return {withdraw,actionLabel,disabled:()=>busy||!!pending&&!!checking,owns};
}
