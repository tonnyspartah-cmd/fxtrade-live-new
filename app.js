(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={ws:null,symbol:'1HZ100V',prices:[],digits:Array(10).fill(0),stake:5,contract:'OVERUNDER',balance:10000,reconnect:null,pending:null,stats:{trades:0,wins:0,losses:0}};
const DERIV_CLIENT_ID='34m6kBZ1JQGXBHSscpXXQ';
const DERIV_REDIRECT_URI=window.location.origin+'/';
const DERIV_API='https://api.derivws.com';
const auth={token:sessionStorage.getItem('deriv_access_token')||null,accountId:sessionStorage.getItem('deriv_account_id')||null,ws:null};
const ui={price:$('price'),digit:$('digitBig'),confidence:$('confidence'),direction:$('direction'),grid:$('digitGrid'),strongest:$('strongestDigit'),strongestPct:$('strongestPct'),connection:$('connection'),balance:$('balance'),payout:$('payout'),stake:$('stake'),connect:$('connectDeriv')};
const marketSelect=$('market');
const feeds=['wss://api.derivws.com/trading/v1/options/ws/public','wss://ws.binaryws.com/websockets/v3'];
const fallbackVolatilities=[
 ['1HZ100V','Volatility 100 (1s) Index'],['1HZ90V','Volatility 90 (1s) Index'],['1HZ75V','Volatility 75 (1s) Index'],
 ['1HZ50V','Volatility 50 (1s) Index'],['1HZ30V','Volatility 30 (1s) Index'],['1HZ25V','Volatility 25 (1s) Index'],
 ['1HZ15V','Volatility 15 (1s) Index'],['1HZ10V','Volatility 10 (1s) Index'],['R_100','Volatility 100 Index'],
 ['R_75','Volatility 75 Index'],['R_50','Volatility 50 Index'],['R_25','Volatility 25 Index'],['R_10','Volatility 10 Index']
];
let feedIndex=0;

function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function digit(n){const s=String(n);const m=s.replace(/\D/g,'');return m?Number(m[m.length-1]):null}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function setConn(t,ok=false){ui.connection.textContent='● '+t;ui.connection.style.color=ok?'#2ce795':'#ffc857'}

function analyze(){
 if(state.prices.length<8)return;
 const p=state.prices.slice(-30),a=p[0],b=p.at(-1),delta=b-a,half=Math.floor(p.length/2);
 const av1=p.slice(0,half).reduce((s,v)=>s+v,0)/half,av2=p.slice(half).reduce((s,v)=>s+v,0)/(p.length-half);
 const bull=delta>0&&av2>=av1,bear=delta<0&&av2<=av1;
 const dir=bull?'OVER':bear?'UNDER':'WAIT';
 const conf=Math.min(95,Math.max(55,Math.round(55+Math.min(40,Math.abs(delta/Math.max(a,1))*100000*6))));
 ui.direction.textContent=state.contract==='RISEFALL'?(bull?'RISE':bear?'FALL':'WAIT'):state.contract==='EVENODD'?'DIGIT '+(mostEven()?'EVEN':'ODD'):dir;
 ui.confidence.textContent=conf+'%';
 updateDigits();
}
function mostEven(){let e=0,o=0;for(let i=0;i<10;i++){if(i%2)o+=state.digits[i];else e+=state.digits[i]}return e>=o}
function updateDigits(){
 const total=state.digits.reduce((a,b)=>a+b,0);if(!total)return;
 const probs=state.digits.map(n=>n/total*100),hi=probs.indexOf(Math.max(...probs));
 ui.grid.innerHTML=probs.map((v,i)=>`<div class="digit ${i===hi?'high':''}"><b>${i}</b><small>${v.toFixed(1)}%</small></div>`).join('');
 ui.strongest.textContent=hi;ui.strongestPct.textContent='('+probs[hi].toFixed(1)+'%)';ui.digit.textContent=hi;
}
function onTick(t){
 const q=Number(t.quote);if(!Number.isFinite(q))return;
 state.prices.push(q);if(state.prices.length>120)state.prices.shift();
 const d=digit(q);if(d!==null)state.digits[d]++;
 ui.price.textContent=fmt(q);ui.digit.textContent=d===null?'—':d;analyze();settleDemoTrade(q);
}
function subscribe(ws){
 ws.send(JSON.stringify({active_symbols:'brief',product_type:'basic',req_id:1}));
 ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));
 ws.send(JSON.stringify({ticks_history:state.symbol,count:80,end:'latest',style:'ticks',req_id:3}));
}
function populateVolatilities(items){
 const current=state.symbol;
 const list=(items||[]).map(x=>({
   symbol:x.symbol||x.underlying_symbol,
   name:x.display_name||x.underlying_symbol_name||x.symbol
 })).filter(x=>x.symbol && /^Volatility\s/i.test(x.name));
 const merged=new Map();
 fallbackVolatilities.forEach(([symbol,name])=>merged.set(symbol,{symbol,name}));
 list.forEach(x=>merged.set(x.symbol,x));
 const sorted=[...merged.values()].sort((a,b)=>{
   const a1=/\(1s\)/i.test(a.name), b1=/\(1s\)/i.test(b.name);
   if(a1!==b1)return a1?-1:1;
   const na=Number((a.name.match(/Volatility\s+(\d+)/i)||[])[1]||999);
   const nb=Number((b.name.match(/Volatility\s+(\d+)/i)||[])[1]||999);
   return na-nb;
 });
 marketSelect.innerHTML=sorted.map(x=>`<option value="${x.symbol}">${x.name}</option>`).join('');
 marketSelect.value=sorted.some(x=>x.symbol===current)?current:state.symbol;
}

function connect(){
 clearTimeout(state.reconnect);setConn('Connecting…');const ws=new WebSocket(feeds[feedIndex]);state.ws=ws;let opened=false;
 ws.onopen=()=>{opened=true;setConn('Live market connected',true);subscribe(ws)};
 ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.error){if(!opened&&feedIndex<feeds.length-1){feedIndex++;ws.close();connect()}return}
  if(d.msg_type==='active_symbols'&&Array.isArray(d.active_symbols)){populateVolatilities(d.active_symbols)}
  if(d.msg_type==='history'&&d.history?.prices){state.prices=d.history.prices.map(Number).filter(Number.isFinite).slice(-120);state.digits=Array(10).fill(0);state.prices.forEach(v=>{const z=digit(v);if(z!==null)state.digits[z]++});analyze()}
  if(d.msg_type==='tick'&&d.tick)onTick(d.tick);
 }catch(_){}};
 ws.onerror=()=>{if(!opened&&feedIndex<feeds.length-1){feedIndex++;try{ws.close()}catch(_){}connect()}else setConn('Connection error')};
 ws.onclose=()=>{if(opened){setConn('Reconnecting…');state.reconnect=setTimeout(connect,3000)}};
}

function base64Url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
async function sha256Base64Url(text){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return base64Url(new Uint8Array(hash))}
function randomString(len=64){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';const a=new Uint8Array(len);crypto.getRandomValues(a);return Array.from(a,v=>chars[v%chars.length]).join('')}
function randomState(){const a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,v=>v.toString(16).padStart(2,'0')).join('')}
async function startDerivOAuth(){const verifier=randomString(64),stateValue=randomState();sessionStorage.setItem('pkce_code_verifier',verifier);sessionStorage.setItem('oauth_state',stateValue);const challenge=await sha256Base64Url(verifier);const u=new URL('https://auth.deriv.com/oauth2/auth');u.searchParams.set('response_type','code');u.searchParams.set('client_id',DERIV_CLIENT_ID);u.searchParams.set('redirect_uri',DERIV_REDIRECT_URI);u.searchParams.set('scope','trade');u.searchParams.set('state',stateValue);u.searchParams.set('code_challenge',challenge);u.searchParams.set('code_challenge_method','S256');window.location.href=u.toString()}
async function finishDerivOAuth(){const q=new URLSearchParams(location.search),code=q.get('code'),returnedState=q.get('state');if(!code)return;if(returnedState!==sessionStorage.getItem('oauth_state')){toast('Deriv login verification failed.');return}const verifier=sessionStorage.getItem('pkce_code_verifier');try{const r=await fetch('/api/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:verifier,redirect_uri:DERIV_REDIRECT_URI,client_id:DERIV_CLIENT_ID})});const data=await r.json();if(!r.ok||!data.access_token)throw new Error(data.error||'Token exchange failed');auth.token=data.access_token;sessionStorage.setItem('deriv_access_token',auth.token);sessionStorage.removeItem('pkce_code_verifier');sessionStorage.removeItem('oauth_state');history.replaceState({},'',location.pathname);await connectDerivAccount()}catch(e){toast('Deriv connection failed.');console.error(e)}}
async function connectDerivAccount(){if(!auth.token)return;try{const r=await fetch(DERIV_API+'/trading/v1/options/accounts',{headers:{Authorization:'Bearer '+auth.token}});const data=await r.json();if(!r.ok)throw new Error(data?.errors?.[0]?.message||'Account lookup failed');const accounts=data.data?.accounts||data.data||[];const demo=Array.isArray(accounts)?accounts.find(a=>String(a.account_type||a.type||'').toLowerCase()==='demo')||accounts[0]:null;if(!demo?.account_id)throw new Error('No Deriv Options account found');auth.accountId=demo.account_id;sessionStorage.setItem('deriv_account_id',auth.accountId);const otp=await fetch(DERIV_API+'/trading/v1/options/accounts/'+encodeURIComponent(auth.accountId)+'/otp',{method:'POST',headers:{Authorization:'Bearer '+auth.token}});const od=await otp.json();if(!otp.ok||!od.data?.url)throw new Error(od?.errors?.[0]?.message||'Could not create WebSocket session');openAuthenticatedWebSocket(od.data.url)}catch(e){toast(e.message||'Deriv account connection failed.');console.error(e)}}
function openAuthenticatedWebSocket(url){try{auth.ws?.close()}catch(_){}auth.ws=new WebSocket(url);auth.ws.onopen=()=>{setConn('Deriv demo connected',true);if(ui.connect){ui.connect.textContent='Deriv Connected';ui.connect.classList.add('connected')}auth.ws.send(JSON.stringify({balance:1,subscribe:1,req_id:501}));auth.ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:502}))};auth.ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.msg_type==='balance'&&d.balance){ui.balance.textContent='$'+Number(d.balance.balance).toFixed(2);state.balance=Number(d.balance.balance)}if(d.msg_type==='tick'&&d.tick)onTick(d.tick)}catch(_){}};auth.ws.onerror=()=>setConn('Deriv connection error');auth.ws.onclose=()=>{if(ui.connect){ui.connect.textContent='Connect Deriv';ui.connect.classList.remove('connected')}}}
function refreshDerivSession(){if(auth.token&&!auth.ws)connectDerivAccount()}

function updateStats(){
 const t=$('totalTrades'),w=$('wins'),l=$('losses');
 if(t)t.textContent=state.stats.trades; if(w)w.textContent=state.stats.wins; if(l)l.textContent=state.stats.losses;
}
function tradeKind(){
 if(state.contract==='RISEFALL')return 'RISEFALL';
 if(state.contract==='EVENODD')return 'EVENODD';
 return 'OVERUNDER';
}
function startDemoTrade(side){
 if(state.pending){toast('A demo trade is already waiting for the next tick.');return;}
 if(state.balance<state.stake){toast('Demo balance is too low.');return;}
 const entry=state.prices.at(-1);
 state.balance-=state.stake;
 state.pending={side,entry,stake:state.stake,kind:tradeKind()};
 state.stats.trades++;
 ui.balance.textContent='$'+state.balance.toFixed(2);
 updateStats();
 document.querySelectorAll('.trade').forEach(b=>b.classList.remove('selected'));
 $(side==='left'?'over':'under').classList.add('selected');
 toast(side.toUpperCase()+' demo trade placed — waiting for next tick…');
}
function settleDemoTrade(price){
 const t=state.pending;if(!t)return;
 let win=false;const d=digit(price);
 if(t.kind==='OVERUNDER') win=t.side==='left'?d>=4:d<=3;
 else if(t.kind==='EVENODD') win=t.side==='left'?(d%2===0):(d%2===1);
 else if(Number.isFinite(t.entry)) win=t.side==='left'?price>t.entry:price<t.entry;
 state.pending=null;
 if(win){state.stats.wins++;const payout=t.stake*1.95;state.balance+=payout;ui.balance.textContent='$'+state.balance.toFixed(2);toast('Demo WIN — payout $'+payout.toFixed(2));}
 else {state.stats.losses++;ui.balance.textContent='$'+state.balance.toFixed(2);toast('Demo LOSS — stake lost.');}
 updateStats();
}
function setStake(v){state.stake=Math.max(1,Math.min(100,v));ui.stake.textContent=state.stake;ui.payout.textContent='$'+(state.stake*1.96).toFixed(2)}
document.querySelectorAll('.contract').forEach(b=>b.onclick=()=>{document.querySelectorAll('.contract').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.contract=b.dataset.contract;updateTradeLabels();analyze()});
function updateTradeLabels(){
 const l=$('leftTradeLabel'),r=$('rightTradeLabel'),lr=$('leftRule'),rr=$('rightRule');
 if(state.contract==='RISEFALL'){l.textContent='RISE';r.textContent='FALL';lr.textContent='Price goes up';rr.textContent='Price goes down'}
 else if(state.contract==='EVENODD'){l.textContent='EVEN';r.textContent='ODD';lr.textContent='0, 2, 4, 6, 8';rr.textContent='1, 3, 5, 7, 9'}
 else {l.textContent='OVER';r.textContent='UNDER';lr.textContent='Digits 4 - 9';rr.textContent='Digits 0 - 3'}
}
$('market').onchange=e=>{state.symbol=e.target.value;state.prices=[];state.digits=Array(10).fill(0);try{state.ws.close()}catch(_){}connect()};
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>setStake(state.stake+Number(b.dataset.delta)));
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>setStake(Number(b.dataset.stake)));
$('place').onclick=()=>{
 const signal=ui.direction.textContent;
 if(signal==='OVER'||signal==='RISE'||signal==='EVEN') startDemoTrade('left');
 else if(signal==='UNDER'||signal==='FALL'||signal==='ODD') startDemoTrade('right');
 else toast('AI says WAIT — no demo trade placed.');
};
$('over').onclick=()=>startDemoTrade('left');
$('under').onclick=()=>startDemoTrade('right');
$('reset').onclick=()=>{state.balance=10000;state.pending=null;state.stats={trades:0,wins:0,losses:0};ui.balance.textContent='$10,000.00';updateStats();toast('Demo balance reset.')};
$('analyze').onclick=()=>{analyze();toast('Analysis refreshed.')};
if(ui.connect)ui.connect.onclick=()=>{if(auth.token)connectDerivAccount();else startDerivOAuth()};
setStake(5);updateTradeLabels();updateStats();connect();
finishDerivOAuth();
refreshDerivSession();
})();
