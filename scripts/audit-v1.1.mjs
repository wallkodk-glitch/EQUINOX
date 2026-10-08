import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const baseline=process.argv[2];if(!baseline)throw new Error('Pass the immutable audited baseline directory');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function walk(root,dir=root){
 const out=[];for(const e of await readdir(dir,{withFileTypes:true})){
  if(['node_modules','.git','dist','validation','test-results','__pycache__'].includes(e.name))continue;
  const path=resolve(dir,e.name);if(e.isDirectory())out.push(...await walk(root,path));else if(e.isFile())out.push(relative(root,path));else throw new Error('Unexpected file type');
 }return out.sort();
}
const base=resolve(baseline),root=process.cwd(),original=await walk(base),current=await walk(root),changed=[],added=current.filter(p=>!original.includes(p)),deleted=original.filter(p=>!current.includes(p));
for(const p of original.filter(p=>current.includes(p)))if(!(await readFile(resolve(base,p))).equals(await readFile(resolve(root,p))))changed.push(p);
const frozen=original.filter(p=>/^(src\/(domain|risk|optimization|execution|portfolio|snapshots|persistence|ui)\/|src\/main\.tsx$|src\/market-data\/(provider\.ts|calendar\.ts|sessions\.json|demo\.ts)$|reference\/|tests\/|public\/)/.test(p)),rows=[];
for(const p of frozen){const a=sha(await readFile(resolve(base,p))),b=sha(await readFile(resolve(root,p)));rows.push({path:p,baselineSHA256:a,candidateSHA256:b,identical:a===b});}
const a=JSON.parse(await readFile(resolve(base,'package-lock.json'))),b=JSON.parse(await readFile('package-lock.json'));a.version=b.version;a.packages[''].version=b.packages[''].version;
const app=JSON.parse(await readFile('package.json')),model=await readFile('src/market-data/live/model.ts','utf8');
const marketVersion=/export const MARKET_DATA_MODEL_VERSION='([^']+)'/.exec(model)?.[1];
if(!marketVersion)throw new Error('MISSING_MARKET_DATA_VERSION');
const report={checkedAt:new Date().toISOString(),appVersion:app.version,engineVersion:'1.0.1',marketDataModelVersion:marketVersion,snapshotSchemaVersion:1,dataIntegration:'BLOCKED',noDependencyChanges:JSON.stringify(a)===JSON.stringify(b),frozenFilesIdentical:rows.every(r=>r.identical),originalTestsPreserved:!deleted.some(p=>p.startsWith('tests/')),frozen:rows,changed,added,deleted};
await writeFile('validation/v1.1-audit.json',JSON.stringify(report,null,2));if(!report.frozenFilesIdentical||!report.noDependencyChanges||deleted.length)throw new Error('BASELINE_REGRESSION');
console.log(`${frozen.length} frozen/reference/original test files byte-identical; dependencies unchanged.`);
