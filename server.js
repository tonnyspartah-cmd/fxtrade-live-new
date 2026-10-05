const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const accounts = new Map();
const sessions = new Map();

const mime = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".ico": "image/x-icon"
};

function json(res, code, body) {
  res.writeHead(code, {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"});
  res.end(JSON.stringify(body));
}
function body(req) {
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data", c => { raw += c; if(raw.length > 1000000) req.destroy(); });
    req.on("end",()=>{ try { resolve(raw ? JSON.parse(raw) : {}); } catch(e){ reject(e); }});
    req.on("error",reject);
  });
}
function hash(p,s){ return crypto.createHash("sha256").update(`${s}:${p}`).digest("hex"); }
function token(){ return crypto.randomBytes(24).toString("hex"); }
function auth(req){
  const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  return sessions.get(t)||null;
}
function publicAccount(a){ return {id:a.id,email:a.email,balance:a.balance,kyc:a.kyc,transactions:a.transactions,trades:a.trades}; }

async function api(req,res,pathname){
  try {
    if(req.method === "GET" && pathname === "/api/health") return json(res,200,{ok:true,mode:"sandbox",realMoney:false,serverWallet:true});
    if(req.method === "POST" && pathname === "/api/deriv/proxy") {
      const b=await body(req);
      const token=String(b.token||"");
      const apiPath=String(b.path||"");
      const method=String(b.method||"GET").toUpperCase();
      if(!token||!apiPath.startsWith("/trading/v1/options/")) return json(res,400,{error:"Invalid Deriv request"});
      const upstream=await fetch("https://api.derivws.com"+apiPath,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:method==='GET'?undefined:JSON.stringify(b.body||{})});
      const text=await upstream.text(); let data; try{data=JSON.parse(text)}catch{data={error:text||"Invalid response from Deriv"}}
      return json(res,upstream.status,data);
    }
    if(req.method === "POST" && pathname === "/api/oauth/token") {
      const b=await body(req);
      const {code,code_verifier,redirect_uri,client_id}=b;
      if(!code||!code_verifier||!redirect_uri||!client_id) return json(res,400,{error:"Missing OAuth parameters"});
      const form=new URLSearchParams({grant_type:"authorization_code",client_id:String(client_id),code:String(code),code_verifier:String(code_verifier),redirect_uri:String(redirect_uri)});
      const upstream=await fetch("https://auth.deriv.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form.toString()});
      const text=await upstream.text(); let data; try{data=JSON.parse(text)}catch{data={error:text||"Invalid response from Deriv"}}
      return json(res,upstream.status,data);
    }
    if(req.method === "POST" && pathname === "/api/auth/register"){
      const b=await body(req), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
      if(!/^\S+@\S+\.\S+$/.test(email)) return json(res,400,{error:"Enter a valid email."});
      if(password.length<8) return json(res,400,{error:"Password must be at least 8 characters."});
      if(accounts.has(email)) return json(res,409,{error:"Account already exists. Sign in instead."});
      const a={id:crypto.randomUUID(),email,password:hash(password,email),balance:1000,kyc:{status:"not_started",name:"",phone:""},transactions:[],trades:[],createdAt:new Date().toISOString()};
      accounts.set(email,a); const t=token(); sessions.set(t,a); return json(res,201,{token:t,account:publicAccount(a),notice:"Sandbox account created with $1,000 test balance."});
    }
    if(req.method === "POST" && pathname === "/api/auth/login"){
      const b=await body(req), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
      const a=accounts.get(email); if(!a || a.password!==hash(password,email)) return json(res,401,{error:"Invalid email or password."});
      const t=token(); sessions.set(t,a); return json(res,200,{token:t,account:publicAccount(a)});
    }
    const a=auth(req); if(!a) return json(res,401,{error:"Sign in required."});
    if(req.method === "GET" && pathname === "/api/account") return json(res,200,{account:publicAccount(a)});
    if(req.method === "POST" && pathname === "/api/account/kyc"){
      const b=await body(req); a.kyc={status:"submitted",name:String(b.name||"").trim(),phone:String(b.phone||"").trim()}; return json(res,200,{account:publicAccount(a)});
    }
    if(req.method === "POST" && pathname === "/api/wallet/deposit-sandbox"){
      const amount=Number((await body(req)).amount); if(!Number.isFinite(amount)||amount<=0) return json(res,400,{error:"Invalid amount."});
      a.balance=Number((a.balance+amount).toFixed(2)); a.transactions.unshift({id:crypto.randomUUID(),type:"DEPOSIT_SANDBOX",amount,balance:a.balance,status:"sandbox",time:new Date().toISOString()}); return json(res,200,{account:publicAccount(a)});
    }
    if(req.method === "POST" && pathname === "/api/wallet/withdraw-sandbox"){
      const amount=Number((await body(req)).amount); if(!Number.isFinite(amount)||amount<=0) return json(res,400,{error:"Invalid amount."});
      if(amount>a.balance) return json(res,400,{error:"Insufficient sandbox balance."});
      a.balance=Number((a.balance-amount).toFixed(2)); a.transactions.unshift({id:crypto.randomUUID(),type:"WITHDRAWAL_SANDBOX",amount,balance:a.balance,status:"sandbox",time:new Date().toISOString()}); return json(res,200,{account:publicAccount(a)});
    }
    return json(res,404,{error:"API route not found."});
  } catch(e){ return json(res,500,{error:"Server error."}); }
}

function handler(req,res){
  const pathname=decodeURIComponent((req.url||"/").split("?")[0]);
  if(pathname.startsWith("/api/")) return api(req,res,pathname);
  let filePath=pathname === "/" ? "/index.html" : pathname;
  const file=path.resolve(root,"."+filePath);
  if(!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()){
    res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8"}); return res.end("FXTRADE page not found");
  }
  const ext=path.extname(file).toLowerCase(); res.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream"}); res.end(fs.readFileSync(file));
}
module.exports=handler;
if(require.main===module){http.createServer(handler).listen(process.env.PORT||3000,()=>console.log("FXTRADE v28 sandbox running"));}
