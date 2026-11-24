// What an effect (or any function) inside a component uses from around it, to move it to its own file.
// node analyze.cjs <project dir> <file> <line of the function's start>
// Prints JSON: locals (declared in the component: name + type), moduleLocals (declared at the file's top level),
// imports (imported names used, with their module)
const ts = require(require.resolve('typescript', { paths: [process.argv[2]] }));
const path = require('path');
const [, , dir, file, lineArg] = process.argv;
const cfgPath = path.join(dir, 'tsconfig.json');
const cfg = ts.getParsedCommandLineOfConfigFile(cfgPath, {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(String(d.messageText)); } });
const abs = path.resolve(dir, file);
const program = ts.createProgram([abs], cfg.options);
const checker = program.getTypeChecker();
const sf = program.getSourceFile(abs);
const line = Number(lineArg) - 1;

let target = null;
const find = n => {
  if (target) return;
  if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isVariableStatement(n)) && sf.getLineAndCharacterOfPosition(n.getStart(sf)).line === line) { target = n; return; }
  if (ts.isCallExpression(n) && sf.getLineAndCharacterOfPosition(n.getStart(sf)).line === line) { target = n.arguments[0]; return; }
  ts.forEachChild(n, find);
};
find(sf);
if (!target) { console.error('nothing starts on line', lineArg); process.exit(1); }
let comp = target.parent;
while (comp && !(ts.isFunctionDeclaration(comp) && comp.parent === sf) && !(ts.isVariableStatement(comp) && comp.parent === sf)) comp = comp.parent;

const locals = new Map(), moduleLocals = new Set(), imports = new Map();
const F = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope;
const visit = n => {
  if (ts.isIdentifier(n)) {
    let sym = checker.getSymbolAtLocation(n);
    if (n.parent && ts.isShorthandPropertyAssignment(n.parent) && n.parent.name === n) sym = checker.getShorthandAssignmentValueSymbol(n.parent);
    const d = sym && sym.declarations && sym.declarations[0];
    // only values: variables, parameters, destructured names, functions (not properties, which share their names)
    const valueDecl = d && (ts.isVariableDeclaration(d) || ts.isParameter(d) || ts.isBindingElement(d) || ts.isFunctionDeclaration(d) || ts.isImportSpecifier(d) || ts.isImportClause(d) || ts.isNamespaceImport(d) || ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d) || ts.isEnumDeclaration(d) || ts.isClassDeclaration(d));
    const isPropName = n.parent && ((ts.isBindingElement(n.parent) && n.parent.propertyName === n) || (ts.isPropertyAccessExpression(n.parent) && n.parent.name === n) || (ts.isPropertyAssignment(n.parent) && n.parent.name === n));
    if (!valueDecl || isPropName) { ts.forEachChild(n, visit); return; }
    if (d && d.getSourceFile() === sf) {
      const inside = d.pos >= target.pos && d.end <= target.end;
      if (!inside) {
        if (ts.isImportSpecifier(d) || ts.isImportClause(d) || ts.isNamespaceImport(d)) {
          let imp = d; while (!ts.isImportDeclaration(imp)) imp = imp.parent;
          imports.set(n.text, imp.moduleSpecifier.text);
        } else if (comp && d.pos >= comp.pos && d.end <= comp.end) {
          if (!locals.has(n.text)) locals.set(n.text, checker.typeToString(checker.getTypeOfSymbolAtLocation(sym, n), comp, F));
        } else if (d.parent === sf || (d.parent && d.parent.parent && d.parent.parent.parent === sf) || ts.isInterfaceDeclaration(d) || ts.isTypeAliasDeclaration(d)) {
          moduleLocals.add(n.text);
        }
      }
    }
  }
  ts.forEachChild(n, visit);
};
visit(target);
console.log(JSON.stringify({
  span: [sf.getLineAndCharacterOfPosition(target.getStart(sf)).line + 1, sf.getLineAndCharacterOfPosition(target.end).line + 1],
  locals: [...locals].map(([name, type]) => ({ name, type })),
  moduleLocals: [...moduleLocals],
  imports: [...imports].map(([name, from]) => ({ name, from })),
}, null, 1));
