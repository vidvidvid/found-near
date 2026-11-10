import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRecoveryStore,createRecoveryApi} from './recoveries.mjs';
const recoveryStore=process.env.RECOVERY_DB?createRecoveryStore(process.env.RECOVERY_DB):null;
const recoveryApi=createRecoveryApi({store:recoveryStore});
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
export const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 let apiPath;try{apiPath=new URL(req.url,'http://localhost').pathname;}catch{res.writeHead(400);res.end();return;}
 if(await recoveryApi(req,res,apiPath))return;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return;}
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(path==='/health'){res.writeHead(200,{'Content-Type':'text/plain'});res.end(req.method==='HEAD'?undefined:'ok');return;}
  if(path.split('/').some(part=>part.startsWith('.'))){res.writeHead(404);res.end();return;}
  const file=resolve(root,'.'+(path==='/'?'/index.html':path));
  if(!file.startsWith(resolve(root)+sep)||!types[extname(file)]){res.writeHead(404);res.end();return;}
  const info=await stat(file);if(!info.isFile()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[extname(file)],'Content-Length':info.size,'Cache-Control':'no-cache'});
  if(req.method==='HEAD'){res.end();return;}
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch(error){res.writeHead(error instanceof URIError?400:404);res.end();}
});
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log('FOUND listening on port '+(process.env.PORT||8080)));
