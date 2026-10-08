// A narrow audit of this data-contract release. Never equate changed gate/schema
// files with changed mathematics, nor omit their mathematical portions.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
const [baseline,engineBaseline]=process.argv.slice(2);
if(!baseline||!engineBaseline)throw new Error('PASS_BOTH_IMMUTABLE_BASELINES');
const root=process.cwd(),base=resolve(baseline),engine=resolve(engineBaseline);
const sha=b=>createHash('sha256').update(b).digest('hex');
async function walk(dir,origin=dir){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(['node_modules','.git','dist','validation','test-results','__pycache__'].includes(entry.name))continue;
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())result.push(...await walk(path,origin));
    else if(entry.isFile())result.push(relative(origin,path));
    else throw new Error('UNEXPECTED_SOURCE_FILE_TYPE');
  }
  return result.sort();
}
const original=await walk(base),current=await walk(root),changed=[],deleted=original.filter(p=>!current.includes(p)),added=current.filter(p=>!original.includes(p));
for(const p of original.filter(p=>current.includes(p)))if(!(await readFile(resolve(base,p))).equals(await readFile(resolve(root,p))))changed.push(p);
const frozenPaths=original.filter(p=>/^(src\/(domain|risk|optimization|execution|portfolio|persistence|ui)\/|src\/snapshots\/integrity\.ts$|src\/main\.tsx$|src\/market-data\/(calendar\.ts|sessions\.json|demo\.ts)$|reference\/|tests\/|public\/)/.test(p)&&p!=='tests/tsm-adr.test.ts');
const frozen=[];
for(const path of frozenPaths){
  const a=await readFile(resolve(base,path)),b=await readFile(resolve(root,path));
  frozen.push({path,baselineSHA256:sha(a),candidateSHA256:sha(b),identical:a.equals(b)});
}
// Only this obsolete pending-event assertion may change. Its replacement still
// asserts fail-closed on dates beyond the independently audited evidence window.
const oldTSM=await readFile(resolve(base,'tests/tsm-adr.test.ts'),'utf8'),newTSM=await readFile('tests/tsm-adr.test.ts','utf8');
const oldPending="  // TSMC 1Q26 IR still lists ~USD 1.11, not a final exact USD amount at audit time.\n  expect(() => validateTSMADRDividends(raw,'2025-01-01','2026-10-05')).toThrow('CORPORATE_ACTION_UNVERIFIED');";
const newPending="  // Future events outside the explicitly audited evidence window still fail closed.\n  expect(() => validateTSMADRDividends(raw,'2025-01-01','2026-12-31')).toThrow('CORPORATE_ACTION_UNVERIFIED');";
const tsmTestException=oldTSM.includes(oldPending)&&newTSM.replace(newPending,oldPending)===oldTSM;
function replaceOnce(text,from,to){if(!text.includes(from)||text.split(from).length!==2)throw new Error('UNREVIEWED_SNAPSHOT_CHANGE');return text.replace(from,to);}
let calculation=await readFile('src/snapshots/calculate.ts','utf8');
calculation=replaceOnce(calculation,'    schemaVersion: input.dataset?.schemaVersion===2?2:1,','    schemaVersion: 1,');
calculation=replaceOnce(calculation,'    versions: { ...VERSIONS, snapshot:input.dataset?.schemaVersion===2?2:VERSIONS.snapshot } as {','    versions: { ...VERSIONS } as {');
calculation=replaceOnce(calculation,'  const snapshotVersion=header.input.dataset?.schemaVersion===2?2:VERSIONS.snapshot;\n','');
calculation=replaceOnce(calculation,'    (snapshotVersion===2?[VERSIONS.engine]:["1.0.0", VERSIONS.engine]).includes(header.versions.engine) &&\n      canonical({ ...header.versions, engine: VERSIONS.engine }) === canonical({...VERSIONS,snapshot:snapshotVersion}),','    ["1.0.0", VERSIONS.engine].includes(header.versions.engine) &&\n      canonical({ ...header.versions, engine: VERSIONS.engine }) === canonical(VERSIONS),');
const snapshotNumericsUnchanged=calculation===await readFile(resolve(engine,'src/snapshots/calculate.ts'),'utf8');
const provider=await readFile('src/market-data/provider.ts','utf8'),oldProvider=await readFile(resolve(engine,'src/market-data/provider.ts'),'utf8');
function fragment(source,start,end){const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<=a)throw new Error('MISSING_NUMERICAL_AUDIT_FRAGMENT');return source.slice(a,b);}
const protectedFragments=[
  ['equityFactor','export function equityFactor(','export function prepareRisk('],
  ['levelsAndTotalReturns','    levelsDKK.push(row.closeUSD.map','  const coverage = returns.length / lookback;'],
  ['coverageAndHistory','  const coverage = returns.length / lookback;','  return {\n    returns,'],
];
const dataMathematics=protectedFragments.map(([name,start,end])=>{
  const a=fragment(oldProvider,start,end),b=fragment(provider,start,end);
  return {name,baselineSHA256:sha(a),candidateSHA256:sha(b),identical:a===b};
});
const kernelPaths=['src/domain/core.ts','src/risk/math.ts','src/optimization/targets.ts','src/execution/allocator.ts','src/portfolio/accounting.ts','src/snapshots/integrity.ts','src/persistence/schema.ts','src/persistence/store.ts','src/market-data/calendar.ts','src/market-data/sessions.json','src/market-data/demo.ts','reference/reference.json','reference/reproduce.py'];
const kernel=[];
for(const path of kernelPaths){const a=await readFile(resolve(engine,path)),b=await readFile(resolve(root,path));kernel.push({path,baselineSHA256:sha(a),candidateSHA256:sha(b),identical:a.equals(b)});}
const a=JSON.parse(await readFile(resolve(base,'package-lock.json'))),b=JSON.parse(await readFile('package-lock.json'));a.version=b.version;a.packages[''].version=b.packages[''].version;
const sourceHashes={};for(const path of current)sourceHashes[path]=sha(await readFile(resolve(root,path)));
const report={checkedAt:new Date().toISOString(),appVersion:b.version,engineVersion:'1.0.1',marketDataModelVersion:'1.1.2',snapshotSchemaVersions:[1,2],
  noDependencyChanges:JSON.stringify(a)===JSON.stringify(b),frozenFilesIdentical:frozen.every(f=>f.identical),kernelFilesIdentical:kernel.every(f=>f.identical),
  snapshotNumericsUnchanged,dataMathematicsUnchanged:dataMathematics.every(f=>f.identical),originalTestsPreserved:!deleted.some(p=>p.startsWith('tests/'))&&tsmTestException,
  explicitExceptions:['Versioned date-only FX gate and provenance; numerical return construction unchanged.','Snapshot schema/version dispatch only; all calculation/replay mathematics identical.','TSM obsolete pending assertion replaced by unaudited-future rejection; all other original assertions unchanged.'],
  frozen,kernel,dataMathematics,tsmTestException,changed,added,deleted,sourceHashes};
report.status=!deleted.length&&report.noDependencyChanges&&report.frozenFilesIdentical&&report.kernelFilesIdentical&&report.snapshotNumericsUnchanged&&report.dataMathematicsUnchanged&&report.originalTestsPreserved?'PASS':'FAIL';
await writeFile('validation/closure-final-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({status:report.status,frozenFiles:frozen.length,kernelFiles:kernel.length,snapshotNumericsUnchanged,dataMathematicsUnchanged:report.dataMathematicsUnchanged,noDependencyChanges:report.noDependencyChanges,deleted}));
if(report.status!=='PASS')process.exitCode=1;
