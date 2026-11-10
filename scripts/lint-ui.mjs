import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Enforce the shared disclosure contract, including explicit composite card exceptions.
// Do not globally restyle summary: calendar events and metric cards have multiple text roles.
const violations = [];
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = path.join(dir, item.name);
    if (item.isDirectory()) { if (item.name !== '__tests__') scan(name); continue; }
    if (!name.endsWith('.tsx')) continue;
    const source = ts.createSourceFile(name, fs.readFileSync(name, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === 'summary') {
        const attrs = node.attributes.properties;
        const value = key => attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === key);
        const cls = value('className')?.getText(source) ?? '';
        const composite = value('data-ui-disclosure')?.initializer?.getText(source) === '"composite"';
        if (!composite && !/\.(disclosure|referenceSummary)\b/.test(cls)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          violations.push(`${name}:${line} summary must use the shared disclosure class or declare a composite card`);
        }
        if (!composite && value('style')) violations.push(`${name}: remove local summary styles and use ReadingUI.disclosure`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}
scan('src/components');
scan('src/app');
if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
else console.log('[lint:ui] ✓ All disclosures use shared styles or documented composite roles');
