import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {workerReleaseDigest,verifyWorkerRelease} from '../src/worker-release.mjs';
async function fixture(fn) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'joobi-release-'));
  try {
    await fs.mkdir(path.join(root,'src'));await fs.mkdir(path.join(root,'scripts'));
    for(const file of ['package.json','package-lock.json','src/worker.ts','scripts/company-business-engine.cjs'])await fs.writeFile(path.join(root,file),'{}');
    await fn(root);
  }finally{await fs.rm(root,{recursive:true,force:true});}
}
test('privileged commands bind to an isolated tested release, not the dirty workspace',()=>fixture(async root=>{
  const seal=await workerReleaseDigest(root);
  assert.equal(await verifyWorkerRelease(seal,os.tmpdir()),await fs.realpath(root));
  await assert.rejects(()=>verifyWorkerRelease(seal,root),/workspace_not_allowed/);
  await fs.writeFile(path.join(root,'src/worker.ts'),'changed');
  await assert.rejects(()=>verifyWorkerRelease(seal,os.tmpdir()),/release_changed/);
}));
test('release seals exclude secrets and artifacts and reject executable symlinks',()=>fixture(async root=>{
  const seal=await workerReleaseDigest(root);await fs.writeFile(path.join(root,'.env.local'),'PRIVATE=secret');
  await fs.mkdir(path.join(root,'artifacts'));await fs.writeFile(path.join(root,'artifacts/result.json'),'{}');
  assert.deepEqual(await workerReleaseDigest(root),seal);
  await fs.symlink('../package.json',path.join(root,'src/linked.json'));
  await assert.rejects(()=>workerReleaseDigest(root),/release_symlink/);
}));
