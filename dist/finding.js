// Text for the sampled-history finding box, built only from /api/leaderboard data.
const WALLET_CODE=['nearWalletTwoFactorMultisig','nearWalletEmptyContract'];
const number=n=>n.toLocaleString('en-US');
// The contract-code sentence, or null when the API has no usable split for this group.
// The NEAR Wallet description is shown only when every account with code is explained by those two known hashes.
export function codeSentence(dormancy){
 const split=dormancy?.contractCode;
 if(!split||split.months!==dormancy.months||split.namedAccounts!==dormancy.accounts)return null;
 const none=split.noCode?.accounts,code=split.code?.accounts,unknown=split.unknown?.accounts,hashes=split.codeHashes;
 if(![none,code,unknown].every(n=>Number.isSafeInteger(n)&&n>=0)||none+code+unknown!==split.namedAccounts||!Array.isArray(hashes))return null;
 const caveat=' No code does not prove an individual owner.';
 const wallet=unknown===0&&code>0&&hashes.every(h=>WALLET_CODE.includes(h.label))&&hashes.reduce((n,h)=>n+h.accounts,0)===code;
 if(wallet)return `${number(none)} of the ${number(split.namedAccounts)} had no contract code at the census block; the other ${number(code)} carry NEAR Wallet’s own two-factor or empty contract.`+caveat;
 if(code===0&&unknown===0)return `All ${number(split.namedAccounts)} had no contract code at the census block.`+caveat;
 return `${number(none)} of the ${number(split.namedAccounts)} had no contract code at the census block, ${number(code)} had contract code${unknown?` and ${number(unknown)} could not be read`:''}.`+caveat;
}
// The limitation sentence only raises "can be contracts" when the box does not answer it.
export function findingLimitation(dormancy){
 return `Each had at least one withdrawable balance matching at every sampled date since ${new Date(dormancy.since).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}. We checked the ${number(dormancy.cohortAccounts)} accounts with 100+ NEAR in the snapshot. Activity between samples is possible${codeSentence(dormancy)?'.':'; named accounts can be contracts.'}`;
}
