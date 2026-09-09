(() => {
'use strict';
const $=id=>document.getElementById(id);
const state={ws:null,symbol:'1HZ100V',prices:[],digits:Array(10).fill(0),stake:5,contract:'OVERUNDER',balance:10000,reconnect:null};
const ui={price:$('price'),digit:$('digitBig'),confidence:$('confidence'),direction:$('direction'),grid:$('digitGrid'),strongest:$('strongestDigit'),strongestPct:$('strongestPct'),chart:$('chart'),connection:$('connection'),balance:$('balance'),payout:$('payout'),stake:$('stake')};
const feeds=['wss://api.derivws.com/trading/v1/options/ws/public','wss://ws.binaryws.com/websockets/v3'];
let feedIndex=0;

function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function digit(n){const s=String(n);const m=s.replace(/\D/g,'');return m?Number(m[m.length-1]):null}
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function setConn(t,ok=false){ui.connection.textContent='● '+t;ui.connection.style.color=ok?'#2ce795':'#ffc857'}

function drawChart(){
 const c=ui.chart,r=c.getBoundingClientRect();if(!r.width)return;
 const d=devicePixelRatio||1,w=r.width,h=300;c.width=w*d;c.height=h*d;const x=c.getContext('2d');x.scale(d,d);
 x.clearRect(0,0,w,h);x.strokeStyle='#0e2b43';x.lineWidth=1;
 for(let i=1;i<6;i++){let y=i*h/6;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}
 for(let i=1;i<10;i++){let xx=i*w/10;x.beginPath();x.moveTo(xx,0);x.lineTo(xx,h);x.stroke()}
 const vals=state.prices.slice(-80);if(vals.length<2)return;
 const min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,1e-8);
 x.beginPath();vals.forEach((v,i)=>{const px=i*w/(vals.length-1),py=h-18-(v-min)/range*(h-36);i?x.lineTo(px,py):x.moveTo(px,py)});
 x.strokeStyle='#159fff';x.lineWidth=2.5;x.stroke();
 const v=vals.at(-1),py=h-18-(v-min)/range*(h-36);
 x.fillStyle='#159fff';x.beginPath();x.arc(w-2,py,4,0,Math.PI*2);x.fill();
}

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
 ui.price.textContent=fmt(q);ui.digit.textContent=d===null?'—':d;drawChart();analyze();
}
function subscribe(ws){ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));ws.send(JSON.stringify({ticks_history:state.symbol,count:80,end:'latest',style:'ticks',req_id:3}));}
function connect(){
 clearTimeout(state.reconnect);setConn('Connecting…');const ws=new WebSocket(feeds[feedIndex]);state.ws=ws;let opened=false;
 ws.onopen=()=>{opened=true;setConn('Live market connected',true);subscribe(ws)};
 ws.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.error){if(!opened&&feedIndex<feeds.length-1){feedIndex++;ws.close();connect()}return}
  if(d.msg_type==='history'&&d.history?.prices){state.prices=d.history.prices.map(Number).filter(Number.isFinite).slice(-120);state.digits=Array(10).fill(0);state.prices.forEach(v=>{const z=digit(v);if(z!==null)state.digits[z]++});drawChart();analyze()}
  if(d.msg_type==='tick'&&d.tick)onTick(d.tick);
 }catch(_){}};
 ws.onerror=()=>{if(!opened&&feedIndex<feeds.length-1){feedIndex++;try{ws.close()}catch(_){}connect()}else setConn('Connection error')};
 ws.onclose=()=>{if(opened){setConn('Reconnecting…');state.reconnect=setTimeout(connect,3000)}};
}

function setStake(v){state.stake=Math.max(1,Math.min(100,v));ui.stake.textContent=state.stake;ui.payout.textContent='$'+(state.stake*1.96).toFixed(2)}
document.querySelectorAll('.contract').forEach(b=>b.onclick=()=>{document.querySelectorAll('.contract').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.contract=b.dataset.contract;updateTradeLabels();analyze()});
function updateTradeLabels(){
 const l=$('leftTradeLabel'),r=$('rightTradeLabel'),lr=$('leftRule'),rr=$('rightRule');
 if(state.contract==='RISEFALL'){l.textContent='RISE';r.textContent='FALL';lr.textContent='Price goes up';rr.textContent='Price goes down'}
 else if(state.contract==='EVENODD'){l.textContent='EVEN';r.textContent='ODD';lr.textContent='0, 2, 4, 6, 8';rr.textContent='1, 3, 5, 7, 9'}
 else {l.textContent='OVER';r.textContent='UNDER';lr.textContent='Digits 4 - 9';rr.textContent='Digits 0 - 3'}
}
$('market').onchange=e=>{state.symbol=e.target.value;state.prices=[];state.digits=Array(10).fill(0);$('chartMarket').textContent=e.target.options[e.target.selectedIndex].text;try{state.ws.close()}catch(_){}connect()};
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>setStake(state.stake+Number(b.dataset.delta)));
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>setStake(Number(b.dataset.stake)));
$('place').onclick=()=>{if(state.balance>=state.stake){state.balance-=state.stake;ui.balance.textContent='$'+state.balance.toFixed(2);toast('Demo trade placed — no real money used.')}else toast('Demo balance is too low.')};
$('reset').onclick=()=>{state.balance=10000;ui.balance.textContent='$10,000.00';toast('Demo balance reset.')};
$('analyze').onclick=()=>{analyze();toast('Analysis refreshed.')};
window.addEventListener('resize',drawChart);
setStake(5);updateTradeLabels();connect();
})();