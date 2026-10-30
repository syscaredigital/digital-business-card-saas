// Stop application/cron writers first. Keep BACKUP_DIR outside the web document root.
require('../backend/config/environment');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
function run(command,args,env){const result=spawnSync(command,args,{env,stdio:['ignore','ignore','pipe'],shell:false,timeout:300000});if(result.error||result.status!==0)throw new Error(command+' failed ('+(result.error?.code||result.status)+'). Check database permissions and the installed command.');}
function fileHash(file){return new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256'),stream=fs.createReadStream(file);stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolve(hash.digest('hex')));});}
if(require.main===module)(async()=>{
  let caPath;
  try{
    process.umask(0o077);
    for(const key of ['DB_HOST','DB_NAME','DB_USER','DB_PASSWORD'])if(!process.env[key])throw Error(key+' is required');
    const root=path.resolve(process.env.BACKUP_DIR||path.join(__dirname,'../private-backups'));
    const output=path.join(root,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
    fs.mkdirSync(output,{recursive:true,mode:0o700});
    const env={...process.env,PGHOST:process.env.DB_HOST,PGPORT:process.env.DB_PORT||'5432',PGDATABASE:process.env.DB_NAME,PGUSER:process.env.DB_USER,PGPASSWORD:process.env.DB_PASSWORD,PGSSLMODE:process.env.DB_SSL==='true'?'verify-full':'disable'};
    if(process.env.DB_SSL_CA){caPath=path.join(output,'temporary-ca.pem');fs.writeFileSync(caPath,process.env.DB_SSL_CA.replace(/\\n/g,'\n'),{mode:0o600});env.PGSSLROOTCERT=caPath;}
    const dump=path.join(output,'database.dump'),uploads=path.join(output,'uploads.tar.gz');
    run('pg_dump',['--format=custom','--no-owner','--no-acl','--file='+dump],env);
    run('tar',['-czf',uploads,'-C',path.resolve(__dirname,'../backend'),'uploads'],process.env);
    const files=await Promise.all([dump,uploads].map(async file=>({name:path.basename(file),sha256:await fileHash(file)})));
    fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files},null,2),{mode:0o600});
    console.log('Backup created: '+output+'. Copy securely off the VPS and rehearse restoration before launch.');
  }catch(e){console.error(e.message);process.exitCode=1;}finally{if(caPath&&fs.existsSync(caPath))fs.unlinkSync(caPath);}
})();
