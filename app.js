(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={ws:null,symbol:'1HZ100V',prices:[],digits:Array(10).fill(0),stake:5,contract:'OVERUNDER',balance:10000,reconnect:null,pending:null,stats:{trades:0,wins:0,losses:0}};
const ui={price:$('price'),digit:$('digitBig'),confidence:$('confidence'),direction:$('direction'),aiReason:$('aiReason'),grid:$('digitGrid'),strongest:$('strongestDigit'),strongestPct:$('strongestPct'),connection:$('connection'),balance:$('balance'),payout:$('payout'),stake:$('stake')};
const feeds=['wss://api.derivws.com/trading/v1/options/ws/public','wss://ws.binaryws.com/websockets/v3'];
let feedIndex=0;

function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function digit(n){const s=String(n);const m=s.replace(/\D/g,'');return m?Number(m[m.length-1]):null}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function setConn(t,ok=false){ui.connection.textContent='● '+t;ui.connection.style.color=ok?'#2ce795':'#ffc857'}

function analyze(){
 if(state.prices.length<8)return;
 const p=state.prices.slice(-30),a=p[0],b=p.at(-1),delta=b-a,half=Math.max(2,Math.floor(p.length/2));
 const av1=p.slice(0,half).reduce((s,v)=>s+v,0)/half,av2=p.slice(-half).reduce((s,v)=>s+v,0)/half;
 const bull=delta>0&&av2>=av1,bear=delta<0&&av2<=av1;
 let result;
 if(typeof analyzeAISignal==='function'){
   const ds=p.map(digit).filter(d=>d!==null);
   result=analyzeAISignal(ds);
 }
 const dir=result?.direction || (bull?'OVER':bear?'UNDER':'WAIT');
 const conf=result?.confidence ?? Math.min(95,Math.max(55,Math.round(55+Math.min(40,Math.abs(delta/Math.max(a,1))*100000*6))));
 let display=dir;
 if(state.contract==='RISEFALL') display=bull?'RISE':bear?'FALL':'WAIT';
 else if(state.contract==='EVENODD') display='DIGIT '+(mostEven()?'EVEN':'ODD');
 ui.direction.textContent=display;
 ui.confidence.textContent=conf+'%';
 if(ui.aiReason) ui.aiReason.textContent=result ? result.reason : 'Waiting for live market data';
 updateDigits();
}
function mostEven(){let e=0,o=0;for(let i=0;i<10;i++){if(i%2)o+=state.digits[i];else e+=state.digits[i]}return e>=o}
function updateDigits(){
 const ds=state.prices.slice(-30).map(digit).filter(d=>d!==null);
 if(!ds.length)return;
 const weights=Array(10).fill(0);
 ds.forEach((d,i)=>{weights[d]+=1+(i/Math.max(1,ds.length-1))*1.5});
 const total=weights.reduce((a,b)=>a+b,0);
 const probs=weights.map(n=>n/total*100),hi=probs.indexOf(Math.max(...probs));
 ui.grid.innerHTML=probs.map((v,i)=>`<div class="digit ${i===hi?'high':''}"><b>${i}</b><small>${v.toFixed(1)}%</small></div>`).join('');
 ui.strongest.textContent=hi;ui.strongestPct.textContent='('+probs[hi].toFixed(1)+'%)';ui.digit.textContent=hi;
}
function onTick(t){
 const q=Number(t.quote);if(!Number.isFinite(q))return;
 state.prices.push(q);if(state.prices.length>120)state.prices.shift();
 const d=digit(q);if(d!==null)state.digits[d]++;
 ui.price.textContent=fmt(q);ui.digit.textContent=d===null?'—':d;analyze();settleDemoTrade(q);
}
function subscribe(ws){ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));ws.send(JSON.stringify({ticks_history:state.symbol,count:80,end:'latest',style:'ticks',req_id:3}));}
function connect(){
 clearTimeout(state.reconnect);setConn('Connecting…');const ws=new WebSocket(feeds[feedIndex]);state.ws=ws;let opened=false;
 ws.onopen=()=>{opened=true;setConn('Live market connected',true);subscribe(ws)};
 ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.error){if(!opened&&feedIndex<feeds.length-1){feedIndex++;ws.close();connect()}return}
  if(d.msg_type==='history'&&d.history?.prices){state.prices=d.history.prices.map(Number).filter(Number.isFinite).slice(-120);state.digits=Array(10).fill(0);state.prices.forEach(v=>{const z=digit(v);if(z!==null)state.digits[z]++});analyze()}
  if(d.msg_type==='tick'&&d.tick)onTick(d.tick);
 }catch(_){}};
 ws.onerror=()=>{if(!opened&&feedIndex<feeds.length-1){feedIndex++;try{ws.close()}catch(_){}connect()}else setConn('Connection error')};
 ws.onclose=()=>{if(opened){setConn('Reconnecting…');state.reconnect=setTimeout(connect,3000)}};
}

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
 const ds=state.prices.slice(-30).map(digit).filter(d=>d!==null);
 const ai=typeof analyzeAISignal==='function'?analyzeAISignal(ds):null;
 if(ai?.direction==='OVER') startDemoTrade('left');
 else if(ai?.direction==='UNDER') startDemoTrade('right');
 else toast('AI says WAIT — no demo trade placed.');
};
$('over').onclick=()=>startDemoTrade('left');
$('under').onclick=()=>startDemoTrade('right');
$('reset').onclick=()=>{state.balance=10000;state.pending=null;state.stats={trades:0,wins:0,losses:0};ui.balance.textContent='$10,000.00';updateStats();toast('Demo balance reset.')};
$('analyze').onclick=()=>{analyze();toast('Analysis refreshed.')};
setStake(5);updateTradeLabels();updateStats();connect();
})();