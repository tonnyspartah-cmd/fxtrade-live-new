const $=id=>document.getElementById(id);
let balance=1000, startBalance=1000,wins=0,losses=0,history=[],digits=[],price=100000;
let selected="OVER", auto=false, autoStreak=0, scan=false, lastTrade=0;
const payout=.82;
function fmt(n){return (n<0?"-":"")+"$"+Math.abs(n).toFixed(2)}
function render(){
 $("balance").textContent=fmt(balance); const pl=balance-startBalance;
 $("pl").textContent=fmt(pl); $("pl").className=pl>=0?"win":"loss";
 $("wins").textContent=wins;$("losses").textContent=losses;
 $("winrate").textContent=(wins+losses?((wins/(wins+losses))*100).toFixed(1):0)+"%";
 $("targetView").textContent=fmt(Number($("target").value));$("stopView").textContent="-"+fmt(Number($("stop").value)).replace("-","");
}
function addDigit(d){
 digits.push(d);if(digits.length>60)digits.shift();$("lastDigit").textContent=d;
 const el=$("digits");el.innerHTML="";
 let counts=Array(10).fill(0);digits.forEach(x=>counts[x]++);
 let total=digits.length||1;
 for(let i=0;i<10;i++){let div=document.createElement("div");div.className="digit"+(i===d?" hot":"");div.innerHTML=`<i>${i}</i>${(counts[i]/total*100).toFixed(1)}%`;el.appendChild(div)}
 if(selected==="OVER" && d>Number($("barrier").value)) autoStreak++; else if(selected==="UNDER" && d<Number($("barrier").value)) autoStreak++; else if(selected==="EVEN" && d%2===0) autoStreak++; else if(selected==="ODD" && d%2===1) autoStreak++; else autoStreak=0;
 if(auto && autoStreak>=Number($("triggerCount").textContent) && Date.now()-lastTrade>1300) placeTrade(true);
}
function updateAISignal(){
 const result=analyzeAISignal(digits);
 $("signal").textContent=result.direction;
 $("strength").textContent=result.confidence ? `${result.strength} ${result.confidence}%` : "WAIT";
 $("pattern").textContent=result.reason || "Waiting for more tick data";
}
function tick(){
 price += (Math.random()-.5)*900; if(price<1000)price=1000;
 $("price").textContent=price.toFixed(2);addDigit(Math.floor(Math.random()*10));draw();updateAISignal();
}
const canvas=$("chart"),ctx=canvas.getContext("2d"),points=[];
function draw(){points.push(price);if(points.length>70)points.shift();ctx.clearRect(0,0,canvas.width,canvas.height);let min=Math.min(...points),max=Math.max(...points),range=max-min||1;ctx.beginPath();points.forEach((p,i)=>{let x=i*(canvas.width/69),y=160-((p-min)/range)*135;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#35d9aa";ctx.lineWidth=2;ctx.stroke()}
function placeTrade(fromAuto=false){
 let stake=Math.max(.1,Number($("stake").value));if(stake>balance){$("lastResult").textContent="Insufficient demo balance";return}
 lastTrade=Date.now();autoStreak=0;balance-=stake;$("openTrade").textContent=fmt(stake);
 setTimeout(()=>{let d=Number($("lastDigit").textContent),win;
 if(selected==="OVER")win=d>Number($("barrier").value); else if(selected==="UNDER")win=d<Number($("barrier").value); else if(selected==="EVEN")win=d%2===0; else win=d%2===1;
 let result=win?stake*payout:-stake;balance+=stake+result;
 if(win)wins++;else losses++; history.unshift({time:new Date().toLocaleTimeString(),type:selected,d,stake,result});
 $("lastResult").innerHTML=`<span class="${win?"win":"loss"}">${win?"WIN ":"LOSS "}${fmt(result)}</span>`;$("openTrade").textContent="None";render();renderHistory();
 if(balance-startBalance>=Number($("target").value)||balance-startBalance<=-Number($("stop").value)){auto=false;$("autoBadge").textContent="AUTO OFF";$("autoBtn").textContent="START AUTO";}
 },550);
}
function renderHistory(){let h=$("history");h.innerHTML=history.length?history.slice(0,12).map(x=>`<div class="trade-row"><span>${x.time}</span><span>${x.type} • ${x.d}</span><span>${fmt(x.stake)}</span><span class="${x.result>=0?"win":"loss"}">${fmt(x.result)}</span></div>`).join(""):'<div class="empty">No trades yet. Start with a demo trade.</div>'}
$("contractTabs").onclick=e=>{if(!e.target.dataset.type)return;selected=e.target.dataset.type;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===e.target));autoStreak=0};
$("tradeBtn").onclick=()=>placeTrade(false);
$("autoBtn").onclick=()=>{auto=!auto;$("autoBadge").textContent=auto?"AUTO ON":"AUTO OFF";$("autoBtn").textContent=auto?"STOP AUTO":"START AUTO";autoStreak=0};
$("scanBtn").onclick=()=>{scan=true;$("scanState").querySelector("b").textContent="Scanning live simulation…";$("signal").textContent="ANALYZING";setTimeout(()=>{$("scanState").querySelector("b").textContent="Scan complete";let recent=digits.slice(-12),avg=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:5;let sig=avg>=5?"OVER":"UNDER";$("signal").textContent=sig;$("pattern").textContent=avg>=5?"Higher recent digits":"Lower recent digits";$("strength").textContent=(55+Math.random()*35).toFixed(0)+"%";},900)};
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>{$("stake").value=b.dataset.stake});
$("target").oninput=render;$("stop").oninput=render;
$("resetBtn").onclick=()=>{balance=1000;startBalance=1000;wins=losses=0;history=[];renderHistory();render()};
$("clearBtn").onclick=()=>{history=[];renderHistory()};
$("market").onchange=e=>$("symbolTitle").textContent="Synthetic "+e.target.value;
render();setInterval(tick,700);