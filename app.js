(() => {
'use strict';

const $ = id => document.getElementById(id);
const state = {
  ws:null, symbol:'1HZ100V', prices:[], digits:Array(10).fill(0),
  digitSampleSize:100,
  stake:0.25, contract:'OVERUNDER', balance:10000, sessionNet:0,
  wins:0, losses:0, pending:null, stopped:false, autoSide:null, autoTimer:null, reconnect:null,
  accountMode:'demo', oauthToken:null, accounts:[], account:null, authWs:null, authReconnect:null, tradeReqId:1000,
  practicePayout:0.95, practiceLastTick:0, tickSeq:0, realLastTick:0, realTradesInWindow:0, realWindowStart:0, realOpen:new Map(), autoPattern:false, previousPredictionDigit:null, autoPatternCount:0, autoPatternDigits:[], autoPatternBusy:false, autoPatternTrade:null,autoAfterManual:false
};
const feeds=['wss://api.derivws.com/trading/v1/options/ws/public','wss://ws.binaryws.com/websockets/v3'];

const ui={
  price:$('price'), digit:$('digitBig'), confidence:$('confidence'),
  direction:$('direction'), grid:$('digitGrid'), strongest:$('strongestDigit'),
  strongestPct:$('strongestPct'), connection:$('connection'), balance:$('balance'),
  stake:$('stake'), payout:$('payout'), canvas:$('chartCanvas'),
  accountLabel:$('accountLabel'), derivStatus:$('derivStatus'), derivAccount:$('derivAccount')
};

function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function lastDigit(n){
  const q=Number(n);
  if(!Number.isFinite(q)) return null;
  // Deriv synthetic-index quotes in this dashboard use 2 decimal places.
  // Multiplication preserves trailing-zero last digits (e.g. 123.40 -> 0).
  return Math.floor(Math.abs(q)*100 + 1e-8) % 10;
}

function rebuildDigitStats(){
  state.digits=Array(10).fill(0);
  state.prices.slice(-state.digitSampleSize).forEach(v=>{
    const d=lastDigit(v);
    if(d!==null) state.digits[d]++;
  });
}
function setConn(t,ok=false){ui.connection.textContent='● '+t;ui.connection.style.color=ok?'#2ce795':'#ffc857'}

function updateDigits(){
  const total=state.digits.reduce((a,b)=>a+b,0);
  if(!total)return;
  const p=state.digits.map(v=>v/total*100);
  const hot=p.indexOf(Math.max(...p));
  ui.grid.innerHTML=p.map((v,i)=>`<div class="digit ${i===hot?'hot':''}" data-digit="${i}"><b>${i}</b><small>${v.toFixed(1)}%</small></div>`).join('');
  ui.strongest.textContent=hot;
  ui.strongestPct.textContent='('+p[hot].toFixed(1)+'%)';
  const latest=state.prices.length?lastDigit(state.prices.at(-1)):null;
  ui.digit.textContent=latest===null?'—':latest;
  moveCursor(latest===null?hot:latest);
}

function moveCursor(d){
  const c=$('cursor'); if(!c || d===null || d===undefined)return;
  c.style.transform=`translateX(${d*100}%)`;
}

function updateAnalysis(){
  if(state.prices.length<10){ui.direction.textContent='WAIT';ui.confidence.textContent='—';return}
  const p=state.prices.slice(-30), first=p[0], last=p.at(-1);
  const delta=last-first, mid=Math.floor(p.length/2);
  const a=p.slice(0,mid).reduce((s,v)=>s+v,0)/mid;
  const b=p.slice(mid).reduce((s,v)=>s+v,0)/(p.length-mid);
  const up=delta>0 && b>=a, down=delta<0 && b<=a;
  let dir='WAIT';
  if(state.contract==='RISEFALL')dir=up?'RISE':down?'FALL':'WAIT';
  else if(state.contract==='EVENODD'){
    const even=state.digits.filter((_,i)=>i%2===0).reduce((a,v)=>a+v,0);
    const odd=state.digits.filter((_,i)=>i%2).reduce((a,v)=>a+v,0);
    dir=even>=odd?'EVEN':'ODD';
  }else dir=up?'OVER':down?'UNDER':'WAIT';
  ui.direction.textContent=dir;
  const magnitude=Math.abs(delta)/Math.max(Math.abs(first),1);
  ui.confidence.textContent=Math.round(Math.min(95,55+magnitude*100000))+'%';
}

function drawChart(){
  const c=ui.canvas,ctx=c.getContext('2d'),dpr=devicePixelRatio||1;
  const w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  const p=state.prices.slice(-70);
  if(p.length<2)return;
  const min=Math.min(...p),max=Math.max(...p),range=max-min||1;
  ctx.beginPath();
  p.forEach((v,i)=>{
    const x=i*(w-8)/(p.length-1)+4,y=h-5-((v-min)/range)*(h-10);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.strokeStyle='#19a9ff';ctx.lineWidth=2;ctx.stroke();
}

function updateLivePnlFromTick(d){
  // In REAL mode, display the session result plus the combined live profit
  // reported by currently open Deriv contracts. In DEMO mode this is unused
  // because practice P/L is settled directly on each tick.
  if(state.accountMode==='real' && state.realOpen.size){
    let live=0;
    for(const t of state.realOpen.values()){
      const p=Number(t.liveProfit);
      if(Number.isFinite(p)) live+=p;
    }
    const total=state.sessionNet+live;
    $('sessionNet').textContent=(total>=0?'+$':'-$')+Math.abs(total).toFixed(2);
    return;
  }
  if(!state.pending || state.pending.phase!=='open') return;
  const liveProfit=Number(state.pending.liveProfit);
  if(!Number.isFinite(liveProfit)) return;
  const liveTotal=state.sessionNet+liveProfit;
  $('sessionNet').textContent=(liveTotal>=0?'+$':'-$')+Math.abs(liveTotal).toFixed(2);
}

function onTick(t){
  state.tickSeq++;
  const q=Number(t.quote);if(!Number.isFinite(q))return;
  state.prices.push(q);if(state.prices.length>120)state.prices.shift();
  const d=lastDigit(q);
  rebuildDigitStats();
  ui.price.textContent=fmt(q);
  $('tickCount').textContent=state.prices.length+' ticks';
  updateDigits();updateAnalysis();drawChart();

  // Automatic strategies are evaluated exactly once per fresh prediction digit.
  // With a connected Deriv account, the qualifying pair places an actual Deriv
  // contract (Demo or Real). Without an authenticated account, Practice Mode
  // uses the local simulator.
  if(state.autoPattern){
    runThreeDigitAutoTick(d);
  }else{
    runPracticeTradeOnTick(d);
    runRealTradeOnTick(d);
  }

  // Render the final same-tick P/L state after trade processing.
  updateLivePnlFromTick(d);
}

function loadHistory(h){
  if(!h)return;
  state.prices=h.map(Number).filter(Number.isFinite).slice(-120);
  rebuildDigitStats();
  updateDigits();updateAnalysis();drawChart();
}

function subscribe(ws){
  ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));
  ws.send(JSON.stringify({ticks_history:state.symbol,count:100,end:'latest',style:'ticks',req_id:3}));
}

function connect(){
  clearTimeout(state.reconnect);
  setConn('Connecting…');
  const ws=new WebSocket(feeds[0]);state.ws=ws;
  let opened=false;
  ws.onopen=()=>{opened=true;setConn('Live market connected',true);subscribe(ws)};
  ws.onmessage=e=>{
    try{
      const d=JSON.parse(e.data);
      if(d.error){setConn('Deriv data error');return}
      if(d.msg_type==='history'&&d.history?.prices)loadHistory(d.history.prices);
      if(d.msg_type==='tick'&&d.tick)onTick(d.tick);
    }catch(_){}
  };
  ws.onerror=()=>setConn('Connection error');
  ws.onclose=()=>{
    if(opened){setConn('Reconnecting…');state.reconnect=setTimeout(connect,2500)}
  };
}

const DERIV_API='https://api.derivws.com';
const DERIV_CLIENT_ID=window.FXTRADE_DERIV_CLIENT_ID || localStorage.getItem('fxtrade_deriv_client_id') || '';
const OAUTH_SCOPE='trade';

function base64url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function randomString(n=64){const a=new Uint8Array(n);crypto.getRandomValues(a);return base64url(a)}
async function sha256(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))}

async function connectDeriv(){
  let clientId=window.FXTRADE_DERIV_CLIENT_ID || localStorage.getItem('fxtrade_deriv_client_id') || '';
  if(!clientId){
    clientId=prompt('Enter your Deriv OAuth Client ID from developers.deriv.com:','');
    if(!clientId)return;
    localStorage.setItem('fxtrade_deriv_client_id',clientId.trim());
  }
  const verifier=randomString(64), challenge=base64url(await sha256(verifier)), state=randomString(24);
  sessionStorage.setItem('fxtrade_pkce_verifier',verifier);
  sessionStorage.setItem('fxtrade_oauth_state',state);
  sessionStorage.setItem('fxtrade_client_id',clientId.trim());
  sessionStorage.setItem('fxtrade_return_mode',state.accountMode || 'demo');
  const redirect=location.origin+'/';
  const url=new URL('https://auth.deriv.com/oauth2/auth');
  url.searchParams.set('response_type','code');url.searchParams.set('client_id',clientId.trim());
  url.searchParams.set('redirect_uri',redirect);url.searchParams.set('scope',OAUTH_SCOPE);
  url.searchParams.set('state',state);url.searchParams.set('code_challenge',challenge);url.searchParams.set('code_challenge_method','S256');
  location.href=url.toString();
}

async function handleOAuthCallback(){
  const qs=new URLSearchParams(location.search), code=qs.get('code'), returnedState=qs.get('state'), error=qs.get('error');
  if(error){toast('Deriv login cancelled');history.replaceState({},'',location.pathname);return}
  if(!code)return;
  const savedState=sessionStorage.getItem('fxtrade_oauth_state'), verifier=sessionStorage.getItem('fxtrade_pkce_verifier'), clientId=sessionStorage.getItem('fxtrade_client_id');
  if(!savedState || returnedState!==savedState || !verifier || !clientId){toast('Deriv login security check failed');return}
  try{
    ui.derivStatus.textContent='Authorizing…';
    const r=await fetch('/api/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:verifier,redirect_uri:location.origin+'/',client_id:clientId})});
    const data=await r.json(); if(!r.ok || !data.access_token) throw new Error(data.error||'Token exchange failed');
    state.oauthToken=data.access_token;
    sessionStorage.setItem('fxtrade_access_token',data.access_token);
    sessionStorage.removeItem('fxtrade_oauth_state');sessionStorage.removeItem('fxtrade_pkce_verifier');
    history.replaceState({},'',location.pathname);
    await loadDerivAccounts();
    toast('Deriv connected');
  }catch(e){ui.derivStatus.textContent='Connection failed';toast(e.message||'Deriv connection failed')}
}

async function derivFetch(path, options={}){
  if(!state.oauthToken)throw new Error('Connect your Deriv account first');
  const r=await fetch('/api/deriv/proxy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path,method:options.method||'GET',body:options.body||null,token:state.oauthToken})});
  const data=await r.json();if(!r.ok)throw new Error(data?.errors?.[0]?.message||data?.error||'Deriv request failed');return data;
}

async function loadDerivAccounts(){
  try{
    const data=await derivFetch('/trading/v1/options/accounts');
    const raw=Array.isArray(data.data)?data.data:(data.data?[data.data]:[]);
    state.accounts=raw;
    ui.derivAccount.innerHTML=raw.length?raw.map(a=>`<option value="${a.account_id}">${a.account_type==='real'?'REAL':'DEMO'} — ${a.account_id} — ${a.currency} ${fmt(a.balance)}</option>`).join(''):'<option value="">No Options accounts found</option>';
    const preferred=raw.find(a=>a.account_type===state.accountMode) || raw[0];
    if(preferred){ui.derivAccount.value=preferred.account_id;await selectDerivAccount(preferred.account_id)}
    ui.derivStatus.textContent='Connected';
  }catch(e){ui.derivStatus.textContent='Unable to load accounts';toast(e.message)}
}

async function selectDerivAccount(id){
  const a=state.accounts.find(x=>x.account_id===id);if(!a)return;
  state.account=a;state.accountMode=a.account_type;
  ui.accountLabel.textContent=a.account_type==='real'?'Real Account':'Demo Account';
  ui.balance.textContent=(a.currency==='USD'?'$':a.currency+' ')+fmt(a.balance);
  document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x.id===(a.account_type==='real'?'realMode':'demoMode')));
  if(state.authWs)try{state.authWs.close()}catch(_){}
  try{
    const otp=await derivFetch(`/trading/v1/options/accounts/${encodeURIComponent(id)}/otp`,{method:'POST'});
    const url=otp?.data?.url;if(!url)throw new Error('Deriv did not return a WebSocket URL');
    state.authWs=new WebSocket(url);
    state.authWs.onopen=()=>{ui.derivStatus.textContent='Connected · '+(a.account_type==='real'?'REAL':'DEMO');state.authWs.send(JSON.stringify({balance:1,subscribe:1,req_id:41}))};
    state.authWs.onmessage=e=>{try{
      const d=JSON.parse(e.data);
      if(d.error){
        handleDerivTradeMessage(d);
        if(!state.pending)toast(d.error.message||'Deriv account error');
        return;
      }
      if(d.msg_type==='balance'&&d.balance){
        const n=Number(d.balance.balance);
        if(Number.isFinite(n))ui.balance.textContent=(d.balance.currency==='USD'?'$':d.balance.currency+' ')+fmt(n);
      }
      handleDerivTradeMessage(d);
    }catch(_) {}};
    state.authWs.onclose=()=>{ui.derivStatus.textContent='Disconnected';};
  }catch(e){toast(e.message)}
}

function setAccountMode(mode){
  state.accountMode=mode;
  document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x.id===(mode==='real'?'realMode':'demoMode')));
  $('realPanel').classList.toggle('hidden',mode!=='real');
  if(mode==='real'){
    state.autoSide=null;clearTimeout(state.autoTimer);
    if(state.oauthToken){loadDerivAccounts()}else{ui.derivStatus.textContent='Not connected';toast('Connect Deriv to use the real account')}
  }else{
    if(state.oauthToken) loadDerivAccounts();
    else { ui.accountLabel.textContent='Demo Account'; ui.balance.textContent='Connect Deriv'; }
  }
}

function setStake(v){
  state.stake=Math.max(.25,Math.min(100,Math.round(v*100)/100));
  ui.stake.textContent=state.stake.toFixed(2);
}

function updateLabels(){
  const l=$('leftTradeLabel'),r=$('rightTradeLabel'),lr=$('leftRule'),rr=$('rightRule');
  if(state.contract==='RISEFALL'){l.textContent='RISE';r.textContent='FALL';lr.textContent='Price up';rr.textContent='Price down'}
  else if(state.contract==='EVENODD'){l.textContent='EVEN';r.textContent='ODD';lr.textContent='0,2,4,6,8';rr.textContent='1,3,5,7,9'}
  else {l.textContent='OVER';r.textContent='UNDER';lr.textContent='Digits 4 – 9';rr.textContent='Digits 0 – 3'}
}

function startDemo(side){
  // FXTRADE Practice Mode is a local simulator. It uses the live public Deriv
  // tick stream for the prediction digit, but does NOT place a real/demo Deriv
  // contract. Every new tick settles one simulated 1-tick practice trade.
  if(state.stopped){toast('Trading is stopped. Press RESUME to continue.');return}
  const stake=Number(state.stake);
  if(!Number.isFinite(stake)||stake<=0){toast('Invalid stake.');return}
  state.autoSide=side;
  state.pending={phase:'practice',side,stake};
  toast('Practice '+(side==='left'?'OVER':'UNDER')+' started');
}

function digitQualifiesForSide(d, side){
  if(d===null || d===undefined) return false;
  if(state.contract==='OVERUNDER') return side==='left' ? d>=4 : d<=3;
  if(state.contract==='EVENODD') return side==='left' ? (d%2===0) : (d%2===1);
  return true;
}

function runThreeDigitAutoTick(d){
  if(state.stopped || d===null) return;

  // If a practice trade is already open, the NEXT prediction digit settles it.
  if(state.autoPatternTrade){
    const trade=state.autoPatternTrade;
    state.autoPatternTrade=null;
    runPracticeAutoTradeResult(d,trade.entryDigit);
    state.autoPatternBusy=false;
    state.previousPredictionDigit=null;
    state.autoPatternCount=0;
    state.autoPatternDigits=[];
    return;
  }

  // REQUIRE THREE CONSECUTIVE qualifying prediction digits (0, 1, 2 or 3).
  // Example: 1 -> 2 -> 0 = trigger on 0.
  // Example: 1 -> 2 -> 5 = reset; NO trade.
  // The digits do not have to be identical; all three must be consecutive
  // live prediction ticks and all must qualify for Over 3.
  if(d>=0 && d<=3){
    if(!Array.isArray(state.autoPatternDigits)) state.autoPatternDigits=[];
    state.autoPatternDigits.push(d);
    if(state.autoPatternDigits.length>3) state.autoPatternDigits.shift();
    state.autoPatternCount=state.autoPatternDigits.length;
    state.previousPredictionDigit=d;
  }else{
    state.autoPatternDigits=[];
    state.autoPatternCount=0;
    state.previousPredictionDigit=d;
    return;
  }

  // Absolutely do not place the trade after only 1 or 2 qualifying digits.
  if(state.autoPatternDigits.length!==3) return;

  const entryDigit=d;
  state.autoPatternDigits=[];
  state.autoPatternCount=0;
  state.previousPredictionDigit=null;

  const busy = state.accountMode==='real' ? state.realOpen.size>0 : !!state.pending;
  if(busy || state.autoPatternBusy) return;

  state.autoPatternBusy=true;
  if(state.account && state.authWs && state.authWs.readyState===WebSocket.OPEN){
    // Real/demo Deriv account: this sends the actual DIGITOVER contract.
    startDerivTrade('left',entryDigit);
  }else{
    // Local practice fallback: mark the trade as OPEN now and settle it on
    // the next live prediction digit.
    state.autoPatternTrade={entryDigit,stake:Number(state.stake)||0};
    if(!state.autoPatternTrade.stake){
      state.autoPatternTrade=null;
      state.autoPatternBusy=false;
      return;
    }
    const resultEl=$('predictionResult');
    if(resultEl) resultEl.textContent=`Over trade placed after 3 consecutive 0–3 digits • waiting for next digit`;
    toast('Auto OVER trade placed after 3 consecutive 0–3 digits');
  }
}

function runPracticeAutoTradeResult(resultDigit,entryDigit){
  const stake=Number(state.stake)||0;
  if(!stake) return;
  // Over 3 wins when the contract's resulting digit is 4-9.
  const win=resultDigit>=4;
  const profit=win ? stake*state.practicePayout : -stake;
  state.sessionNet+=profit;
  state.balance=10000+state.sessionNet;
  state.wins+=win?1:0;
  state.losses+=win?0:1;
  const pnl=$('sessionNet');
  pnl.textContent=(state.sessionNet>=0?'+$':'-$')+Math.abs(state.sessionNet).toFixed(2);
  pnl.dataset.lastResult=win?'WIN':'LOSS';
  pnl.title=win ? `Entry ${entryDigit}, result ${resultDigit}: WIN +$${profit.toFixed(2)}` : `Entry ${entryDigit}, result ${resultDigit}: LOSS -$${Math.abs(profit).toFixed(2)}`;
  const resultEl=$('predictionResult');
  if(resultEl) resultEl.textContent=win ? `Digit ${resultDigit} • WIN +$${profit.toFixed(2)}` : `Digit ${resultDigit} • LOSS -$${Math.abs(profit).toFixed(2)}`;
  $('wins').textContent=state.wins;$('losses').textContent=state.losses;
  ui.balance.textContent='$'+fmt(state.balance);
  checkLimits();
}

function runPracticeTradeOnTick(d){
  if(state.accountMode!=='demo' || state.stopped || d===null) return;
  // Optional automatic strategy: three consecutive digits in 0-3 trigger ONE Over 3 trade.
  // The trigger is evaluated on the same prediction tick so prediction, trade count and P/L stay synchronized.
  if(state.autoPattern) return;
  else {
    if(!state.autoSide || state.practiceLastTick===state.tickSeq) return;
    state.practiceLastTick=state.tickSeq;
  }
  const side=state.autoSide;
  const stake=Number(state.stake)||0;
  if(!stake) return;

  let win;
  if(state.contract==='OVERUNDER' || state.contract==='EVENODD') {
    win=digitQualifiesForSide(d,side);
  } else {
    const prev=state.prices.length>1?state.prices.at(-2):null;
    const cur=state.prices.at(-1);
    win=side==='left' ? Number(cur)>Number(prev) : Number(cur)<Number(prev);
  }

  const profit=win ? stake*state.practicePayout : -stake;
  state.sessionNet+=profit;
  state.balance=10000+state.sessionNet;
  state.wins+=win?1:0;
  state.losses+=win?0:1;

  // Make P/L visibly follow the prediction result immediately.
  const pnl=$('sessionNet');
  pnl.textContent=(state.sessionNet>=0?'+$':'-$')+Math.abs(state.sessionNet).toFixed(2);
  pnl.dataset.lastResult=win?'WIN':'LOSS';
  pnl.title=win ? `Prediction ${d}: WIN +$${profit.toFixed(2)}` : `Prediction ${d}: LOSS -$${Math.abs(profit).toFixed(2)}`;
  const resultEl=$('predictionResult');
  if(resultEl){
    resultEl.textContent=win
      ? `Digit ${d} • WIN +$${profit.toFixed(2)}`
      : `Digit ${d} • LOSS -$${Math.abs(profit).toFixed(2)}`;
  }
  $('wins').textContent=state.wins;
  $('losses').textContent=state.losses;
  ui.balance.textContent='$'+fmt(state.balance);
  checkLimits();
  if(state.autoAfterManual && !state.stopped){
    state.autoAfterManual=false;
    state.autoPattern=true;
    state.autoSide='left';
    state.previousPredictionDigit=null;
    state.autoPatternBusy=false;
    if($('autoPattern')) $('autoPattern').checked=true;
    toast('Manual OVER finished — waiting for three consecutive 0–3 digits.');
  }
}

function runRealTradeOnTick(d){
  if(state.accountMode!=='real' || state.stopped || d===null) return;
  if(state.realLastTick===state.tickSeq) return;
  state.realLastTick=state.tickSeq;
  if(!state.account || !state.authWs || state.authWs.readyState!==WebSocket.OPEN) return;

  if(state.autoPattern) return;

  if(!state.autoSide) return;
  // Manual auto-trading mode: every fresh prediction digit is one trade opportunity.
  startDerivTrade(state.autoSide, d);
}

function startDerivTrade(side, predictionDigit=null){
  if(!state.account || !state.authWs || state.authWs.readyState!==WebSocket.OPEN){
    toast('Connect Deriv and select a Demo or Real account first.');
    return;
  }
  if(state.stopped){toast('Trading is stopped. Press STOP again to resume.');return}
  if(state.accountMode!=='real' && state.pending){toast('Wait for the current trade to settle.');return}

  const stake=Number(state.stake);
  if(!Number.isFinite(stake)||stake<=0){toast('Invalid stake.');return}

  const currency=state.account.currency || 'USD';
  let contract_type, barrier;
  if(state.contract==='OVERUNDER'){
    contract_type=side==='left'?'DIGITOVER':'DIGITUNDER';
    barrier=side==='left'?'3':'4';
  }else if(state.contract==='EVENODD'){
    contract_type=side==='left'?'DIGITEVEN':'DIGITODD';
  }else{
    contract_type=side==='left'?'CALL':'PUT';
  }

  const reqId=++state.tradeReqId;
  const tradeState={phase:'proposal',side,stake,reqId,contract_type,predictionDigit,createdAtTick:state.tickSeq};
  if(state.accountMode==='real') state.realOpen.set(reqId,tradeState);
  else state.pending=tradeState;
  state.authWs.send(JSON.stringify({
    proposal:1,
    amount:stake,
    basis:'stake',
    contract_type,
    currency,
    duration:1,
    duration_unit:'t',
    underlying_symbol:state.symbol,
    ...(barrier!==undefined?{barrier}:{}),
    req_id:reqId
  }));
  toast((state.account.account_type==='real'?'REAL ':'DEMO ')+
        (side==='left'?$('leftTradeLabel').textContent:$('rightTradeLabel').textContent)+' proposal requested');
}

function handleDerivTradeMessage(d){
  if(d.error){
    const reqId=d.req_id;
    const trade=(state.accountMode==='real' && reqId && state.realOpen.get(reqId)) || state.pending;
    if(trade){
      if(state.accountMode==='real' && reqId) state.realOpen.delete(reqId);
      else state.pending=null;
      toast('Trade rejected: '+(d.error.message||'Deriv error'));
    }
    return;
  }

  if(d.msg_type==='proposal'){
    const trade=(state.accountMode==='real' ? state.realOpen.get(d.req_id) : state.pending);
    if(!trade || d.req_id!==trade.reqId)return;
    const p=d.proposal, price=Number(p?.ask_price);
    if(!p?.id || !Number.isFinite(price)){
      if(state.accountMode==='real') state.realOpen.delete(d.req_id); else state.pending=null;
      toast('Deriv returned an invalid proposal.');return;
    }
    const buyReq=++state.tradeReqId;
    const updated={...trade,phase:'buying',proposalId:p.id,askPrice:price,buyReq};
    if(state.accountMode==='real') state.realOpen.set(trade.reqId,updated); else state.pending=updated;
    state.authWs.send(JSON.stringify({buy:String(p.id),price,req_id:buyReq}));
    return;
  }

  if(d.msg_type==='buy'){
    const trade=state.accountMode==='real'
      ? [...state.realOpen.values()].find(x=>x.buyReq===d.req_id)
      : state.pending;
    if(!trade || d.req_id!==trade.buyReq)return;
    const contractId=d.buy?.contract_id;
    if(!contractId){
      if(state.accountMode==='real') state.realOpen.delete(trade.reqId); else state.pending=null;
      toast('Deriv did not return a contract ID.');return;
    }
    const updated={...trade,phase:'open',contractId};
    if(state.accountMode==='real') state.realOpen.set(trade.reqId,updated); else state.pending=updated;
    state.authWs.send(JSON.stringify({proposal_open_contract:1,contract_id:contractId,subscribe:1,req_id:++state.tradeReqId}));
    toast('Trade placed on Deriv');
    return;
  }

  if(d.msg_type==='proposal_open_contract'){
    const cid=Number(d.proposal_open_contract?.contract_id);
    const trade=state.accountMode==='real'
      ? [...state.realOpen.values()].find(x=>Number(x.contractId)===cid)
      : (state.pending && Number(state.pending.contractId)===cid ? state.pending : null);
    if(!trade)return;
    const c=d.proposal_open_contract, profit=Number(c.profit);
    if(Number.isFinite(profit) && trade.phase==='open'){
      trade.liveProfit=profit;
      if(state.accountMode==='demo'){
        const liveTotal=state.sessionNet+profit;
        $('sessionNet').textContent=(liveTotal>=0?'+$':'-$')+Math.abs(liveTotal).toFixed(2);
      }
      // Stop immediately when the displayed live P/L reaches a configured
      // limit, rather than waiting for the contract to settle.
      checkLimits();
    }
    if(c.is_sold || c.status==='won' || c.status==='lost' || c.status==='sold'){
      const finalProfit=Number(c.profit);
      if(Number.isFinite(finalProfit)){
        state.sessionNet+=finalProfit;
        if(finalProfit>=0){state.wins++;toast('Deriv WIN +$'+finalProfit.toFixed(2));}
        else {state.losses++;toast('Deriv LOSS -$'+Math.abs(finalProfit).toFixed(2));}
        $('sessionNet').textContent=(state.sessionNet>=0?'+$':'-$')+Math.abs(state.sessionNet).toFixed(2);
        $('wins').textContent=state.wins;$('losses').textContent=state.losses;
        checkLimits();
      }
      if(state.accountMode==='real') state.realOpen.delete(trade.reqId); else state.pending=null;
      if(state.autoAfterManual && !state.stopped){
        state.autoAfterManual=false;
        state.autoPattern=true;
        state.autoSide='left';
        state.previousPredictionDigit=null;
        state.autoPatternCount=0;
        state.autoPatternBusy=false;
        if($('autoPattern')) $('autoPattern').checked=true;
        toast('Manual OVER finished — waiting for three consecutive 0–3 digits.');
      }
      if(state.autoPattern){
        state.autoPatternBusy=false;
        state.previousPredictionDigit=null;
      }else if(state.accountMode==='demo' && !state.stopped && state.autoSide){
        clearTimeout(state.autoTimer);
        state.autoTimer=setTimeout(()=>startDerivTrade(state.autoSide),0);
      }
    }
  }
}
function getEffectivePnl(){
  // Use the same P/L that is shown to the user. In real mode this includes
  // live profit/loss from currently open Deriv contracts.
  if(state.accountMode==='real' && state.realOpen.size){
    let live=0;
    for(const t of state.realOpen.values()){
      const p=Number(t.liveProfit);
      if(Number.isFinite(p)) live+=p;
    }
    return state.sessionNet+live;
  }
  return state.sessionNet;
}

function checkLimits(){
  const target=Number($('targetProfit').value)||0,stop=Number($('stopLoss').value)||0;
  const pnl=getEffectivePnl();
  if(target>0&&pnl>=target){
    state.stopped=true;
    state.autoSide=null;
    clearTimeout(state.autoTimer);state.autoTimer=null;
    toast('Target profit reached — trading stopped.');
  }
  if(stop>0&&pnl<=-stop){
    state.stopped=true;
    state.autoSide=null;
    clearTimeout(state.autoTimer);state.autoTimer=null;
    toast('Stop loss reached — trading stopped.');
  }
  $('stopTrade').textContent=state.stopped?'▶ RESUME':'■ STOP';
}

$('connectDeriv').onclick=connectDeriv;
$('demoMode').onclick=()=>setAccountMode('demo');
$('realMode').onclick=()=>setAccountMode('real');
$('refreshAccounts').onclick=()=>state.oauthToken?loadDerivAccounts():toast('Connect Deriv first');
ui.derivAccount.onchange=e=>selectDerivAccount(e.target.value);

$('market').onchange=e=>{
  state.symbol=e.target.value;
  state.prices=[];
  state.digits=Array(10).fill(0);
  // A volatility/symbol change starts a completely new three-digit sequence.
  // Never carry qualifying digits from the previous volatility into the new one.
  state.autoPatternDigits=[];
  state.autoPatternCount=0;
  state.previousPredictionDigit=null;
  // A volatility/symbol change must also discard any locally simulated
  // auto-trade state. Otherwise the first ticks of the new symbol can be
  // treated as the continuation of the previous symbol's sequence.
  state.autoPatternTrade=null;
  state.autoPatternBusy=false;
  state.practiceLastTick=0;
  state.realLastTick=0;
  try{state.ws.close()}catch(_){}
  connect();
};
document.querySelectorAll('.contract').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.contract').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  state.contract=b.dataset.contract;updateLabels();updateAnalysis();
});
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>setStake(state.stake+Number(b.dataset.delta)));
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>setStake(Number(b.dataset.stake)));
$('over').onclick=()=>{
  state.autoPattern=false;
  state.autoAfterManual=true;
  state.previousPredictionDigit=null;
  state.autoPatternCount=0;
  state.autoPatternBusy=false;
  if($('autoPattern'))$('autoPattern').checked=false;
  state.autoSide='left';
  (state.account && state.authWs && state.authWs.readyState===WebSocket.OPEN) ? startDerivTrade('left') : startDemo('left');
  toast('OVER placed manually — after it finishes, wait for three consecutive 0–3 digits for the next automatic OVER trade.');
};
$('under').onclick=()=>{state.autoPattern=false;if($('autoPattern'))$('autoPattern').checked=false;state.autoSide='right'; state.accountMode==='demo'?startDemo('right'):startDerivTrade('right')};
$('autoPattern').onchange=e=>{
  state.autoPattern=e.target.checked;
  state.previousPredictionDigit=null;
  state.autoSide=e.target.checked?'left':null;
  state.practiceLastTick=0; state.realLastTick=0; state.autoPatternBusy=false;
  toast(e.target.checked?'3-digit auto OVER enabled: three consecutive 0-3 digits trigger a trade.':'3-digit auto disabled');
};
$('stopTrade').onclick=()=>{
  state.stopped=!state.stopped;
  if(!state.stopped && state.accountMode==='demo' && state.autoSide){ state.practiceLastTick=0; }
  if(!state.stopped && state.accountMode==='real' && state.autoSide){ state.realLastTick=0; } 
  if(state.stopped){state.autoSide=null;clearTimeout(state.autoTimer);state.autoTimer=null}
  $('stopTrade').textContent=state.stopped?'▶ RESUME':'■ STOP';
  toast(state.stopped?'Trading stopped':'Trading resumed');
};
$('reset').onclick=()=>{clearTimeout(state.autoTimer);state.autoTimer=null;state.autoSide=null;state.balance=10000;state.sessionNet=0;state.wins=0;state.losses=0;state.pending=null;state.stopped=false;state.practiceLastTick=0;state.realLastTick=0;state.realTradesInWindow=0;state.realWindowStart=0;state.realOpen.clear();state.tickSeq=0;state.autoPattern=false;state.autoAfterManual=false;state.previousPredictionDigit=null;state.autoPatternCount=0;state.autoPatternDigits=[];state.autoPatternBusy=false;state.autoPatternTrade=null;if($('autoPattern'))$('autoPattern').checked=false;ui.balance.textContent='$10,000.00';$('sessionNet').textContent='$0.00';$('wins').textContent='0';$('losses').textContent='0';if($('predictionResult'))$('predictionResult').textContent='Latest tick digit';$('stopTrade').textContent='■ STOP';toast('Demo reset')};
window.addEventListener('resize',drawChart);
setStake(.25);updateLabels();setAccountMode('demo');
state.oauthToken=sessionStorage.getItem('fxtrade_access_token')||null;
if(state.oauthToken){ui.derivStatus.textContent='Connected';loadDerivAccounts()}
handleOAuthCallback();connect();
})();