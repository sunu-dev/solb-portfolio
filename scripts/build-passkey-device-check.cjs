const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const target = '/private/tmp/joobi-passkey-device-check-20261030';
const linked = path.join(target, '.vercel/project.json');
if (fs.existsSync(linked)) {
  const project = JSON.parse(fs.readFileSync(linked, 'utf8'));
  assert.equal(project.projectId, 'prj_RbshKKtRzfVqFDfbq8J0M5HQpCP2', 'Never build into another linked project');
  assert.equal(project.orgId, 'team_SQ6jJZBkbSRNoxeBJ623b5zV');
}
const output = path.join(target, '.vercel/output');
const assets = path.join(output, 'static');
fs.mkdirSync(assets, { recursive:true });
for (const name of ['index.html','style.css','app.js']) fs.copyFileSync(path.join(__dirname,'passkey-device-check',name),path.join(assets,name));
for (const name of ['portfolioVaultCrypto','portfolioVaultPasskey']) {
  let source = fs.readFileSync(path.join(root, 'src/lib', name+'.ts'),'utf8');
  if (name === 'portfolioVaultPasskey') {
    const production = "if (hostname === 'joobi.kr' && protocol === 'https:') return hostname;";
    assert.equal(source.split(production).length,2);
    // Isolated test artifact only. Production source remains pinned to joobi.kr.
    source = source.replace(production,"if (hostname.endsWith('.vercel.app') && protocol === 'https:') return hostname;")
      .replaceAll("'주비 투자 기록'", "'주비 보관 시험 (삭제 가능)'");
  }
  const compiled = ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  assert.ok(!compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error), `Invalid test module: ${name}`);
  const js = compiled.outputText
    .replaceAll("'./portfolioVaultCrypto'", "'./portfolioVaultCrypto.js'");
  fs.writeFileSync(path.join(assets,name+'.js'),js);
}
fs.writeFileSync(path.join(output,'config.json'), JSON.stringify({ version:3, routes:[
  { src:'/(.*)', headers:{ 'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", 'Referrer-Policy':'no-referrer', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }, continue:true },
  {handle:'filesystem'},
]},null,2));
console.log(target);
