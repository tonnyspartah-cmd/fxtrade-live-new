const $=id=>document.getElementById(id);
const STORAGE='fxtrade_standalone_v24';
let state=JSON.parse(localStorage.getItem(STORAGE)||'null')||{balance:1000,wins:0,losses:0,history:[],digits:[],price:100000,selected:'OVER',auto:false,streak:0,lastTrade:0,target:50,stop:30,stake:5,barrier:3};
let timer=null,points=[];
const markets={
 'Volatility 100':{base:100000,step:140},'Volatility 75':{base:75000,step:120},'Volatility 50':{base:50000,step:100},'Volatility 25':{base:25000,step:80},'Volatility 10':{base:10000,step:55}
};
function save(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function fmt(n){return (n<0?'-':'')+'$'+Math.abs(Number(n)||0).toFixed(2)}
function pnl(){return state.history.reduce((s,x)=>s+Number(x.result||0),0)}
function render(){
 $('balance').textContent=fmt(state.balance);const p=pnl();$('pl').textContent=fmt(p);$('pl').className=p>=0?'win':'loss';
 $('wins').textContent=state.wins;$('losses').textContent=state.losses;$('winrate').textContent=(state.wins+state.losses?state.wins/(state.wins+state.losses)*100:0).toFixed(1)+'%';
 $('targetView').textContent=fmt(state.target);$('stopView').textContent='-'+fmt(state.stop).replace('-','');$('stake').value=state.stake;$('barrier').value=state.barrier;$('target').value=state.target;$('stop').value=state.stop;
 $('autoBadge').textContent=state.auto?'AUTO ON':'AUTO OFF';$('autoBtn').textContent=state.auto?'STOP AUTO':'START AUTO';
}
function msg(t){$('lastResult').textContent=t}
function status(t,live=true){$('marketState').textContent=t;$('marketState').className='pill '+(live?'live':'')}
function currentMarket(){return markets[$('market').value]||markets['Volatility 100']}
function nextTick(){
 const m=currentMarket();
 // Standalone synthetic price engine: a bounded random walk with momentum.
 const drift=(Math.random()-.5)*m.step; const mean=(m.base-state.price)*0.003;
 state.price=Math.max(m.base*.8,Math.min(m.base*1.2,state.price+drift+mean));
 const raw=state.price.toFixed(2); const digit=Number(raw.replace(/\D/g,'').slice(-1));
 $('price').textContent=Number(state.price).toFixed(2);addDigit(digit);points.push(state.price);if(points.length>70)points.shift();draw();
}
function addDigit(d){
 state.digits.push(d);if(state.digits.length>120)state.digits.shift();$('lastDigit').textContent=d;
 const counts=Array(10).fill(0);state.digits.forEach(x=>counts[x]++);const total=state.digits.length||1;$('digits').innerHTML='';
 for(let i=0;i<10;i++){const div=document.createElement('div');div.className='digit'+(i===d?' hot':'');div.innerHTML=`<i>${i}</i>${(counts[i]/total*100).toFixed(1)}%`;$('digits').appendChild(div)}
 const b=Number(state.barrier);const match=state.selected==='OVER'?d>b:state.selected==='UNDER'?d<b:state.selected==='EVEN'?d%2===0:d%2===1;
 state.streak=match?state.streak+1:0;
 if(state.auto&&state.streak>=3&&Date.now()-state.lastTrade>1400)placeTrade(true);
 save();
}
function winsFor(type,d,b){return type==='OVER'?d>b:type==='UNDER'?d<b:type==='EVEN'?d%2===0:d%2===1}
function placeTrade(auto=false){
 const stake=Math.max(.1,Number($('stake').value)||0);if(stake>state.balance){msg('Insufficient demo balance');state.auto=false;render();return}
 state.stake=stake;state.barrier=Number($('barrier').value);state.target=Number($('target').value);state.stop=Number($('stop').value);state.lastTrade=Date.now();state.streak=0;
 const d=Number($('lastDigit').textContent);const win=winsFor(state.selected,d,state.barrier);const profit=win?stake*.82:-stake;
 state.balance+=profit;state.wins+=win?1:0;state.losses+=win?0:1;
 state.history.unshift({time:new Date().toLocaleTimeString(),type:state.selected,digit:d,stake,result:profit,win});
 $('openTrade').textContent='Settled';msg(`${win?'WIN':'LOSS'} ${fmt(profit)} • digit ${d}`);renderHistory();render();checkStops();save();
}
function checkStops(){const p=pnl();if(p>=state.target){state.auto=false;msg('Auto stopped: Target Profit reached')}else if(p<=-state.stop){state.auto=false;msg('Auto stopped: Stop Loss reached')}render()}
function renderHistory(){$('history').innerHTML=state.history.length?state.history.slice(0,12).map(x=>`<div class="trade-row"><span>${x.time}</span><span>${x.type} • ${x.digit}</span><span>${fmt(x.stake)}</span><span class="${x.result>=0?'win':'loss'}">${fmt(x.result)}</span></div>`).join(''):'<div class="empty">No completed trades yet.</div>'}
const canvas=$('chart'),ctx=canvas.getContext('2d');function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);if(points.length<2)return;let min=Math.min(...points),max=Math.max(...points),range=max-min||1;ctx.beginPath();points.forEach((p,i)=>{const x=i*(canvas.width/69),y=160-((p-min)/range)*135;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle='#35d9aa';ctx.lineWidth=2;ctx.stroke()}
$('contractTabs').onclick=e=>{if(!e.target.dataset.type)return;state.selected=e.target.dataset.type;state.streak=0;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===e.target));save()};
$('tradeBtn').onclick=()=>placeTrade(false);
$('autoBtn').onclick=()=>{state.auto=!state.auto;state.streak=0;msg(state.auto?'Auto trading started':'Auto trading stopped');render();save()};
document.querySelectorAll('.quick button').forEach(b=>b.onclick=()=>{state.stake=Number(b.dataset.stake);render();save()});
['stake','barrier','target','stop'].forEach(id=>$(id).oninput=()=>{state[id]=Number($(id).value);render();save()});
$('market').onchange=()=>{state.price=currentMarket().base;points=[];$('symbolTitle').textContent='Synthetic '+$('market').value;status('● SIMULATION LIVE',true);save()};
$('scanBtn').onclick=()=>{const recent=state.digits.slice(-20);if(!recent.length){msg('Waiting for synthetic ticks');return}const b=Number(state.barrier),over=recent.filter(d=>d>b).length;const sig=over/recent.length>=.5?'OVER':'UNDER';$('signal').textContent=sig;$('pattern').textContent=`${over}/${recent.length} digits over barrier`;$('strength').textContent=(Math.max(over,recent.length-over)/recent.length*100).toFixed(0)+'%';msg('Scan complete — simulation only')};
$('clearBtn').onclick=()=>{state.history=[];state.wins=state.losses=0;state.balance=1000;state.auto=false;renderHistory();render();save();msg('Session reset')};
$('resetBtn').onclick=()=>{localStorage.removeItem(STORAGE);location.reload()};
$('accountBadge').textContent='STANDALONE • DEMO';status('● SIMULATION LIVE',true);$('symbolTitle').textContent='Synthetic '+$('market').value;render();renderHistory();
for(let i=0;i<20;i++)nextTick();timer=setInterval(nextTick,700);
