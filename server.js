const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
http.createServer((req,res)=>{let p=(req.url||'/').split('?')[0];if(p==='/')p='/index.html';const f=path.normalize(path.join(root,p));if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end('Not found')};res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(f));}).listen(process.env.PORT||3000,()=>console.log('FXTRADE standalone running'));
