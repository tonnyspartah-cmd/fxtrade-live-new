(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { ws:null, symbol:'1HZ100V', prices:[], digits:Array(10).fill(0), stake:5, selected:'OVER', reconnectTimer:null, manual:false };

  const ui = {
    price:$('price'), chartPrice:$('chartPrice'), lastDigit:$('lastDigit'), digitBig:$('digitBig'), trend:$('trend'), momentum:$('momentum'), overUnder:$('overUnder'), confidence:$('confidence'), direction:$('direction'), whyDir:$('whyDir'), whyText:$('whyText'), signalText:$('signalText'), signalSub:$('signalSub'), risk:$('risk'), connection:$('connection'), distribution:$('distribution'), payout:$('payout'), stake:$('stake'), digitGrid:$('digitGrid')
  };

  function showToast(text){const t=$('toast');t.textContent=text;t.classList.add('show');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>t.classList.remove('show'),2600)}
  function setConnection(text, good=false){ui.connection.textContent='● '+text;ui.connection.style.color=good?'#40df8a':'#ffc857'}
  function formatPrice(n){return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
  function lastDigit(n){const s=String(n);const clean=s.replace(/\D/g,'');return clean?clean[clean.length-1]:'—'}

  function drawChart(){
    const c=$('chart'), dpr=devicePixelRatio||1, rect=c.getBoundingClientRect(); if(!rect.width)return;
    c.width=rect.width*dpr;c.height=300*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);const w=rect.width,h=300;
    x.clearRect(0,0,w,h);x.strokeStyle='#10283e';x.lineWidth=1;
    for(let i=1;i<6;i++){const y=i*h/6;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}
    for(let i=1;i<10;i++){const xx=i*w/10;x.beginPath();x.moveTo(xx,0);x.lineTo(xx,h);x.stroke()}
    if(state.prices.length<2)return;
    const vals=state.prices.slice(-80), min=Math.min(...vals),max=Math.max(...vals),range=Math.max(max-min,0.00001);
    x.beginPath();vals.forEach((v,i)=>{const px=i*(w/(vals.length-1)),py=h-18-((v-min)/range)*(h-36);i?x.lineTo(px,py):x.moveTo(px,py)});x.strokeStyle='#28a8ff';x.lineWidth=2;x.stroke();
    const v=vals[vals.length-1],py=h-18-((v-min)/range)*(h-36);x.fillStyle='#39df8a';x.beginPath();x.arc(w-2,py,4,0,Math.PI*2);x.fill();
  }

  function analyze(){
    if(state.prices.length<8){ui.signalText.textContent='WAITING FOR DATA';ui.signalSub.textContent='Collecting live ticks…';return}
    const p=state.prices.slice(-30), first=p[0], last=p[p.length-1], delta=last-first, half=Math.floor(p.length/2), a=p.slice(0,half), b=p.slice(half);
    const avgA=a.reduce((s,v)=>s+v,0)/a.length, avgB=b.reduce((s,v)=>s+v,0)/b.length;
    const bullish=delta>0 && avgB>=avgA, bearish=delta<0 && avgB<=avgA, trend=bullish?'BULLISH':bearish?'BEARISH':'SIDEWAYS';
    const momentum=Math.abs(delta/Math.max(first,1))*100000;
    const mom=momentum>2?'STRONG':momentum>0.8?'MODERATE':'WEAK';
    const confidence=Math.min(95,Math.max(55,Math.round(55+Math.min(40,Math.abs(delta/Math.max(first,1))*100000*6))));
    const dir=bullish?'OVER':bearish?'UNDER':'WAIT';
    ui.trend.textContent=trend;ui.trend.style.color=bullish?'#42df8b':bearish?'#ff657d':'#ffc857';ui.momentum.textContent=mom;ui.overUnder.textContent=dir==='OVER'?'POSSIBLE OVER':dir==='UNDER'?'POSSIBLE UNDER':'NO CLEAR EDGE';ui.confidence.textContent=confidence+'%';ui.direction.textContent=dir;ui.whyDir.textContent=dir;ui.whyDir.style.color=dir==='UNDER'?'#ff657d':dir==='OVER'?'#42df8b':'#ffc857';
    ui.signalText.textContent=dir==='WAIT'?'NO CLEAR SETUP':'SETUP READY';ui.signalSub.textContent=dir==='WAIT'?'Market movement is mixed. Wait for clearer conditions.':'Live price movement matches the current directional setup.';ui.risk.textContent=confidence>=75?'MEDIUM':'HIGH';
    ui.whyText.textContent=bullish?'Recent ticks are rising and the short-window average is above the earlier window.':bearish?'Recent ticks are falling and the short-window average is below the earlier window.':'Recent movement is mixed, so the analyzer is not forcing a direction.';
    updateDigits();
  }

  function updateDigits(){
    const total=state.digits.reduce((a,b)=>a+b,0); if(!total)return;
    const probs=state.digits.map(n=>n/total*100), hi=probs.indexOf(Math.max(...probs)), lo=probs.indexOf(Math.min(...probs));
    ui.digitGrid.innerHTML=probs.map((v,i)=>`<div class="digit ${i===hi?'high':''} ${i===lo?'low':''}"><b>${i}</b><small>${v.toFixed(1)}%</small></div>`).join('');
    ui.distribution.textContent=`Highest: ${hi} (${probs[hi].toFixed(1)}%)  |  Lowest: ${lo} (${probs[lo].toFixed(1)}%)  |  Distribution: Live`;
  }

  function onTick(tick){
    const quote=Number(tick.quote); if(!Number.isFinite(quote))return;
    state.prices.push(quote);if(state.prices.length>120)state.prices.shift();
    const d=Number(lastDigit(quote));if(Number.isInteger(d))state.digits[d]++;
    const p=formatPrice(quote),ld=lastDigit(quote);ui.price.textContent=p;ui.chartPrice.textContent=p;ui.lastDigit.textContent=ld;ui.digitBig.textContent=ld;
    drawChart(); if($('auto').checked)analyze();
  }

  const FEEDS = [
    'wss://api.derivws.com/trading/v1/options/ws/public',
    'wss://ws.binaryws.com/websockets/v3'
  ];
  let feedIndex = 0;
  let feedFallbackTimer = null;

  function subscribeFeed(ws){
    ws.send(JSON.stringify({active_symbols:'brief',product_type:'basic',req_id:1}));
    ws.send(JSON.stringify({ticks:state.symbol,subscribe:1,req_id:2}));
    ws.send(JSON.stringify({ticks_history:state.symbol,count:80,end:'latest',style:'ticks',req_id:3}));
  }

  function connect(){
    clearTimeout(state.reconnectTimer);
    clearTimeout(feedFallbackTimer);
    setConnection('Connecting…');
    const url=FEEDS[feedIndex];
    try{state.ws=new WebSocket(url);}catch(e){setConnection('Feed unavailable');return}
    let opened=false;
    state.ws.onopen=()=>{
      opened=true;
      clearTimeout(feedFallbackTimer);
      setConnection('Live market connected',true);
      subscribeFeed(state.ws);
    };
    feedFallbackTimer=setTimeout(()=>{
      if(!opened && feedIndex<FEEDS.length-1){
        try{state.ws.close();}catch(_){}
        feedIndex++;
        connect();
      }
    },5000);
    state.ws.onmessage=e=>{
      try{
        const d=JSON.parse(e.data);
        if(d.error){
          console.warn('Deriv feed error',d.error);
          if(!opened && feedIndex<FEEDS.length-1){try{state.ws.close();}catch(_){} feedIndex++; connect(); return}
          setConnection('Feed error');
          return;
        }
        if(d.msg_type==='history'&&d.history?.prices){
          d.history.prices.map(Number).filter(Number.isFinite).forEach(v=>{
            state.prices.push(v);
            const dig=Number(lastDigit(v));
            if(Number.isInteger(dig))state.digits[dig]++;
          });
          state.prices=state.prices.slice(-120);
          drawChart(); analyze();
        }
        if(d.msg_type==='tick'&&d.tick)onTick(d.tick);
      }catch(err){console.error('Feed message error',err)}
    };
    state.ws.onerror=()=>{
      if(!opened && feedIndex<FEEDS.length-1){
        feedIndex++;
        try{state.ws.close();}catch(_){}
        connect();
      }else setConnection('Connection error');
    };
    state.ws.onclose=()=>{
      clearTimeout(feedFallbackTimer);
      if(opened){
        setConnection('Reconnecting…');
        state.reconnectTimer=setTimeout(connect,3000);
      }
    };
  }

  $('market').addEventListener('change',e=>{state.symbol=e.target.value;state.prices=[];state.digits=Array(10).fill(0);if(state.ws)state.ws.close();connect()});
  $('analyze').addEventListener('click',()=>{analyze();showToast('Analysis refreshed from the latest ticks.')});
  $('over').addEventListener('click',()=>selectOption('OVER'));$('under').addEventListener('click',()=>selectOption('UNDER'));
  function selectOption(v){state.selected=v;$('over').classList.toggle('active',v==='OVER');$('under').classList.toggle('active',v==='UNDER')}
  document.querySelectorAll('[data-stake]').forEach(b=>b.addEventListener('click',()=>setStake(Number(b.dataset.stake))));
  document.querySelectorAll('[data-delta]').forEach(b=>b.addEventListener('click',()=>setStake(Math.max(1,Math.min(100, state.stake+Number(b.dataset.delta))))));
  function setStake(v){state.stake=v;ui.stake.textContent=v;ui.payout.textContent='$'+(v*1.96).toFixed(2)}
  $('place').addEventListener('click',()=>showToast('Demo mode: no real trade was placed.'));
  $('menu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  window.addEventListener('resize',drawChart);setStake(5);connect();
})();
