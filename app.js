(() => {
'use strict';

const $ = id => document.getElementById(id);
const state = {
  ws:null, symbol:'1HZ100V', prices:[], digits:Array(10).fill(0),
  stake:0.25, contract:'OVERUNDER', balance:10000, sessionNet:0,
  wins:0, losses:0, pending:null, stopped:false, autoSide:null, autoTimer:null, reconnect:null
};
const feeds=['wss://api.derivws.com/trading/v1/options/ws/public','wss://ws.binaryws.com/websockets/v3'];

const ui={
  price:$('price'), digit:$('digitBig'), confidence:$('confidence'),
  direction:$('direction'), grid:$('digitGrid'), strongest:$('strongestDigit'),
  strongestPct:$('strongestPct'), connection:$('connection'), balance:$('balance'),
  stake:$('stake'), payout:$('payout'), canvas:$('chartCanvas')
};

function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
function fmt(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
function lastDigit(n){const s=String(n);const m=s.replace(/\D/g,'');return m?Number(m.at(-1)):null}
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

function onTick(t){
  const q=Number(t.quote);if(!Number.isFinite(q))return;
  state.prices.push(q);if(state.prices.length>120)state.prices.shift();
  const d=lastDigit(q);if(d!==null)state.digits[d]++;
  ui.price.textContent=fmt(q);
  $('tickCount').textContent=state.prices.length+' ticks';
  updateDigits();updateAnalysis();drawChart();settleDemo(q);
}

function loadHistory(h){
  if(!h)return;
  state.prices=h.map(Number).filter(Number.isFinite).slice(-100);
  state.digits=Array(10).fill(0);
  state.prices.forEach(v=>{const d=lastDigit(v);if(d!==null)state.digits[d]++});
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
  if(state.stopped){toast('Trading is stopped. Press STOP again to resume.');return}
  if(state.pending){toast('Wait for the current demo trade to settle.');return}
  if(state.balance<state.stake){toast('Demo balance is too low.');return}
  state.balance-=state.stake;
  state.pending={side,entry:state.prices.at(-1),stake:state.stake,contract:state.contract};
  if(state.autoSide===null) state.autoSide=side;
  ui.balance.textContent='$'+fmt(state.balance);
  toast('Demo '+(side==='left'?$('leftTradeLabel').textContent:$('rightTradeLabel').textContent)+' placed');
}

function settleDemo(price){
  const t=state.pending;if(!t)return;
  const d=lastDigit(price);let win=false;
  if(t.contract==='OVERUNDER')win=t.side==='left'?d>=4:d<=3;
  else if(t.contract==='EVENODD')win=t.side==='left'?d%2===0:d%2===1;
  else win=t.side==='left'?price>t.entry:price<t.entry;
  state.pending=null;
  if(win){
    const payout=t.stake*1.95;state.balance+=payout;state.sessionNet+=payout-t.stake;state.wins++;
    toast('Demo WIN +$'+(payout-t.stake).toFixed(2));
  }else{state.sessionNet-=t.stake;state.losses++;toast('Demo LOSS -$'+t.stake.toFixed(2))}
  ui.balance.textContent='$'+fmt(state.balance);
  $('sessionNet').textContent=(state.sessionNet>=0?'+$':'-$')+Math.abs(state.sessionNet).toFixed(2);
  $('wins').textContent=state.wins;$('losses').textContent=state.losses;
  checkLimits();
  if(!state.stopped && state.autoSide && !state.pending){
    clearTimeout(state.autoTimer);
    state.autoTimer=setTimeout(()=>startDemo(state.autoSide),250);
  }
}

function checkLimits(){
  const target=Number($('targetProfit').value)||0,stop=Number($('stopLoss').value)||0;
  if(target>0&&state.sessionNet>=target){state.stopped=true;toast('Target profit reached — trading stopped.')}
  if(stop>0&&state.sessionNet<=-stop){state.stopped=true;toast('Stop loss reached — trading stopped.')}
  $('stopTrade').textContent=state.stopped?'▶ RESUME':'■ STOP';
}

$('market').onchange=e=>{state.symbol=e.target.value;state.prices=[];state.digits=Array(10).fill(0);try{state.ws.close()}catch(_){}connect()};
document.querySelectorAll('.contract').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.contract').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  state.contract=b.dataset.contract;updateLabels();updateAnalysis();
});
document.querySelectorAll('[data-delta]').forEach(b=>b.onclick=()=>setStake(state.stake+Number(b.dataset.delta)));
document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>setStake(Number(b.dataset.stake)));
$('over').onclick=()=>{state.autoSide='left';startDemo('left')};$('under').onclick=()=>{state.autoSide='right';startDemo('right')};
$('stopTrade').onclick=()=>{
  state.stopped=!state.stopped;
  if(state.stopped){state.autoSide=null;clearTimeout(state.autoTimer);state.autoTimer=null}
  $('stopTrade').textContent=state.stopped?'▶ RESUME':'■ STOP';
  toast(state.stopped?'Trading stopped':'Trading resumed');
};
$('reset').onclick=()=>{clearTimeout(state.autoTimer);state.autoTimer=null;state.autoSide=null;state.balance=10000;state.sessionNet=0;state.wins=0;state.losses=0;state.pending=null;state.stopped=false;ui.balance.textContent='$10,000.00';$('sessionNet').textContent='$0.00';$('wins').textContent='0';$('losses').textContent='0';$('stopTrade').textContent='■ STOP';toast('Demo reset')};
window.addEventListener('resize',drawChart);
setStake(.25);updateLabels();connect();
})();