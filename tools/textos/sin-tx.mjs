// Busca sitios donde un texto guardado (Txt/Msg) se enseña o se compara tal cual: {expr} en JSX
// (también en atributos), ${expr} en plantillas, `+`, `===` y `!==`, y listas unidas con `.join()`. Con `tx()` se escribe y con
// `idText()` se compara. Uso: npm run textos:sin-tx (sale con error si encuentra algo).
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
let found = 0;
const conf = ts.readConfigFile(ROOT + '/tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(conf.config, ts.sys, ROOT);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const isMsgish = (t) => {
  const parts = t.isUnion() ? t.types : [t];
  return parts.some((p) => {
    const s = checker.typeToString(p);
    return (
      s === 'Msg' ||
      s === 'Txt' ||
      (p.getProperty('k') && p.getProperty('p') && !p.getProperty('length'))
    );
  });
};
for (const sf of program.getSourceFiles()) {
  if (!sf.fileName.startsWith(ROOT + '/src/') && !sf.fileName.startsWith(ROOT + '/tools/'))
    continue;
  // convert.ts compara a propósito con las frases de las partidas viejas.
  if (/\/textos\/|\.test\.ts$|core\/convert\.ts$/.test(sf.fileName)) continue;
  const visit = (n) => {
    let e = null;
    if (ts.isJsxExpression(n) && n.expression && !ts.isJsxAttribute(n.parent)) e = n.expression;
    else if (ts.isJsxExpression(n) && n.expression && ts.isJsxAttribute(n.parent)) e = n.expression;
    else if (ts.isTemplateSpan(n)) e = n.expression;
    else if (
      ts.isBinaryExpression(n) &&
      [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ].includes(n.operatorToken.kind)
    ) {
      for (const side of [n.left, n.right]) {
        const t = checker.getTypeAtLocation(side);
        if (isMsgish(t)) report(sf, side);
      }
    }
    // Listas con mensajes unidas con `.join()` (saldría «[object Object]»).
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'join'
    ) {
      const arr = checker.getTypeAtLocation(n.expression.expression);
      const el = checker.isArrayType(arr) ? checker.getTypeArguments(arr)[0] : undefined;
      if (el && isMsgish(el)) report(sf, n.expression.expression);
    }
    if (e) {
      const t = checker.getTypeAtLocation(e);
      if (isMsgish(t)) report(sf, e);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
function report(sf, n) {
  // Comparar con '' (un hueco vacío) es a propósito.
  if (ts.isStringLiteral(n.parent?.right ?? n.parent?.left ?? n) && n.parent.right?.text === '')
    return;
  found++;
  const { line } = sf.getLineAndCharacterOfPosition(n.getStart());
  console.log(`${sf.fileName.slice(ROOT.length + 1)}:${line + 1}: ${n.getText().slice(0, 70)}`);
}

if (found) process.exit(1);
console.log('Ningún texto guardado sin tx().');
