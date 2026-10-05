const DERIV_TOKEN_KEY="fxtrade-deriv-token";
const DERIV_CLIENT_KEY="fxtrade-deriv-client-id";
let derivSocket=null, derivConnected=false, derivLastTick=null;
function derivClientId(){return sessionStorage.getItem(DERIV_CLIENT_KEY)||localStorage.getItem(DERIV_CLIENT_KEY)||""}
function derivToken(){return sessionStorage.getItem(DERIV_TOKEN_KEY)||""}
function b64url(buf){return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,'')}
async function sha256(s){return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))}
function randomText(n=64){const a=crypto.getRandomValues(new Uint8Array(n));return Array.from(a).map(x=>"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[x%66]).join("")}
async function connectDeriv(){
 const clientId=derivClientId();
 if(!clientId){alert("Open Settings and enter your Deriv OAuth Client ID first."); return false}
 const verifier=randomText(64), challenge=b64url(await sha256(verifier)), state=randomText(24);
 sessionStorage.setItem("fxtrade_pkce_verifier",verifier);sessionStorage.setItem("fxtrade_oauth_state",state);
 const redirect=location.origin+"/oauth-callback.html";
 const u=new URL("https://auth.deriv.com/oauth2/auth");
 u.searchParams.set("response_type","code");u.searchParams.set("client_id",clientId);u.searchParams.set("redirect_uri",redirect);u.searchParams.set("scope","trade account_manage application_read");u.searchParams.set("state",state);u.searchParams.set("code_challenge",challenge);u.searchParams.set("code_challenge_method","S256");
 location.href=u.toString(); return true;
}
async function exchangeDerivCode(){
 const q=new URLSearchParams(location.search),code=q.get("code"),state=q.get("state");
 if(!code)return {ok:false};
 if(state!==sessionStorage.getItem("fxtrade_oauth_state"))throw new Error("Deriv OAuth state mismatch");
 const verifier=sessionStorage.getItem("fxtrade_pkce_verifier"),clientId=derivClientId();
 const r=await fetch("/api/oauth/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,code_verifier:verifier,redirect_uri:location.origin+"/oauth-callback.html",client_id:clientId})});
 const d=await r.json();if(!r.ok)throw new Error(d.error||"Deriv authorization failed");
 sessionStorage.setItem(DERIV_TOKEN_KEY,d.access_token);sessionStorage.removeItem("fxtrade_pkce_verifier");sessionStorage.removeItem("fxtrade_oauth_state");return {ok:true};
}
function disconnectDeriv(){sessionStorage.removeItem(DERIV_TOKEN_KEY);derivConnected=false;if(derivSocket)derivSocket.close();}
function derivPublicSocket(symbol,onTick,onStatus){
 if(derivSocket)derivSocket.close();
 const ws=new WebSocket("wss://api.derivws.com/trading/v1/options/ws/public");derivSocket=ws;
 ws.onopen=()=>{onStatus?.("LIVE TICKS");ws.send(JSON.stringify({ticks:symbol,subscribe:1}))};
 ws.onmessage=e=>{try{const m=JSON.parse(e.data);if(m.tick){derivLastTick=m.tick;onTick?.(m.tick)}}catch(_){}};
 ws.onerror=()=>onStatus?.("LIVE ERROR");ws.onclose=()=>onStatus?.("DEMO TICKS");return ws;
}
