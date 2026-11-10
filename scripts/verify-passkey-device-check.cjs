const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');
const {chromium}=require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root=path.resolve(__dirname,'..');const assets='/private/tmp/joobi-passkey-device-check-20261030/.vercel/output/static';
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!['index.html','app.js','style.css','portfolioVaultCrypto.js','portfolioVaultPasskey.js'].includes(name)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store'});res.end(fs.readFileSync(path.join(assets,name)));
 });
 await new Promise(resolve=>server.listen(0,'localhost',resolve));let browser;
 const out=path.join(root,'artifacts/portfolio-vault-rollout-20261029');
 try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:390,height:900}});const page=await context.newPage();
  const origin=process.env.PASSKEY_CHECK_URL || `http://localhost:${server.address().port}`;const errors=[];const unsafe=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin+'/')||r.method()!=='GET')unsafe.push(r.method());});
  const cdp=await context.newCDPSession(page);await cdp.send('WebAuthn.enable',{enableUI:false});
  const {authenticatorId}=await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',ctap2Version:'ctap2_1',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true,hasPrf:true}});
  await page.goto(origin);
  await page.evaluate(()=>{const get=navigator.credentials.get.bind(navigator.credentials);window.getCount=0;Object.defineProperty(navigator.credentials,'get',{configurable:true,value:(...args)=>{window.getCount++;return get(...args);}});});
  await page.getByRole('button',{name:'처음이면 패스키 만들기',exact:true}).click();
  await page.getByText('패스키 저장 성공. 다음 버튼으로 계속해주세요.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.getCount),0);
  assert.ok(page.url().includes('#setup='));
  await page.reload();await page.getByRole('button',{name:'만든 패스키로 시험 기록 준비',exact:true}).click();
  await page.getByText('시험 기록 준비 완료',{exact:true}).waitFor();const trial=page.url();assert.ok(trial.includes('#trial='));
  assert.equal((await cdp.send('WebAuthn.getCredentials',{authenticatorId})).credentials.length,1);
  // Simulate the user's interrupted old setup: select the saved credential from
  // a clean page instead of registering another one.
  await page.goto(origin);await page.reload();
  await page.getByRole('button',{name:'이미 만든 패스키로 계속',exact:true}).click();
  await page.getByText('시험 기록 준비 완료',{exact:true}).waitFor();
  assert.equal((await cdp.send('WebAuthn.getCredentials',{authenticatorId})).credentials.length,1);
  // The older trial remains decryptable after creating this separate test vault.
  await page.goto(trial);
  await page.reload();
  await page.evaluate(()=>Object.defineProperty(navigator.credentials,'get',{configurable:true,value:()=>Promise.reject(new DOMException('synthetic platform refusal','NotAllowedError'))}));
  await page.getByRole('button',{name:'이 기기에서 기록 열기',exact:true}).click();
  await page.getByText(/패스키 사용 \/ not_allowed/).waitFor();
  assert.ok((await page.locator('#status').innerText()).includes('직접 취소했다는 뜻은 아니에요'));
  assert.equal(await page.locator('#result').isVisible(),false);
  await page.reload();await page.getByRole('button',{name:'이 기기에서 기록 열기',exact:true}).click();await page.getByRole('heading',{name:'이 기기에서 복원 성공',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
  for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,`device-check-${width}.png`),fullPage:true});}
  const corrupt=new URL(trial);const data=JSON.parse(Buffer.from(corrupt.hash.slice(7),'base64url').toString());data.record.ciphertext=(data.record.ciphertext[0]==='A'?'B':'A')+data.record.ciphertext.slice(1);corrupt.hash='trial='+Buffer.from(JSON.stringify(data)).toString('base64url');
  await page.goto(corrupt.href);await page.reload();await page.getByRole('button',{name:'이 기기에서 기록 열기',exact:true}).click();await page.getByText(/cannot_decrypt/).waitFor();assert.equal(await page.locator('#result').isVisible(),false);
  await page.goto(origin+'/#trial=invalid');await page.reload();await page.getByText(/check_failed|invalid_fixture/).waitFor();assert.equal(await page.getByRole('button',{name:'처음이면 패스키 만들기',exact:true}).isVisible(),false);
  assert.deepEqual(errors,[]);assert.deepEqual(unsafe,[]);
  fs.writeFileSync(path.join(out,process.env.PASSKEY_CHECK_URL ? 'device-check-remote.json' : 'device-check-local.json'),JSON.stringify({url:process.env.PASSKEY_CHECK_URL || 'localhost',separateRegistrationGesture:true,resumeSetupAfterReload:true,existingPasskeyReusedWithoutRegistration:true,olderTrialStillDecrypts:true,notAllowedDoesNotClaimCancellation:true,nativeVirtualAuthenticator:true,reloadRecovery:true,tamperRejected:true,noBrowserPersistence:true,noOutboundDataRequests:true,widths:[320,390,1440],physicalCrossDeviceVerified:false},null,2)+'\n');
  console.log('Device-check page verified with a virtual authenticator; actual physical-device test remains.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
