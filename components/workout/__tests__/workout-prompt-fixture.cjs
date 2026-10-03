// Inspect actual mounted AppPrompt host props; no production hook substitution.
// Exposes the former Alert tuple only to retain exact lifecycle assertions.
const {createRequire}=require('node:module'),path=require('node:path');
const app=createRequire(path.resolve(__dirname,'../../../package.json'));
const ts=app('typescript'),fs=require('node:fs');
const file=path.resolve(__dirname,'../../../lib/tokens.ts'),m={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(app,m,m.exports);
const colors=m.exports.color;
function prompt(r){
 const modal=r.root.findAllByType('Modal').find(n=>n.props.accessibilityLabel==='Unsaved set changes');
 if(!modal)return undefined;
 const texts=modal.findAllByType('Text');
 const title=texts.find(n=>n.props.accessibilityRole==='header').props.children;
 const message=texts.find(n=>n.props.children==='Save your typed changes before finishing, or explicitly discard them. Cancel keeps this workout open.').props.children;
 const actions=modal.findAllByType('Pressable').filter(n=>n.props.testID?.startsWith('app-prompt-action')).map(n=>{
  const text=n.findByType('Text');const style=Object.assign({},...text.props.style.filter(Boolean));
  return {text:n.props.accessibilityLabel,style:style.color===colors.negative?'destructive':style.color===colors.textSoft?'cancel':undefined,onPress:n.props.onPress};
 });
 return [title,message,actions,{onDismiss:modal.props.onRequestClose}];
}
module.exports={prompt};
