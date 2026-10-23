import ts from 'typescript';
import { stableId } from './chunks.js';

export function parseCode(record) {
  if(record.source_path?.endsWith('.py')){
    const symbols=[],references=[],imports=[];
    for(const [i,line] of record.content.split('\n').entries()){
      const named=line.match(/^\s*(?:async\s+)?(def|class)\s+(\w+)/);
      if(named)symbols.push({id:stableId(`${record.id}:${named[2]}:${i}`),name:named[2],kind:named[1]==='class'?'PythonClassPartial':'PythonFunctionPartial',line:i+1,end_line:i+1,signature:line.trim().slice(0,300)});
      const imported=line.match(/^\s*(?:from\s+([\w.]+)\s+)?import\s+([\w.]+)/);if(imported)imports.push(imported[1]??imported[2]);
      if(!named)for(const m of line.matchAll(/\b([A-Za-z_]\w*)\s*\(/g))references.push({name:m[1],line:i+1});
    }
    return {symbols,references,imports:[...new Set(imports)],partial:true};
  }

  if (!record.source_path || !/\.[cm]?[jt]sx?$/i.test(record.source_path)) return { symbols: [], references: [], imports: [] };
  const tree = ts.createSourceFile(record.source_path, record.content, ts.ScriptTarget.Latest, true,
    /tsx$/i.test(record.source_path) ? ts.ScriptKind.TSX : /jsx$/i.test(record.source_path) ? ts.ScriptKind.JSX : /\.ts$/i.test(record.source_path) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const symbols = [], references = [], imports = [];
  const line = node => tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
  function walk(node) {
    const named = ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)
      || ts.isMethodDeclaration(node) || (ts.isVariableDeclaration(node) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
    if (named && node.name) {
      const name = node.name.getText(tree);
      symbols.push({ id: stableId(`${record.id}:${name}:${node.pos}`), name, kind: ts.SyntaxKind[node.kind], line: line(node),
        end_line: tree.getLineAndCharacterOfPosition(node.end).line + 1, signature: node.getText(tree).split(/[\r\n{]/)[0].slice(0, 300) });
    }
    if (ts.isCallExpression(node)) {
      const name = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : node.expression.getText(tree);
      if (/^[\w$]+$/.test(name)) references.push({ name, line: line(node) });
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    ts.forEachChild(node, walk);
  }
  walk(tree);
  return { symbols: symbols.slice(0, 2000), references: references.slice(0, 10000), imports: [...new Set(imports)] };
}
