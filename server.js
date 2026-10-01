const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto");
const root=path.join(__dirname,"public");
const users=new Map();
const sessions=new Map();
const trades=new Map();
function json(res,status,data){res.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify(data))}
function body(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>s+=c);req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})})}
function hash(p){return crypto.createHash("sha256").update(p).digest("hex")}
function token(){return crypto.randomBytes(24).toString("hex")}
function auth(req){let h=req.headers.authorization||"";return sessions.get(h.replace(/^Bearer /,""))}
function settle(type,d,b){return type==="OVER"?d>b:type==="UNDER"?d<b:type==="EVEN"?d%2===0:d%2===1}
const server=http.createServer(async(req,res)=>{
  try{
    if(req.url==="/api/health")return json(res,200,{ok:true,mode:"prototype",realMoney:false});
    if(req.url==="/api/register"&&req.method==="POST"){
      let x=await body(req); if(!x.username||!x.password)return json(res,400,{error:"username and password required"});
      if(users.has(x.username))return json(res,409,{error:"username already exists"});
      let id=crypto.randomUUID(); users.set(x.username,{id,username:x.username,password:hash(x.password),balance:1000,pnl:0,wins:0,losses:0});
      return json(res,201,{ok:true});
    }
    if(req.url==="/api/login"&&req.method==="POST"){
      let x=await body(req),u=users.get(x.username);
      if(!u||u.password!==hash(x.password))return json(res,401,{error:"invalid login"});
      let t=token();sessions.set(t,u.id);return json(res,200,{token:t});
    }
    if(req.url==="/api/account"&&req.method==="GET"){
      let id=auth(req),u=id&&[...users.values()].find(x=>x.id===id);
      if(!u)return json(res,401,{error:"unauthorized"});
      return json(res,200,{username:u.username,balance:u.balance,pnl:u.pnl,wins:u.wins,losses:u.losses});
    }
    if(req.url==="/api/demo-trade"&&req.method==="POST"){
      let id=auth(req),u=id&&[...users.values()].find(x=>x.id===id); if(!u)return json(res,401,{error:"unauthorized"});
      let x=await body(req),stake=Number(x.stake),digit=Number(x.digit),barrier=Number(x.barrier);
      if(!Number.isFinite(stake)||stake<=0||stake>u.balance)return json(res,400,{error:"invalid stake"});
      let win=settle(x.type,digit,barrier),profit=win?stake*.82:-stake;
      u.balance+=profit;u.pnl+=profit;win?u.wins++:u.losses++;
      let rec={id:crypto.randomUUID(),time:new Date().toISOString(),type:x.type,digit,stake,profit};
      trades.set(rec.id,{userId:u.id,...rec}); return json(res,200,{win,profit,account:{balance:u.balance,pnl:u.pnl,wins:u.wins,losses:u.losses},trade:rec});
    }
    let p=req.url.split("?")[0]; if(p==="/")p="/index.html";
    let f=path.join(root,p); if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end("Not found")}
    let ext=path.extname(f),ct=ext===".js"?"text/javascript":ext===".css"?"text/css":"text/html";res.writeHead(200,{"Content-Type":ct});res.end(fs.readFileSync(f));
  }catch(e){json(res,500,{error:"server error"})}
});
server.listen(process.env.PORT||3000,()=>console.log("FXTRADE prototype running"));
