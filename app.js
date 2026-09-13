(() => {
'use strict';
const $ = id => document.getElementById(id);

const state = {
  ws:null, publicSocket:null, reconnect:null, symbol:'1HZ100V',
  prices:[], digits:Array(10).fill(0), stake:1, stopLoss:999,
  targetProfit:3, sessionNet:0, tradingLocked:false,
  contract:'MATCHDIFF', accountType:'demo', balance:10000,
  currency:'USD', authenticated:false, accountId:null,
  waitingForProposal:null, proposalReqId:0, buyReqId:0, contractReqId:0,
  wins:0, losses:0, manual:false, multiplier:2, userStopped:false, autoRunning:false, autoSide:null, autoTimer:null, signalQuality:0, signalReady:false
};

const DERIV_CLIENT_ID='34m6kBZ1JQGXBHSscpXXQ';
const DERIV_API='https://api.derivws.com';
const PUBLIC_WS='wss://api.derivws.com/trading/v1/options/ws/public';
const REDIRECT_URI=window.location.origin+'/';
const auth={token:sessionStorage.getItem('deriv_access_token')||null};

const ui={
  price:$('price'), digitGrid:$('digitGrid'), balance:$('balance'),
  direction:$('direction'), confidence:$('confidence'), connection:$('connection'),
  payout:$('payout'), stake:$('stake'), connect:$('connectDeriv'),
  accountType:$('accountType'), accountLabel:$('accountLabel'),
  leftLabel:$('leftTradeLabel'), rightLabel:$('rightTradeLabel'),
  leftRule:$('leftRule'), rightRule:$('rightRule'),
  wins:$('wins'), losses:$('losses'), sessionNet:$('sessionNet'),
  signalText:$('signalText'), riskStatus:$('riskStatus'), chart:$('chart')
};

const fallback=[
 ['1HZ5V','Vol 5 (1s)'],['1HZ10V','Vol 10 (1s)'],['1HZ15V','Vol 15 (1s)'],
 ['1HZ25V','Vol 25 (1s)'],['1HZ30V','Vol 30 (1s)'],['1HZ50V','Vol 50 (1s)'],
 ['1HZ75V','Vol 75 (1s)'],['1HZ90V','Vol 90 (1s)'],['1HZ100V','Vol 100 (1s)'],
 ['1HZ150V','Vol 150 (1s)'],['1HZ250V','Vol 250 (1s)'],
 ['R_10','Volatility 10'],['R_25','Volatility 25'],['R_50','Volatility 50'],
 ['R_75','Volatility 75'],['R_100','Volatility 100']
];

function toast(t){const e=$('toast');if(!e)return;e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function lastDigit(n){const s=String(n);const m=s.replace(/\D/g,'');return m?Number(m.at(-1)):null}
function setConnection(text,ok=false){ui.connection.innerHTML='<i></i>'+text;ui.connection.style.color=ok?'#2ce795':'#ffc857'}
function readRisk(){state.stopLoss=Math.max(0,Number($('stopLoss').value)||0);state.targetProfit=Math.max(0,Number($('targetProfit').value)||0);state.multiplier=Math.max(1,Number($('multiplier').value)||1)}
function updateStopButton(){
  const b=$('stopTrade');
  if(!b)return;
  b.textContent=state.userStopped?'▶ START':'■ STOP';
  b.classList.toggle('stopped',state.userStopped);
}
function riskUpdate(){
  readRisk();
  if(state.stopLoss>0&&state.sessionNet<=-state.stopLoss)state.tradingLocked=true;
  if(state.targetProfit>0&&state.sessionNet>=state.targetProfit)state.tradingLocked=true;
  if(state.userStopped)state.tradingLocked=true;
  ui.riskStatus.textContent=state.userStopped?'Trading stopped manually':(state.tradingLocked?'Trading paused':'Risk limits active');
  updateStopButton();
  ui.sessionNet.textContent=(state.sessionNet>=0?'+$':'-$')+Math.abs(state.sessionNet).toFixed(2);
}
function mostEven(){let e=0,o=0;for(let i=0;i<10;i++){if(i%2)o+=state.digits[i];else e+=state.digits[i]}return e>=o}
function strongestDigit(){let best=0;for(let i=1;i<10;i++)if(state.digits[i]>state.digits[best])best=i;return best}

function signalFilter(info){
  const p=state.prices.slice(-30);
  if(p.length<12)return{ready:false,score:0,reason:'Collecting more market data…'};
  const total=state.digits.reduce((a,b)=>a+b,0)||1;
  const even=state.digits.reduce((a,b,i)=>a+(i%2===0?b:0),0)/total*100;
  const odd=100-even;
  let score=50;
  const delta=Number(p.at(-1))-Number(p[0]);
  const h=Math.floor(p.length/2);
  const av1=p.slice(0,h).reduce((a,b)=>a+b,0)/h;
  const av2=p.slice(h).reduce((a,b)=>a+b,0)/(p.length-h);
  if((delta>0&&av2>=av1)||(delta<0&&av2<=av1))score+=12;
  if(state.contract==='EVENODD'){
    const edge=mostEven()?even:odd;
    score+=edge>=54?10:-10;
  }else if(state.contract==='MATCHDIFF'){
    const hi=info?.hi??strongestDigit();
    const edge=state.digits[hi]/total*100;
    score+=edge>=14?8:-5;
  }else{
    score+=Math.min(10,Math.abs(delta/Math.max(Math.abs(p[0]),1))*100000*1.5);
  }
  const recent=p.slice(-8).map(lastDigit).filter(Number.isInteger);
  if(state.contract==='EVENODD'&&recent.length>=6){
    const same=recent.filter(d=>d%2===recent.at(-1)%2).length/recent.length;
    if(same>=0.75)score-=8;
  }
  score=Math.max(0,Math.min(100,Math.round(score)));
  return{ready:score>=70,score,reason:score>=70?'Multiple filters agree.':'Filters do not agree strongly enough.'};
}

function drawChart(){
  const c=ui.chart,ctx=c.getContext('2d'),r=c.getBoundingClientRect(),d=devicePixelRatio||1;
  c.width=r.width*d;c.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,r.width,r.height);
  const p=state.prices.slice(-55);if(p.length<2)return;
  const min=Math.min(...p),max=Math.max(...p),span=max-min||1;
  ctx.beginPath();
  p.forEach((v,i)=>{const x=i*(r.width/(p.length-1)),y=r.height-12-((v-min)/span)*(r.height-28);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
  ctx.strokeStyle='#f4f0ff';ctx.lineWidth=3;ctx.stroke();
}

function updateDigits(){
  const total=state.digits.reduce((a,b)=>a+b,0);if(!total)return;
  const probs=state.digits.map(n=>n/total*100),hi=probs.indexOf(Math.max(...probs));
  const current=state.prices.length?lastDigit(state.prices.at(-1)):null;
  ui.digitGrid.innerHTML=probs.map((v,i)=>`<div class="digit ${i===hi?'high':''}"><b>${i}</b><small>${v.toFixed(1)}%</small></div>`).join('');
  if(Number.isInteger(current)){const cursor=document.createElement('div');cursor.className='digit-cursor';cursor.style.left=((current+.5)*10)+'%';ui.digitGrid.appendChild(cursor)}
  return {probs,hi,current};
}

function analyze(){
  if(state.prices.length<8)return;
  const p=state.prices.slice(-30),a=p[0],b=p.at(-1),delta=b-a,half=Math.floor(p.length/2);
  const av1=p.slice(0,half).reduce((s,v)=>s+v,0)/half;
  const av2=p.slice(half).reduce((s,v)=>s+v,0)/(p.length-half);
  const bull=delta>0&&av2>=av1,bear=delta<0&&av2<=av1;
  const info=updateDigits()||{probs:Array(10).fill(10),hi:0,current:lastDigit(b)};
  let dir='WAIT',text='Waiting for live market data.';
  if(state.contract==='OVERUNDER')dir=bull?'OVER':bear?'UNDER':'WAIT';
  else if(state.contract==='RISEFALL')dir=bull?'RISE':bear?'FALL':'WAIT';
  else if(state.contract==='EVENODD')dir=mostEven()?'EVEN':'ODD';
  else {const target=info.hi;dir=info.current===target?'MATCH':'DIFFER'}
  const baseConf=55+Math.min(40,Math.abs(delta/Math.max(a,1))*100000*6);
  const filtered=signalFilter(info);state.signalQuality=filtered.score;state.signalReady=filtered.ready;
  const conf=filtered.ready?Math.max(55,Math.min(95,Math.round(baseConf))):Math.min(69,Math.max(50,Math.round(50+filtered.score/5)));
  ui.direction.textContent=dir;ui.confidence.textContent=conf+'%';
  text=dir==='WAIT'?'No strong direction yet.':`Live ${state.contract==='MATCHDIFF'?'digit': 'market'} signal: ${dir}.`;
  ui.signalText.textContent=filtered.ready?text+' Filter: STRONG.':text+' Filter: WAIT — '+filtered.reason;
  drawChart();
}

function onTick(t){
  const q=Number(t.quote);if(!Number.isFinite(q))return;
  state.prices.push(q);if(state.prices.length>120)state.prices.shift();
  const d=lastDigit(q);if(d!==null)state.digits[d]++;
  ui.price.textContent=fmt(q);analyze();
}

function subscribePublic(ws){
  ws.send(JSON.stringify({active_symbols:'brief',product_type:'basic',req_id:1}));
  ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));
  ws.send(JSON.stringify({ticks_history:state.symbol,count:80,end:'latest',style:'ticks',req_id:3}));
}
function connectPublic(){
  try{state.publicSocket?.close()}catch{}
  setConnection('CONNECTING…');const ws=new WebSocket(PUBLIC_WS);state.publicSocket=ws;let opened=false;
  ws.onopen=()=>{opened=true;setConnection('LIVE',true);subscribePublic(ws)};
  ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.msg_type==='tick'&&d.tick)onTick(d.tick);if(d.msg_type==='history'&&d.history?.prices){state.prices=d.history.prices.map(Number).filter(Number.isFinite).slice(-120);state.digits=Array(10).fill(0);state.prices.forEach(v=>{const z=lastDigit(v);if(z!==null)state.digits[z]++});analyze()}if(d.msg_type==='active_symbols'&&Array.isArray(d.active_symbols))populateMarkets(d.active_symbols)}catch{}};
  ws.onerror=()=>{if(!opened)setConnection('CONNECTION ERROR')};
  ws.onclose=()=>{setConnection('RECONNECTING…');clearTimeout(state.reconnect);state.reconnect=setTimeout(connectPublic,3000)};
}
function populateMarkets(items){
  const merged=new Map(fallback.map(x=>[x[0],x[1]]));
  (items||[]).forEach(x=>{
    const n=x.display_name||x.underlying_symbol_name||'';
    const sym=x.symbol||x.underlying_symbol;
    if(sym&&/Volatility/i.test(n))merged.set(sym,n);
  });
  const sel=$('market');const cur=state.symbol;sel.innerHTML=[...merged].map(([v,n])=>`<option value="${v}">${n}</option>`).join('');sel.value=merged.has(cur)?cur:state.symbol;
}

function base64Url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sha256(text){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return base64Url(new Uint8Array(h))}
function randomString(n=64){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a,v=>chars[v%chars.length]).join('')}
async function startOAuth(){
  const verifier=randomString(),stateVal=randomString(32);sessionStorage.setItem('pkce_code_verifier',verifier);sessionStorage.setItem('oauth_state',stateVal);
  const u=new URL('https://auth.deriv.com/oauth2/auth');u.searchParams.set('response_type','code');u.searchParams.set('client_id',DERIV_CLIENT_ID);u.searchParams.set('redirect_uri',REDIRECT_URI);u.searchParams.set('scope','trade');u.searchParams.set('state',stateVal);u.searchParams.set('code_challenge',await sha256(verifier));u.searchParams.set('code_challenge_method','S256');location.href=u;
}
async function finishOAuth(){
  const q=new URLSearchParams(location.search),code=q.get('code'),returned=q.get('state');if(!code)return;
  if(returned!==sessionStorage.getItem('oauth_state')){toast('Deriv login verification failed.');return}
  try{
    const r=await fetch('/api/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:sessionStorage.getItem('pkce_code_verifier'),redirect_uri:REDIRECT_URI,client_id:DERIV_CLIENT_ID})});
    const d=await r.json();if(!r.ok||!d.access_token)throw new Error(d.error||'Token exchange failed');
    auth.token=d.access_token;sessionStorage.setItem('deriv_access_token',auth.token);sessionStorage.removeItem('pkce_code_verifier');sessionStorage.removeItem('oauth_state');history.replaceState({},'',location.pathname);await loadAccounts();
  }catch(e){console.error(e);toast('Deriv connection failed.')}
}
function savedAccounts(){try{return JSON.parse(sessionStorage.getItem('deriv_accounts')||'{}')}catch{return{}}}
function selectedAccount(){return savedAccounts()[state.accountType]||null}
async function loadAccounts(){
  if(!auth.token)return;
  try{
    const r=await fetch(DERIV_API+'/trading/v1/options/accounts',{headers:{Authorization:'Bearer '+auth.token}});
    const d=await r.json();if(!r.ok)throw new Error(d?.errors?.[0]?.message||'Account lookup failed');
    const raw=Array.isArray(d.data)?d.data:(Array.isArray(d.data?.accounts)?d.data.accounts:[]);
    const demo=raw.find(a=>String(a.account_type||a.type||'').toLowerCase()==='demo'),real=raw.find(a=>String(a.account_type||a.type||'').toLowerCase()==='real');
    sessionStorage.setItem('deriv_accounts',JSON.stringify({demo:demo||null,real:real||null}));
    await connectSelectedAccount();
  }catch(e){console.error(e);toast(e.message||'Could not load Deriv accounts.')}
}
async function connectSelectedAccount(){
  const a=selectedAccount();if(!auth.token||!a){toast('No '+state.accountType+' Options account available.');return}
  state.accountId=a.account_id;state.currency=a.currency||'USD';
  try{
    const r=await fetch(DERIV_API+'/trading/v1/options/accounts/'+encodeURIComponent(state.accountId)+'/otp',{method:'POST',headers:{Authorization:'Bearer '+auth.token}});
    const d=await r.json();if(!r.ok||!d.data?.url)throw new Error(d?.errors?.[0]?.message||'Could not create Deriv session');
    const ws=new WebSocket(d.data.url);state.ws=ws;
    ws.onopen=()=>{state.authenticated=true;ui.connect.textContent='Deriv Connected';ui.connect.classList.add('connected');ui.accountLabel.textContent=state.accountType==='real'?'Real Account':'Demo Account';setConnection('DERIV '+state.accountType.toUpperCase(),true);ws.send(JSON.stringify({balance:1,subscribe:1,req_id:500}));ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:501}))};
    ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.error){if(d.req_id===state.proposalReqId||d.req_id===state.buyReqId)state.waitingForProposal=null;toast(d.error.message||'Deriv request failed.');return}if(d.msg_type==='balance'&&d.balance){state.balance=Number(d.balance.balance);ui.balance.textContent='$'+state.balance.toFixed(2)}if(d.msg_type==='tick'&&d.tick)onTick(d.tick);if(d.msg_type==='proposal'&&d.req_id===state.proposalReqId)handleProposal(d);if(d.msg_type==='buy'&&d.req_id===state.buyReqId)handleBuy(d);if(d.msg_type==='proposal_open_contract'&&d.req_id===state.contractReqId)handleContractUpdate(d)}catch{}};
    ws.onerror=()=>setConnection('DERIV ERROR');ws.onclose=()=>{state.authenticated=false;ui.connect.textContent='Connect Deriv';ui.connect.classList.remove('connected');setConnection('DISCONNECTED')};
  }catch(e){toast(e.message||'Deriv connection failed.')}
}
function contractRequest(side){
  if(state.contract==='MATCHDIFF'){const barrier=String(lastDigit(state.prices.at(-1))??strongestDigit());return{contract_type:side==='left'?'DIGITMATCH':'DIGITDIFF',barrier}}
  if(state.contract==='EVENODD')return{contract_type:side==='left'?'DIGITEVEN':'DIGITODD'}
  if(state.contract==='OVERUNDER')return{contract_type:side==='left'?'DIGITOVER':'DIGITUNDER',barrier:side==='left'?'3':'4'}
  return{contract_type:side==='left'?'CALL':'PUT'}
}
function placeTrade(side, fromAuto=false){
  readRisk();riskUpdate();if(state.tradingLocked)return;
  if(!state.signalReady){
    if(fromAuto){clearTimeout(state.autoTimer);state.autoTimer=setTimeout(()=>placeTrade(side,true),1200);return;}
    toast('Signal filter says WAIT — no trade placed.');return;
  }
  if(!auth.token||!state.ws||!state.authenticated){toast('Connect Deriv before trading.');return}
  if(state.waitingForProposal){toast('Please wait for the previous trade request.');return}
  const account=selectedAccount();if(!account){toast('Selected Deriv account is unavailable.');return}
  const c=contractRequest(side),stake=Number(state.stake);if(!stake||stake<=0)return;
  state.proposalReqId++;state.waitingForProposal={side,stake,symbol:state.symbol,contractType:c.contract_type};
  const req={proposal:1,amount:stake,basis:'stake',contract_type:c.contract_type,currency:state.currency,duration:1,duration_unit:'t',underlying_symbol:state.symbol,req_id:state.proposalReqId};if(c.barrier!==undefined)req.barrier=c.barrier;state.ws.send(JSON.stringify(req));
  document.querySelectorAll('.trade').forEach(b=>b.classList.remove('selected'));$(side==='left'?'over':'under').classList.add('selected');
}
function handleProposal(d){const p=d.proposal,t=state.waitingForProposal;if(!p||!t)return;const ask=Number(p.ask_price);if(!p.id||!Number.isFinite(ask)){state.waitingForProposal=null;toast('Invalid Deriv proposal.');return}ui.payout.textContent='$'+Number(p.payout??ask*1.96).toFixed(2);state.buyReqId++;state.ws.send(JSON.stringify({buy:String(p.id),price:ask,req_id:state.buyReqId}))}
function handleBuy(d){const t=state.waitingForProposal;if(!t||!d.buy?.contract_id){state.waitingForProposal=null;return}state.ws.send(JSON.stringify({proposal_open_contract:1,contract_id:d.buy.contract_id,subscribe:1,req_id:++state.contractReqId}));ui.payout.textContent='$'+Number(d.buy.payout||0).toFixed(2);toast((state.accountType==='real'?'REAL ':'DEMO ')+'trade placed.');state.waitingForProposal={...t,contractId:d.buy.contract_id}}
function handleContractUpdate(d){
  const c=d.proposal_open_contract;if(!c||!state.waitingForProposal)return;
  const closed=c.is_sold===1||c.status==='sold'||c.status==='expired';if(!closed)return;
  const profit=Number(c.profit||0);state.sessionNet+=Number.isFinite(profit)?profit:0;
  if(profit>0)state.wins++;else state.losses++;ui.wins.textContent=state.wins+' W';ui.losses.textContent=state.losses+' L';state.waitingForProposal=null;riskUpdate();
  toast(profit>0?'WIN +$'+profit.toFixed(2):'LOSS -$'+Math.abs(profit).toFixed(2));
  if(state.autoRunning && !state.tradingLocked && state.autoSide){
    clearTimeout(state.autoTimer);
    state.autoTimer=setTimeout(()=>placeTrade(state.autoSide,true),900);
  }
}

function setStake(v){state.stake=Math.max(1,Math.min(100,Number(v)||1));ui.stake.textContent=state.stake;ui.payout.textContent='$'+(state.stake*1.96).toFixed(2)}
function updateLabels(){
  if(state.contract==='MATCHDIFF'){ui.leftLabel.textContent='MATCH';ui.rightLabel.textContent='DIFFER';ui.leftRule.textContent='Current digit';ui.rightRule.textContent='Other digits'}
  else if(state.contract==='EVENODD'){ui.leftLabel.textContent='EVEN';ui.rightLabel.textContent='ODD';ui.leftRule.textContent='0, 2, 4, 6, 8';ui.rightRule.textContent='1, 3, 5, 7, 9'}
  else if(state.contract==='OVERUNDER'){ui.leftLabel.textContent='OVER';ui.rightLabel.textContent='UNDER';ui.leftRule.textContent='Digits 4 - 9';ui.rightRule.textContent='Digits 0 - 3'}
  else{ui.leftLabel.textContent='RISE';ui.rightLabel.textContent='FALL';ui.leftRule.textContent='Price goes up';ui.rightRule.textContent='Price goes down'}
}

document.querySelectorAll('.contract').forEach(b=>b.onclick=()=>{document.querySelectorAll('.contract').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.contract=b.dataset.contract;updateLabels();analyze()});
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>setStake(state.stake+Number(b.dataset.delta)));
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>setStake(Number(b.dataset.stake)));
function startAutoTrade(side){
  if(state.autoRunning)return;
  readRisk(); state.userStopped=false; state.tradingLocked=false;
  state.autoRunning=true; state.autoSide=side;
  riskUpdate();
  document.querySelectorAll('.trade').forEach(b=>b.classList.remove('selected'));
  $(side==='left'?'over':'under').classList.add('selected');
  toast('Auto trading started.');
  placeTrade(side,true);
}
function stopAutoTrade(){
  state.autoRunning=false; state.autoSide=null;
  clearTimeout(state.autoTimer); state.autoTimer=null;
  state.userStopped=true; state.tradingLocked=true;
  riskUpdate();
  toast('Trading stopped.');
}
$('over').onclick=()=>startAutoTrade('left');
$('under').onclick=()=>startAutoTrade('right');
$('stopTrade').onclick=()=>{
  if(state.autoRunning || !state.userStopped) stopAutoTrade();
  else { state.userStopped=false; state.tradingLocked=false; riskUpdate(); toast('Ready to trade.'); }
};
$('place').onclick=()=>{const s=ui.direction.textContent;if(['MATCH','OVER','RISE','EVEN'].includes(s))startAutoTrade('left');else if(['DIFFER','UNDER','FALL','ODD'].includes(s))startAutoTrade('right');else toast('AI says WAIT — no trade placed.')};
$('reset').onclick=()=>{if(state.accountType==='real'){toast('Real balance cannot be reset.');return}state.sessionNet=0;state.userStopped=false;state.wins=0;state.losses=0;state.tradingLocked=false;ui.wins.textContent='0 W';ui.losses.textContent='0 L';riskUpdate();toast('Session reset.')};
$('autoMode').onclick=()=>{state.manual=false;$('autoMode').classList.add('selected');$('manualMode').classList.remove('selected')};
$('manualMode').onclick=()=>{state.manual=true;$('manualMode').classList.add('selected');$('autoMode').classList.remove('selected')};
$('connectDeriv').onclick=()=>auth.token?loadAccounts():startOAuth();
$('accountType').onchange=async e=>{state.accountType=e.target.value;sessionStorage.setItem('deriv_account_type',state.accountType);if(auth.token)await connectSelectedAccount();else{$('accountType').value='demo';state.accountType='demo';toast('Connect Deriv first.')}};
$('market').onchange=e=>{state.symbol=e.target.value;state.prices=[];state.digits=Array(10).fill(0);connectPublic()};
$('stopLoss').oninput=riskUpdate;$('targetProfit').oninput=riskUpdate;$('multiplier').onchange=readRisk;
window.addEventListener('resize',drawChart);

setStake(1);updateLabels();riskUpdate();connectPublic();finishOAuth().then(()=>{if(auth.token)loadAccounts()});
})();