import { readdir,readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve,relative } from 'node:path';
const clean=process.argv[2];if(!clean)throw new Error('Pass the separately npm-ci-installed clean build directory');
async function hashes(root,dir=root){const out={};for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(entry.isDirectory())Object.assign(out,await hashes(root,path));else out[relative(root,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}return out;}
const current=await hashes(resolve('dist')),rebuilt=await hashes(resolve(clean,'dist'));
const differences=[...new Set([...Object.keys(current),...Object.keys(rebuilt)])].filter(k=>current[k]!==rebuilt[k]);
const lock=await readFile('package-lock.json'),cleanLock=await readFile(resolve(clean,'package-lock.json'));
const result={checkedAt:new Date().toISOString(),node:process.version,cleanDependencyInstallation:'npm ci (run separately before this comparison)',identicalLockfile:lock.equals(cleanLock),identicalDist:!differences.length,differences,distSHA256:current};
await writeFile('validation/reproducibility.json',JSON.stringify(result,null,2));
if(differences.length||!result.identicalLockfile)throw new Error('CLEAN_REBUILD_MISMATCH');
console.log(`Identical lockfile and all ${Object.keys(current).length} production files, including source map, manifest and service worker.`);
