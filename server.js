const http=require("http"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,"public");
const server=http.createServer((req,res)=>{
 if(req.url==="/api/health"){res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({ok:true,mode:"prototype",realMoney:false}))}
 let p=req.url.split("?")[0]; if(p==="/")p="/index.html";
 let f=path.join(root,p); if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end("Not found")}
 let ext=path.extname(f),ct=ext===".js"?"text/javascript":ext===".css"?"text/css":"text/html";res.writeHead(200,{"Content-Type":ct});res.end(fs.readFileSync(f));
});
server.listen(process.env.PORT||3000,()=>console.log("FXTRADE prototype running"));