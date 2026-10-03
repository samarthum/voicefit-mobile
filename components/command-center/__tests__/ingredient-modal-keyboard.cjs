// Installed keyboard-controller 1.18.5 calculation seams, not device/IME proof.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root}=require('./ingredient-modal-harness.cjs');const ts=require('typescript');
const library=path.join(root,'node_modules/react-native-keyboard-controller');
function fn(name,env){
 const file=path.join(library,'src/components/KeyboardAwareScrollView/index.tsx'),source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let init;
 function walk(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)init=n.initializer;ts.forEachChild(n,walk)}walk(tree);assert.ok(init);
 const code=ts.transpileModule('module.exports='+init.arguments[0].getText(tree),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
 new Function(...Object.keys(env),'module',code)(...Object.values(env),m);return m.exports;
}
const sv=value=>({value});
const interpolate=(v,[a,b],[c,d])=>a===b?d:c+(v-a)*(d-c)/(b-a);
test('installed aware scroll lifts decimal grams, handles refocus and ignores another scroll owner',()=>{
 const calls=[],env={enabled:true,layout:sv({parentScrollViewTarget:7,layout:{absoluteY:550,height:48}}),scrollViewTarget:sv(7),height:844,keyboardHeight:sv(320),bottomOffset:16,initialKeyboardSize:sv(0),scrollPosition:sv(0),snapToOffsets:undefined,scrollViewAnimatedRef:{},interpolate,scrollDistanceWithRespectToSnapPoints:x=>x,scrollTo:(_ref,x,y,animated)=>calls.push({x,y,animated})};
 const scroll=fn('maybeScroll',env);assert.equal(scroll(320),90);assert.deepEqual(calls,[{x:0,y:90,animated:false}]);
 env.layout.value={parentScrollViewTarget:7,layout:{absoluteY:420,height:100}};assert.equal(scroll(320,true),12,'large-font input bottom plus offset');
 env.layout.value={parentScrollViewTarget:7,layout:{absoluteY:100,height:48}};assert.equal(scroll(320,true),0,'name focus already above IME');
 env.layout.value={parentScrollViewTarget:8,layout:{absoluteY:700,height:48}};assert.equal(scroll(320),0,'underlying review is a separate scroll owner');
 env.keyboardHeight.value=0;env.layout.value={parentScrollViewTarget:7,layout:{absoluteY:550,height:48}};assert.equal(scroll(0),0,'hidden keyboard');
});
test('installed aware scroll creates keyboard-height scroll space for form actions and releases it on hide',()=>{
 const env={keyboardHeight:sv(320),extraKeyboardSpace:0,currentKeyboardFrameHeight:sv(0),interpolate};const sync=fn('syncKeyboardFrame',env);
 sync({height:320});assert.equal(env.currentKeyboardFrameHeight.value,320);sync({height:0});assert.equal(env.currentKeyboardFrameHeight.value,0);
});
test('production uses one root provider and installed modal watcher forwards dialog IME/input ownership to it',()=>{
 const form=fs.readFileSync(path.join(root,'components/command-center/IngredientEditor.tsx'),'utf8'),host=fs.readFileSync(path.join(root,'components/command-center/IngredientEditorSheet.tsx'),'utf8');
 assert.match(form,/KeyboardAwareScrollView/);assert.doesNotMatch(form,/BottomSheetTextInput|BottomSheetScrollView/);assert.doesNotMatch(host,/@gorhom|useAnimatedReaction|requestAnimationFrame|BackHandler\s*\.\s*addEventListener/);
 // BackHandler appears only in explanatory prose, never a scoped listener.
 const kotlin=fs.readFileSync(path.join(library,'android/src/main/java/com/reactnativekeyboardcontroller/modal/ModalAttachedWatcher.kt'),'utf8');
 assert.match(kotlin,/view = rootView/);assert.match(kotlin,/eventPropagationView = view/);assert.match(kotlin,/SOFT_INPUT_ADJUST_NOTHING/);
 const callback=fs.readFileSync(path.join(library,'android/src/main/java/com/reactnativekeyboardcontroller/listeners/KeyboardAnimationCallback.kt'),'utf8');assert.match(callback,/FocusedInputObserver\(view = view, eventPropagationView = eventPropagationView/);
});
