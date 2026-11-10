import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

/** Seal only executable inputs, never env files, credentials or artifacts.
 * The operator supplies a tested isolated release. A changing workspace cannot
 * silently become the source of a privileged background worker. */
export async function workerReleaseDigest(root) {
  const base=await fs.realpath(root),files=['package.json','package-lock.json','scripts/company-business-engine.cjs'];
  async function walk(relative) {
    for(const item of (await fs.readdir(path.join(base,relative),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const name=path.join(relative,item.name);
      if(item.isSymbolicLink())throw Error('worker_release_symlink');
      if(item.isDirectory())await walk(name);else if(item.isFile())files.push(name);
    }
  }
  await walk('src');
  const hash=createHash('sha256');
  for(const file of files.sort()) {
    if((await fs.lstat(path.join(base,file))).isSymbolicLink())throw Error('worker_release_symlink');
    const bytes=await fs.readFile(path.join(base,file));
    hash.update(file).update('\0').update(String(bytes.length)).update('\0').update(bytes);
  }
  return {root:base,sha256:hash.digest('hex')};
}

export async function verifyWorkerRelease(release,workspace) {
  if(!path.isAbsolute(release?.root??'')||!/^[a-f0-9]{64}$/.test(release?.sha256??''))throw Error('worker_release_unconfigured');
  const expectedRoot=await fs.realpath(release.root);
  if(expectedRoot===await fs.realpath(workspace))throw Error('worker_release_workspace_not_allowed');
  const actual=await workerReleaseDigest(expectedRoot);
  if(actual.sha256!==release.sha256)throw Error('worker_release_changed');
  return actual.root;
}
