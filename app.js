const $=id=>document.getElementById(id);
const KEY="fxtrade-sandbox-v28";
const AUTH_KEY="fxtrade-sandbox-token";
const payout=.82;
let state=JSON.parse(localStorage.getItem(KEY)||"null")||{balance:1000,startBalance:1000,wins:0,losses:0,history:[],transactions:[],displayName:"FXTRADE Demo User",trigger:3};
let balance=state.balance,startBalance=state.startBalance,wins=state.wins,losses=state.losses,history=state.history,transactions=state.transactions,digits=[],price=100000,previousPrice=100000;
let selected="OVER",auto=false,autoStreak=0,scan=false,lastTrade=0;
async function api(path,options={}){const token=localStorage.getItem(AUTH_KEY);const headers={"Content-Type":"application/json",...(options.headers||{})};if(token)headers.Authorization=`Bearer ${token}`;const r=await fetch(path,{...options,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed");return data}
function setAuth(account,token){if(token)localStorage.setItem(AUTH_KEY,token);if(account){balance=Number(account.balance);transactions=account.transactions||transactions;window.fxAccount=account;render()}}
async function refreshAccount(){try{const d=await api('/api/account');setAuth(d.account)}catch(e){}}
function save(){Object.assign(state,{balance,startBalance,wins,losses,history,transactions,displayName:$('displayName')?.value||state.displayName,trigger:Number($('triggerInput')?.value||state.trigger)});localStorage.setItem(KEY,JSON.stringify(state))}
function fmt(n){return (n<0?"-":"")+"$"+Math.abs(Number(n)).toFixed(2)}
function toast(msg,bad=false){let t=document.createElement('div');t.className='toast '+(bad?'bad':'good');t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
function render(){
 const aw=$('accountWallet'), an=$('accountName'), at=$('accountTrades');
 if(aw) aw.textContent=fmt(balance); if(an) an.textContent=state.displayName||'FXTRADE Demo User'; if(at) at.textContent=history.length;
 $('balance').textContent=fmt(balance);$('walletBalance').textContent=fmt(balance);const pl=balance-startBalance;$('pl').textContent=fmt(pl);$('pl').className=pl>=0?'win':'loss';
 $('wins').textContent=wins;$('losses').textContent=losses;$('winrate').textContent=(wins+losses?((wins/(wins+losses))*100).toFixed(1):0)+'%';
 $('targetView').textContent=fmt(Number($('target').value));$('stopView').textContent='-'+fmt(Number($('stop').value)).replace('-','');$('triggerCount').textContent=state.trigger;
 renderHistory();renderTradeTable();renderTransactions();save();
}
function addDigit(d){digits.push(d);if(digits.length>60)digits.shift();$('lastDigit').textContent=d;const el=$('digits');el.innerHTML='';let counts=Array(10).fill(0);digits.forEach(x=>counts[x]++);let total=digits.length||1;for(let i=0;i<10;i++){let div=document.createElement('div');div.className='digit'+(i===d?' hot':'');div.innerHTML=`<i>${i}</i>${(counts[i]/total*100).toFixed(1)}%`;el.appendChild(div)}
 const rise=price>previousPrice, fall=price<previousPrice;
 if(selected==='OVER'&&d>Number($('barrier').value))autoStreak++;else if(selected==='UNDER'&&d<Number($('barrier').value))autoStreak++;else if(selected==='EVEN'&&d%2===0)autoStreak++;else if(selected==='ODD'&&d%2===1)autoStreak++;else if(selected==='RISE'&&rise)autoStreak++;else if(selected==='FALL'&&fall)autoStreak++;else autoStreak=0;
 if(auto&&autoStreak>=state.trigger&&Date.now()-lastTrade>1300)placeTrade(true)
}
function analyzeDeepScan(){
 const markets=['Volatility 10','Volatility 25','Volatility 50','Volatility 75','Volatility 100'];
 if(digits.length<12) return {volatility:'—',direction:'WAIT',confidence:0,strength:'Insufficient',market:'Collecting more ticks',digit:'—',reason:'Need at least 12 recent ticks.'};
 const counts=Array(10).fill(0); digits.forEach(d=>counts[d]++);
 const total=digits.length; const recent=digits.slice(-12);
 const even=recent.filter(d=>d%2===0).length/recent.length;
 const odd=1-even; const avg=recent.reduce((a,b)=>a+b,0)/recent.length;
 const high=recent.filter(d=>d>=5).length/recent.length; const low=1-high;
 const trend=recent.slice(1).reduce((a,d,i)=>a+(d>recent[i]?1:d<recent[i]?-1:0),0)/(recent.length-1);
 const topDigit=counts.indexOf(Math.max(...counts));
 const candidates=markets.map((v,i)=>{
   const volatilityBias=[.52,.56,.61,.68,.72][i];
   let direction,fit,reason;
   if(Math.abs(trend)>.18){ direction=trend>0?'RISE':'FALL'; fit=Math.abs(trend); reason=trend>0?'Strong upward tick momentum':'Strong downward tick momentum'; }
   else if(high>.62 || low>.62){ direction=high>.62?'OVER':'UNDER'; fit=Math.abs((high>.62?high:low)-.5)*2; reason=high>.62?'Recent ticks favor higher digits':'Recent ticks favor lower digits'; }
   else if(Math.abs(even-.5)>.12){ direction=even>.5?'EVEN':'ODD'; fit=Math.abs(even-.5)*2; reason=even>.5?'Even digits dominate recent ticks':'Odd digits dominate recent ticks'; }
   else { direction=topDigit>=5?'OVER':'UNDER'; fit=Math.max(.05,Math.abs(topDigit-4.5)/5); reason='Digit distribution provides the clearest available setup'; }
   const score=Math.min(.98,Math.max(.05,.45*fit+.35*volatilityBias+.20*(recent.length/20)));
   return {volatility:v,direction,score,reason};
 }).sort((a,b)=>b.score-a.score);
 const best=candidates[0]; const confidence=Math.round(best.score*100);
 const barrier=best.direction==='OVER'?Math.max(1,topDigit-1):best.direction==='UNDER'?Math.min(8,topDigit+1):null;
 const contract=barrier!==null?`${best.direction} ${barrier}`:best.direction;
 const strength=confidence>=75?'Strong':confidence>=60?'Medium':'Weak';
 return {volatility:best.volatility,direction:contract,confidence,strength,market:best.reason,digit:topDigit,reason:best.reason,action:confidence>=65?'TRADE':'WAIT'};
}
function updateAISignal(){
 const result=analyzeDeepScan();
 $('signal').textContent=result.direction;
 $('scanVolatility').textContent=result.volatility;
 $('scanConfidence').textContent=result.confidence?result.confidence+'%':'—';
 $('scanMarket').textContent=result.market;
 $('scanDigit').textContent=result.digit;
 $('strength').textContent=result.strength;
 $('scanAction').textContent='Action: '+result.action;
 if($('pattern')) $('pattern').textContent=result.reason||'Waiting for more tick data';
 return result;
}
function tick(){previousPrice=price;price+=(Math.random()-.5)*900;if(price<1000)price=1000;$('price').textContent=price.toFixed(2);addDigit(Math.floor(Math.random()*10));draw();updateAISignal()}
const canvas=$('chart'),ctx=canvas.getContext('2d'),points=[];function draw(){points.push(price);if(points.length>70)points.shift();ctx.clearRect(0,0,canvas.width,canvas.height);let min=Math.min(...points),max=Math.max(...points),range=max-min||1;ctx.beginPath();points.forEach((p,i)=>{let x=i*(canvas.width/69),y=160-((p-min)/range)*135;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#35d9aa';ctx.lineWidth=2;ctx.stroke()}
function placeTrade(fromAuto=false){let stake=Math.max(.1,Number($('stake').value));if(stake>balance){$('lastResult').textContent='Insufficient demo balance';toast('Insufficient demo balance',true);return}lastTrade=Date.now();autoStreak=0;const entryPrice=price;const entryDigit=Number($('lastDigit').textContent);balance-=stake;$('openTrade').textContent=fmt(stake);setTimeout(()=>{let d=Number($('lastDigit').textContent),win;if(selected==='OVER')win=d>Number($('barrier').value);else if(selected==='UNDER')win=d<Number($('barrier').value);else if(selected==='EVEN')win=d%2===0;else if(selected==='ODD')win=d%2===1;else if(selected==='RISE')win=price>entryPrice;else if(selected==='FALL')win=price<entryPrice;else win=false;let result=win?stake*payout:-stake;balance+=stake+result;if(win)wins++;else losses++;history.unshift({time:new Date().toLocaleTimeString(),type:selected,d,entryDigit,stake,result,market:$('market').value});$('lastResult').innerHTML=`<span class="${win?'win':'loss'}">${win?'WIN ':'LOSS '}${fmt(result)}</span>`;$('openTrade').textContent='None';render();if(balance-startBalance>=Number($('target').value)||balance-startBalance<=-Number($('stop').value)){auto=false;$('autoBadge').textContent='AUTO OFF';$('autoBtn').textContent='START DEMO AUTO'}},550)}
function renderHistory(){let h=$('history');h.innerHTML=history.length?history.slice(0,12).map(x=>`<div class="trade-row"><span>${x.time}</span><span>${x.type} • ${x.d}</span><span>${fmt(x.stake)}</span><span class="${x.result>=0?'win':'loss'}">${fmt(x.result)}</span></div>`).join(''):'<div class="empty">No trades yet. Start with a demo trade.</div>'}
function renderTradeTable(){let h=$('tradeTable');if(!history.length){h.innerHTML='<div class="empty">No trades recorded.</div>';return}h.innerHTML='<div class="table-head"><span>Time</span><span>Market / Contract</span><span>Stake</span><span>Result</span></div>'+history.map(x=>`<div class="table-row"><span>${x.time}</span><span>${x.market||'Synthetic'} • ${x.type} • digit ${x.d}</span><span>${fmt(x.stake)}</span><span class="${x.result>=0?'positive':'negative'}">${fmt(x.result)}</span></div>`).join('')}
function renderTransactions(){let h=$('transactionTable');if(!transactions.length){h.innerHTML='<div class="empty">No wallet transactions recorded.</div>';return}h.innerHTML='<div class="table-head"><span>Time</span><span>Type</span><span>Amount</span><span>Balance</span></div>'+transactions.map(x=>`<div class="table-row"><span>${x.time}</span><span>${x.type}</span><span class="${x.type==='DEPOSIT'?'positive':'negative'}">${x.type==='DEPOSIT'?'+':'-'}${fmt(x.amount)}</span><span>${fmt(x.balance)}</span></div>`).join('')}
async function walletTx(type,amount){amount=Number(amount);if(!Number.isFinite(amount)||amount<=0){toast('Enter a valid amount',true);return}try{const path=type==='DEPOSIT'?'/api/wallet/deposit-sandbox':'/api/wallet/withdraw-sandbox';const d=await api(path,{method:'POST',body:JSON.stringify({amount})});setAuth(d.account);transactions=d.account.transactions||[];render();toast(type==='DEPOSIT'?'Sandbox deposit credited':'Sandbox withdrawal recorded')}catch(e){toast(e.message,true)}}
function showSection(id){document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active-section',s.id===id));document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.section===id));window.scrollTo({top:0,behavior:'smooth'})}
$('contractTabs').onclick=e=>{if(!e.target.dataset.type)return;selected=e.target.dataset.type;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===e.target));autoStreak=0;$('tradeBtn').textContent='PLACE DEMO '+selected+' TRADE'};$('tradeBtn').onclick=()=>placeTrade(false);$('autoBtn').onclick=()=>{auto=!auto;$('autoBadge').textContent=auto?'AUTO ON':'AUTO OFF';$('autoBtn').textContent=auto?'STOP AUTO':'START AUTO';autoStreak=0};
$('scanBtn').onclick=()=>{scan=true;$('scanState').querySelector('b').textContent='Scanning volatility + market…';$('signal').textContent='ANALYZING';$('scanAction').textContent='Action: SCANNING';setTimeout(()=>{$('scanState').querySelector('b').textContent='Scan complete';const r=updateAISignal();if(r.action==='TRADE'){selected=r.direction.split(' ')[0];document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.type===selected));$('tradeBtn').textContent='PLACE DEMO '+selected+' TRADE';$('market').value=r.volatility;$('symbolTitle').textContent='Synthetic '+r.volatility;}},900)};
document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{$('stake').value=b.dataset.stake});$('target').oninput=render;$('stop').oninput=render;$('market').onchange=e=>$('symbolTitle').textContent='Synthetic '+e.target.value;
async function authAction(kind){const email=$('authEmail').value.trim(),password=$('authPassword').value;if(!email||!password){$('authMsg').textContent='Enter email and password.';return}try{const d=await api(kind==='register'?'/api/auth/register':'/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});setAuth(d.account,d.token);$('authMsg').textContent=d.notice||'Signed in successfully.';$('accountStatus').textContent='Signed in';$('accountEmail').textContent=d.account.email;$('kycStatus').textContent=d.account.kyc?.status||'Not started';toast(kind==='register'?'Sandbox account created':'Signed in')}catch(e){$('authMsg').textContent=e.message;toast(e.message,true)}}
$('registerBtn').onclick=()=>authAction('register');$('loginBtn').onclick=()=>authAction('login');$('logoutBtn').onclick=()=>{localStorage.removeItem(AUTH_KEY);window.fxAccount=null;$('accountStatus').textContent='Not signed in';$('accountEmail').textContent='—';toast('Signed out')};$('saveKycBtn').onclick=async()=>{try{const d=await api('/api/account/kyc',{method:'POST',body:JSON.stringify({name:$('kycName').value,phone:$('kycPhone').value})});setAuth(d.account);$('kycStatus').textContent=d.account.kyc.status;toast('Verification details saved')}catch(e){toast(e.message,true)}};
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>showSection(n.dataset.section));$('depositBtn').onclick=()=>walletTx('DEPOSIT',$('depositAmount').value);$('withdrawBtn').onclick=()=>walletTx('WITHDRAW',$('withdrawAmount').value);
$('clearBtn').onclick=()=>{history=[];render()};$('clearTradesPage').onclick=()=>{history=[];render();toast('Trade history cleared')};$('clearTransactions').onclick=()=>{transactions=[];render();toast('Transactions cleared')};
$('saveSettings').onclick=()=>{state.trigger=Math.max(1,Math.min(9,Number($('triggerInput').value)||3));state.displayName=$('displayName').value.trim()||'FXTRADE Demo User';save();render();toast('Settings saved')};
$('resetBtn').onclick=()=>{balance=1000;startBalance=1000;wins=losses=0;history=[];transactions=[];digits=[];price=100000;previousPrice=100000;state.trigger=3;state.displayName='FXTRADE Demo User';$('displayName').value=state.displayName;$('triggerInput').value=3;render();toast('Demo account reset')};
$('displayName').value=state.displayName;$('triggerInput').value=state.trigger;render();refreshAccount();setInterval(tick,700);


document.querySelectorAll('.account-jump').forEach(b=>b.onclick=()=>showSection(b.dataset.jump));

const connectBtn=$('connectDerivBtn'); if(connectBtn) connectBtn.onclick=()=>toast('Deriv connection requires the configured OAuth application.');
