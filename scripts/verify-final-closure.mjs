// Fresh mandatory non-browser verification. Preserve the actual browser launch
// failure separately; do not repeatedly retry an unchanged permission boundary.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const [baseline,engineBaseline]=process.argv.slice(2);
if(!baseline||!engineBaseline)throw new Error('PASS_BOTH_IMMUTABLE_BASELINES');
const previous=JSON.parse(await readFile('validation/release-checks.json','utf8'));
const browser=previous.steps.find(s=>s.command.includes('test:browser'));
if(!browser||browser.exitCode===0||!browser.output.includes('EACCES'))throw new Error('NO_EXECUTED_BROWSER_PERMISSION_EVIDENCE');
const commands=[
  ['npm',['run','lint']],['npm',['run','typecheck']],['npm',['run','test:reference']],
  ['npm',['test']],['npm',['run','build']],['node',['scripts/check-final-risk.mjs']],
  ['python3',['reference/final-risk.py']],
  ['node',['scripts/audit-final-closure.mjs',resolve(baseline),resolve(engineBaseline)]],
];
const report={startedAt:new Date().toISOString(),node:process.version,platform:process.platform,
  browserRuntime:'NOT TESTED',browserReason:'EACCES; zero browser application assertions',
  browserEvidence:{startedAt:browser.startedAt,finishedAt:browser.finishedAt,exitCode:browser.exitCode,
    source:'validation/release-checks.json',rerun:false},physicalIPhone:'NOT TESTED',safariWebKit:'NOT TESTED',steps:[]};
for(const [command,args] of commands){
  const startedAt=new Date().toISOString();let output='';
  const exitCode=await new Promise((done,reject)=>{
    const child=spawn(command,args,{env:process.env});
    const collect=b=>{const s=b.toString();output+=s;process.stdout.write(s);};
    child.stdout.on('data',collect);child.stderr.on('data',collect);child.on('error',reject);child.on('close',done);
  });
  report.steps.push({command:[command,...args],startedAt,finishedAt:new Date().toISOString(),exitCode,output});
  await writeFile('validation/closure-final-checks.json',JSON.stringify(report,null,2));
  if(exitCode!==0){process.exitCode=exitCode??1;break;}
}
