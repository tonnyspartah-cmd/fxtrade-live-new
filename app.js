const $=id=>document.getElementById(id);
let balance=0,wins=0,losses=0,history=[],digits=[],price=0;
let selected="OVER",auto=false,autoStreak=0,lastTrade=0;
let ws=null, publicWs=null, reqId=10, pending=new Map(), connected=false, account=null;
let accessToken=sessionStorage.getItem("fxtrade_deriv_token")||"";
const PUBLIC_WS="wss://api.derivws.com/trading/v1/options/ws/public";
const symbols={
  "Volatility 100":"1HZ100V","Volatility 75":"1HZ75V","Volatility 50":"1HZ50V","Volatility 25":"1HZ25V","Volatility 10":"1HZ10V"
};
function fmt(n){return (n<0?"-":"")+"$"+Math.abs(Number(n)||0).toFixed(2)}
function render(){
  $("balance").textContent=fmt(balance);
  const pl=history.reduce((s,x)=>s+Number(x.result||0),0);
  $("pl").textContent=fmt(pl);$("pl").className=pl>=0?"win":"loss";
  $("wins").textContent=wins;$('losses').textContent=losses;
  $("winrate").textContent=(wins+losses?((wins/(wins+losses))*100).toFixed(1):0)+"%";
  $("targetView").textContent=fmt(Number($("target").value));
  $("stopView").textContent="-"+fmt(Number($("stop").value)).replace("-","");
}
function setStatus(text,live=false){$("marketState").textContent=text;$("marketState").className="pill "+(live?"live":"");}
function showMsg(t){$("lastResult").textContent=t}
function addDigit(d){
  d=Number(d); if(!Number.isInteger(d)||d<0||d>9)return;
  digits.push(d);if(digits.length>120)digits.shift();$("lastDigit").textContent=d;
  const el=$("digits");el.innerHTML="";let counts=Array(10).fill(0);digits.forEach(x=>counts[x]++);let total=digits.length||1;
  for(let i=0;i<10;i++){let div=document.createElement("div");div.className="digit"+(i===d?" hot":"");div.innerHTML=`<i>${i}</i>${(counts[i]/total*100).toFixed(1)}%`;el.appendChild(div)}
  const barrier=Number($("barrier").value);
  const match=selected==="OVER"?d>barrier:selected==="UNDER"?d<barrier:selected==="EVEN"?d%2===0:d%2===1;
  autoStreak=match?autoStreak+1:0;
  if(auto && autoStreak>=Number($("triggerCount").textContent) && Date.now()-lastTrade>1400) placeTrade(true);
}
function digitFromQuote(q){
  const s=String(q); const parts=s.split('.'); const decimals=parts[1]||""; return Number((decimals.slice(-1)||s.slice(-1)).replace(/\D/g,''))%10;
}
function connectPublic(){
  if(publicWs&&publicWs.readyState<=1)return;
  publicWs=new WebSocket(PUBLIC_WS);
  publicWs.onopen=()=>{setStatus("● LIVE MARKET",true); subscribeTicks();};
  publicWs.onmessage=e=>{try{const m=JSON.parse(e.data); if(m.msg_type==="tick"){price=Number(m.tick.quote);$("price").textContent=price.toFixed(2);addDigit(digitFromQuote(m.tick.quote));draw();}}catch{}};
  publicWs.onclose=()=>setStatus("● MARKET OFFLINE",false);
  publicWs.onerror=()=>setStatus("● MARKET ERROR",false);
}
function subscribeTicks(){const symbol=symbols[$("market").value]||"1HZ100V"; publicWs.send(JSON.stringify({ticks:symbol,subscribe:1,req_id:1}));}
async function api(path,opts={}){const r=await fetch(path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{}),...(accessToken?{"Authorization":"Bearer "+accessToken}: {})}});const data=await r.json().catch(()=>({error:"Invalid response"}));if(!r.ok)throw new Error(data?.errors?.[0]?.message||data.error||`HTTP ${r.status}`);return data}
async function loadAccounts(){const data=await api('/api/deriv/accounts');const accounts=data.data||[];account=accounts.find(x=>x.account_type==="demo")||accounts[0];if(!account)throw Error("No Deriv Options account found"); balance=Number(account.balance||0); $("accountBadge").textContent=`CONNECTED • ${account.account_type.toUpperCase()}`; render(); await connectAuthenticated(account.account_id);}
async function connectAuthenticated(accountId){const data=await api(`/api/deriv/otp?account_id=${encodeURIComponent(accountId)}`,{method:'POST'});const url=data?.data?.url;if(!url)throw Error('Deriv did not return a WebSocket URL');
  if(ws)try{ws.close()}catch{}
  ws=new WebSocket(url);
  ws.onopen=()=>{connected=true;ws.send(JSON.stringify({balance:1,subscribe:1,req_id:++reqId}));};
  ws.onmessage=e=>handleWs(JSON.parse(e.data));
  ws.onclose=()=>{connected=false;$("accountBadge").textContent="DISCONNECTED"};
  ws.onerror=()=>showMsg("Deriv connection error");
}
function handleWs(m){
  if(m.error){showMsg(m.error.message||"Deriv error"); const p=pending.get(m.req_id); if(p){p.reject(new Error(m.error.message));pending.delete(m.req_id)} return;}
  if(m.msg_type==="balance"){balance=Number(m.balance.balance);render();}
  if(m.msg_type==="proposal" && pending.has(m.req_id)){const p=pending.get(m.req_id);pending.delete(m.req_id);p.resolve(m.proposal)}
  if(m.msg_type==="buy" && pending.has(m.req_id)){const p=pending.get(m.req_id);pending.delete(m.req_id);p.resolve(m.buy)}
  if(m.msg_type==="proposal_open_contract"){
    const c=m.proposal_open_contract; if(c.is_sold){const result=Number(c.profit||0);if(result>=0)wins++;else losses++;history.unshift({time:new Date().toLocaleTimeString(),type:selected,d:Number($("lastDigit").textContent),stake:Number($("stake").value),result});$("openTrade").textContent="None";$("lastResult").innerHTML=`<span class="${result>=0?'win':'loss'}">${result>=0?'WIN ':'LOSS '}${fmt(result)}</span>`;render();renderHistory();checkStops();}
    else if(c.profit!=null){$("openTrade").textContent=fmt(c.profit);$("lastResult").textContent=`Open P/L ${fmt(c.profit)}`;}
  }
}
function req(payload){return new Promise((resolve,reject)=>{if(!ws||ws.readyState!==1)return reject(Error("Connect Deriv first"));const id=++reqId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({...payload,req_id:id}));setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error("Deriv request timed out"))}},10000)})}
function contractType(){return selected==="OVER"?"DIGITOVER":selected==="UNDER"?"DIGITUNDER":selected==="EVEN"?"DIGITEVEN":"DIGITODD"}
async function placeTrade(fromAuto=false){
  if(!connected){showMsg("Connect Deriv first");return}
  const stake=Math.max(.1,Number($("stake").value)); if(!stake)return;
  lastTrade=Date.now();autoStreak=0;$("openTrade").textContent=fmt(-stake);showMsg("Requesting proposal…");
  try{
    const payload={proposal:1,amount:stake,basis:"stake",contract_type:contractType(),currency:account?.currency||"USD",duration:1,duration_unit:"t",underlying_symbol:symbols[$("market").value]||"1HZ100V"};
    if(selected==="OVER"||selected==="UNDER")payload.barrier=String(Number($("barrier").value));
    const prop=await req(payload); const buy=await req({buy:String(prop.id),price:Number(prop.ask_price)});
    $("openTrade").textContent=fmt(stake);showMsg(`LIVE CONTRACT ${buy.contract_id}`);
    await req({proposal_open_contract:1,contract_id:Number(buy.contract_id),subscribe:1});
  }catch(e){$("openTrade").textContent="None";showMsg(e.message||"Trade failed")}
}
function checkStops(){const pl=history.reduce((s,x)=>s+Number(x.result||0),0);if(pl>=Number($("target").value)||pl<=-Number($("stop").value)){auto=false;$("autoBadge").textContent="AUTO OFF";$("autoBtn").textContent="START AUTO";showMsg("Auto stopped by target/stop");}}
function renderHistory(){let h=$("history");h.innerHTML=history.length?history.slice(0,12).map(x=>`<div class="trade-row"><span>${x.time}</span><span>${x.type} • ${x.d}</span><span>${fmt(x.stake)}</span><span class="${x.result>=0?'win':'loss'}">${fmt(x.result)}</span></div>`).join(""):'<div class="empty">No completed trades yet.</div>'}
const canvas=$("chart"),ctx=canvas.getContext("2d"),points=[];function draw(){points.push(price);if(points.length>70)points.shift();if(!points.length)return;ctx.clearRect(0,0,canvas.width,canvas.height);let min=Math.min(...points),max=Math.max(...points),range=max-min||1;ctx.beginPath();points.forEach((p,i)=>{let x=i*(canvas.width/69),y=160-((p-min)/range)*135;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#35d9aa";ctx.lineWidth=2;ctx.stroke()}
$("contractTabs").onclick=e=>{if(!e.target.dataset.type)return;selected=e.target.dataset.type;document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===e.target));autoStreak=0};
$("tradeBtn").onclick=()=>placeTrade(false);
$("autoBtn").onclick=()=>{auto=!auto;$("autoBadge").textContent=auto?"AUTO ON":"AUTO OFF";$("autoBtn").textContent=auto?"STOP AUTO":"START AUTO";autoStreak=0};
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>$("stake").value=b.dataset.stake);
$("target").oninput=render;$("stop").oninput=render;
$("market").onchange=()=>{if(publicWs?.readyState===1)subscribeTicks();$("symbolTitle").textContent="Synthetic "+$("market").value};
$("scanBtn").onclick=()=>{const recent=digits.slice(-20);if(!recent.length){showMsg("Waiting for live ticks");return}const over=recent.filter(d=>d>Number($("barrier").value)).length;const sig=over/recent.length>=.5?"OVER":"UNDER";$("signal").textContent=sig;$("pattern").textContent=`${over}/${recent.length} digits over barrier`;$("strength").textContent=(Math.max(over,recent.length-over)/recent.length*100).toFixed(0)+"%"};
$("connectBtn").onclick=async()=>{try{if(accessToken){await loadAccounts();return} const c=await api('/api/config');if(!c.client_id)throw Error('Deriv OAuth client_id is not configured on this deployment');const verifier=crypto.randomUUID()+crypto.randomUUID();const state=crypto.randomUUID();const enc=new TextEncoder();const hash=await crypto.subtle.digest('SHA-256',enc.encode(verifier));const b64=btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');sessionStorage.setItem('fxtrade_pkce_verifier',verifier);sessionStorage.setItem('fxtrade_oauth_state',state);const redirect=location.origin+'/oauth-callback.html';const u=new URL('https://auth.deriv.com/oauth2/auth');u.searchParams.set('response_type','code');u.searchParams.set('client_id',c.client_id);u.searchParams.set('redirect_uri',redirect);u.searchParams.set('scope','trade');u.searchParams.set('state',state);u.searchParams.set('code_challenge',b64);u.searchParams.set('code_challenge_method','S256');location.href=u.toString();}catch(e){showMsg(e.message)}};
$("resetBtn").onclick=()=>{if(accessToken&&account?.account_type==='demo')api(`/api/deriv/reset?account_id=${encodeURIComponent(account.account_id)}`,{method:'POST'}).then(loadAccounts).catch(e=>showMsg(e.message));else{history=[];wins=losses=0;renderHistory();render()}};
$("clearBtn").onclick=()=>{history=[];renderHistory();render()};
render();connectPublic();
if(accessToken){loadAccounts().catch(e=>{sessionStorage.removeItem('fxtrade_deriv_token');accessToken='';$("accountBadge").textContent='NOT CONNECTED';showMsg(e.message)})}
