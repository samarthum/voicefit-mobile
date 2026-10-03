// Real React renderer + actual TSX handlers. Native views alone are host shims.
// Run: MEAL_UI_TEST_DEPS=/path/to/test-deps node components/command-center/__tests__/meal-ui-seam.cjs
// Test deps (kept outside app/native dependency tree): react@19.1.0 react-test-renderer@19.1.0
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const deps = process.env.MEAL_UI_TEST_DEPS;
if (!deps) throw new Error('Set MEAL_UI_TEST_DEPS to the external renderer dependency directory');
const testRequire = createRequire(path.join(deps, 'package.json'));
const React = testRequire('react');
const { create, act } = testRequire('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '../../..');
const native = { StyleSheet: { create: x => x, absoluteFillObject: {} }, useWindowDimensions: () => ({height: 800}), Alert: { alert() {} }, Platform: { OS: 'ios', select: x=>x.ios??x.default }, Keyboard: { dismiss() {}, isVisible:()=>false } };
for (const name of ['View','Text','Pressable','ScrollView','TextInput','ActivityIndicator','Modal']) native[name] = name;
const sheet = { BottomSheetView: 'View', BottomSheetScrollView: 'ScrollView', BottomSheetTextInput: 'TextInput', BottomSheetBackdrop: 'Backdrop' };
let dismissCallback;
sheet.BottomSheetModal = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({ present() {}, dismiss() { dismissCallback = props.onDismiss; } }), [props.onDismiss]);
  return React.createElement('Sheet', props, props.children);
});
function loader(extra = {}) {
  const cache = new Map();
  const shims = { react: React, 'react/jsx-runtime': testRequire('react/jsx-runtime'), 'react-native': native,
    // This older screen-handler seam has no native animation runtime. Lifecycle
    // behavior is tested separately against installed callbacks, not these stubs.
    'react-native-reanimated': {runOnJS:f=>f,useAnimatedReaction(){},Easing:{exp:x=>x,out:f=>f}},
    '@gorhom/bottom-sheet': sheet, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({top:0,bottom:0}), SafeAreaProvider:'View', SafeAreaView:'View' },
    'react-native-keyboard-controller': { KeyboardAwareScrollView:'ScrollView', KeyboardController:{isVisible:()=>false} },
    '@/components/command-center/SheetTextInput': { BottomSheetTextInput: 'TextInput' }, ...extra };
  function load(name, from = path.join(root, 'index.ts')) {
    if (name in shims) return shims[name];
    if (!name.startsWith('@/') && !name.startsWith('.') && !name.startsWith('/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(from), name);
    const file = [base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
    if (!file) throw new Error('Cannot resolve '+name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports:{}}; cache.set(file,module);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(n=>load(n,file),module,module.exports);
    return module.exports;
  }
  const constants=load(path.join(root,'node_modules/@gorhom/bottom-sheet/src/constants.ts'));
  Object.assign(sheet,{ANIMATION_STATUS:constants.ANIMATION_STATUS,useBottomSheetInternal:()=>({
    animatedPosition:{get:()=>0},animatedDetentsState:{get:()=>({closedDetentPosition:800})},
    animatedAnimationState:{get:()=>({status:constants.ANIMATION_STATUS.STOPPED})},
  })});
  return load;
}
const ingredient = (id='a', grams=100.25) => ({id,name:'Rice '+id,grams,calories:120.5,proteinG:2.5,carbsG:25.5,fatG:0.5});
const byId = (r,id) => r.root.findAll(x=>x.type==='TextInput'||x.type==='Pressable').find(x=>x.props.testID===id);
async function editor(overrides={}) {
  const {IngredientEditor} = loader()('@/components/command-center/IngredientEditor');
  const calls=[];
  const props={mode:{kind:'edit',ingredient:ingredient()},fetchInterpreted:async(name,grams)=>({...ingredient(),name,grams}),onSubmitEdit:r=>calls.push(r),onSubmitAdd:r=>calls.push(r),onCancel(){},...overrides};
  let renderer; await act(async()=>{renderer=create(React.createElement(IngredientEditor,props));});
  return {r:renderer,props,calls,Component:IngredientEditor};
}
test('opening a decimal portion preserves the exact grams and starts unchanged',async()=>{
  const {r}=await editor();
  assert.equal(byId(r,'cc-ingredient-editor-grams').props.value,'100.25');
  assert.equal(byId(r,'cc-ingredient-editor-submit').props.disabled,true);
  await act(async()=>r.unmount());
});
test('a cancelled lookup cannot submit to the parent after unmount',async()=>{
  let resolve;
  const {r,calls}=await editor({fetchInterpreted:()=>new Promise(r=>resolve=r)});
  await act(async()=>byId(r,'cc-ingredient-editor-name').props.onChangeText('Paneer'));
  let pending; await act(async()=>{pending=byId(r,'cc-ingredient-editor-submit').props.onPress();});
  await act(async()=>r.unmount());
  await act(async()=>{resolve(ingredient());await pending;});
  assert.equal(calls.length,0);
});
test('edit grams cannot be cleared, zeroed or repaired from a negative input',async()=>{
  const {r}=await editor();
  await act(async()=>byId(r,'cc-ingredient-editor-name').props.onChangeText('Paneer'));
  for (const value of ['', '0', '-5', '1.2.3']) {
    await act(async()=>byId(r,'cc-ingredient-editor-grams').props.onChangeText(value));
    assert.equal(byId(r,'cc-ingredient-editor-submit').props.disabled,true,`invalid: ${value}`);
  }
  await act(async()=>r.unmount());
});
test('grams-only scaling preserves decimal nutrition without a lookup',async()=>{
  let fetched=0;
  const {r,calls}=await editor({fetchInterpreted:async()=>{fetched++;return ingredient();}});
  await act(async()=>byId(r,'cc-ingredient-editor-grams').props.onChangeText('50.125'));
  await act(async()=>byId(r,'cc-ingredient-editor-submit').props.onPress());
  assert.equal(fetched,0);
  assert.deepEqual(calls,[{...ingredient(),grams:50.125,calories:60.25,proteinG:1.25,carbsG:12.75,fatG:0.25}]);
  await act(async()=>r.unmount());
});
test('cancel during a lookup suppresses the callback even before native sheet unmount',async()=>{
  let resolve; let cancelled=0;
  const {r,calls}=await editor({fetchInterpreted:()=>new Promise(r=>resolve=r),onCancel:()=>cancelled++});
  await act(async()=>byId(r,'cc-ingredient-editor-name').props.onChangeText('Paneer'));
  await act(async()=>byId(r,'cc-ingredient-editor-submit').props.onPress());
  assert.notEqual(byId(r,'cc-ingredient-editor-cancel').props.disabled,true);
  await act(async()=>byId(r,'cc-ingredient-editor-cancel').props.onPress());
  await act(async()=>resolve(ingredient()));
  assert.equal(cancelled,1);assert.equal(calls.length,0);
  await act(async()=>r.unmount());
});
test('late native requestClose from the previous session cannot close a reopened editor',async()=>{
  const {IngredientEditorSheet}=loader()('@/components/command-center/IngredientEditorSheet');
  let closed=0;
  const props={fetchInterpreted:async()=>ingredient(),onSubmitEdit(){},onSubmitAdd(){},onClose(){closed++;}};
  let r; await act(async()=>{r=create(React.createElement(IngredientEditorSheet,{...props,mode:{kind:'edit',ingredient:ingredient('a')}}));});
  const oldDismiss=r.root.findByType('Modal').props.onRequestClose;
  await act(async()=>r.update(React.createElement(IngredientEditorSheet,{...props,mode:null})));
  await act(async()=>r.update(React.createElement(IngredientEditorSheet,{...props,mode:{kind:'edit',ingredient:ingredient('b')}})));
  await act(async()=>oldDismiss());
  assert.equal(closed,0);
  await act(async()=>r.unmount());
});
test('switching sheet selection remounts the editor with the new row',async()=>{
  const {IngredientEditorSheet}=loader()('@/components/command-center/IngredientEditorSheet');
  const props={fetchInterpreted:async()=>ingredient(),onSubmitEdit(){},onSubmitAdd(){},onClose(){}};
  let r; await act(async()=>{r=create(React.createElement(IngredientEditorSheet,{...props,mode:{kind:'edit',ingredient:ingredient('a')}}));});
  await act(async()=>r.update(React.createElement(IngredientEditorSheet,{...props,mode:{kind:'edit',ingredient:ingredient('b',22.75)}})));
  assert.equal(byId(r,'cc-ingredient-editor-name').props.value,'Rice b');
  assert.equal(byId(r,'cc-ingredient-editor-grams').props.value,'22.75');
  await act(async()=>r.unmount());
});

async function savedEditor(initial) {
  let data=initial, routeId=initial.id, back=0, failure=null;
  const pushes=[], requests=[];
  const cache=[];
  const useMutation=options=>{
    const [isPending,setPending]=React.useState(false);
    return {isPending,mutate:async()=>{setPending(true);try {const result=await options.mutationFn();await options.onSuccess?.(result);}catch(e){options.onError?.(e);}finally{setPending(false);}}};
  };
  const load=loader({
    '@clerk/clerk-expo':{useAuth:()=>({isSignedIn:true,getToken:async()=> 'token'})},
    '@tanstack/react-query':{useQuery:()=>({data,isLoading:false,isError:false}),useMutation,useQueryClient:()=>({invalidateQueries:async k=>cache.push(k),setQueryData(){}})},
    'expo-router':{Stack:{Screen:'Screen'},useLocalSearchParams:()=>({id:routeId}),useRouter:()=>({back:()=>back++,push:p=>pushes.push(p)})},
    'react-native-gesture-handler':{GestureHandlerRootView:'View'},
    '@gorhom/bottom-sheet':{...sheet,BottomSheetModalProvider:'View'},
    '@/lib/haptics':{haptic:{success(){},warning(){}}},
    '@/lib/api/meal-edit':{saveMealEdits:async(id,token,edits)=>{requests.push({id,edits});if(failure)throw failure;return data;}},
    '@/lib/api/ingredient':{fetchInterpretedIngredient:async()=>ingredient()},
    '@/lib/api-client':{apiRequest:async(url,options)=>{requests.push({url,...options});return data;}},
    '@/components/meal-edit':{StatusNotice:'StatusNotice',MealSummaryCard:'MealSummaryCard',IngredientList:'IngredientList',MealActionsBar:'MealActionsBar'},
  });
  const Component=load('@/app/meal-edit/[id]').default;let r;
  await act(async()=>{r=create(React.createElement(Component));});
  return {r,pushes,requests,setFailure:e=>failure=e,back:()=>back,update:async(next,id=routeId)=>{data=next;routeId=id;await act(async()=>r.update(React.createElement(Component)));}};
}
test('actual saved screen opens repeat confirmation and retries failed estimate on the same ID',async()=>{
  const s=await savedEditor(savedMeal());
  await act(async()=>byId(s.r,'meal-edit-repeat').props.onPress());
  assert.deepEqual(s.pushes,[{pathname:'/meal-repeat',params:{id:'one'}}]);
  await s.update({...savedMeal(),interpretationStatus:'failed'});
  await act(async()=>byId(s.r,'meal-edit-retry-estimate').props.onPress());
  assert.ok(s.requests.some(r=>r.url==='/api/meals/one/retry'&&r.method==='POST'));
  assert.ok(!s.requests.some(r=>r.url==='/api/meals'));
  await act(async()=>s.r.unmount());
});
const savedMeal=(id='one',name='Rice')=>({id,description:'Lunch '+id,mealType:'lunch',eatenAt:'2026-10-02T12:00:00Z',calories:120.5,proteinG:2.5,carbsG:25.5,fatG:0.5,totalGrams:100.25,interpretationStatus:'reviewed',ingredients:[{...ingredient(),name,position:0}]});
test('actual saved screen rehydrates when route switches to another meal',async()=>{
  const s=await savedEditor(savedMeal());
  await s.update(savedMeal('two','Paneer'),'two');
  assert.equal(s.r.root.findByType('IngredientList').props.ingredients[0].name,'Paneer');
  await act(async()=>s.r.unmount());
});
test('late estimate cannot replace an already edited meal type',async()=>{
  const s=await savedEditor({...savedMeal(),interpretationStatus:'interpreting',ingredients:[]});
  await act(async()=>s.r.root.findByType('MealSummaryCard').props.onSelectMealType('dinner'));
  await s.update({...savedMeal(),interpretationStatus:'needs_review'});
  assert.equal(s.r.root.findByType('MealSummaryCard').props.mealType,'dinner');
  await act(async()=>s.r.unmount());
});
test('actual saved screen retains scaled draft and dirty save action after failure',async()=>{
  const s=await savedEditor(savedMeal());
  await act(async()=>{const list=s.r.root.findByType('IngredientList');list.props.onEdit(list.props.ingredients[0]);});
  await act(async()=>byId(s.r,'cc-ingredient-editor-grams').props.onChangeText('50.125'));
  await act(async()=>byId(s.r,'cc-ingredient-editor-submit').props.onPress());
  s.setFailure(new Error('offline'));
  await act(async()=>s.r.root.findByType('MealActionsBar').props.onPrimaryAction());
  assert.equal(s.back(),0);
  assert.equal(s.r.root.findByType('MealActionsBar').props.primaryDisabled,false);
  assert.equal(s.r.root.findByType('IngredientList').props.ingredients[0].calories,60.25);
  await s.update({...savedMeal(),ingredients:[{...ingredient(),name:'stale',position:0}]});
  assert.equal(s.r.root.findByType('IngredientList').props.ingredients[0].name,'Rice');
  await act(async()=>s.r.unmount());
});
test('retry completion hydrates new components without overwriting a dirty draft',async()=>{
  const s=await savedEditor({...savedMeal(),updatedAt:'2026-10-02T08:00:00Z',interpretationStatus:'failed',ingredients:[]});
  await act(async()=>byId(s.r,'meal-edit-retry-estimate').props.onPress());
  await s.update({...savedMeal(),updatedAt:'2026-10-02T09:00:00Z',interpretationStatus:'needs_review'});
  assert.equal(s.r.root.findByType('IngredientList').props.ingredients[0]?.name,'Rice');
  await act(async()=>s.r.unmount());
});
test('saved editor preserves unknown nutrition through proportional edits and uses loaded version after a refetch',async()=>{
  const original={...savedMeal(),updatedAt:'2026-10-02T08:00:00Z',ingredients:[{...ingredient(),position:0,proteinG:null}]};
  const s=await savedEditor(original);
  assert.equal(s.r.root.findByType('IngredientList').props.ingredients[0].proteinG,null);
  await act(async()=>{const list=s.r.root.findByType('IngredientList');list.props.onEdit(list.props.ingredients[0]);});
  await act(async()=>byId(s.r,'cc-ingredient-editor-grams').props.onChangeText('50.125'));
  assert.match(textOf(s.r),/60.25/);
  assert.match(textOf(s.r),/Unknown/);
  await act(async()=>byId(s.r,'cc-ingredient-editor-submit').props.onPress());
  await s.update({...original,updatedAt:'2026-10-02T09:00:00Z'});
  await act(async()=>s.r.root.findByType('MealActionsBar').props.onPrimaryAction());
  assert.equal(s.requests.find(r=>r.edits).edits.ingredients[0].proteinG,null);
  assert.equal(s.requests.find(r=>r.edits).edits.expectedUpdatedAt,original.updatedAt);
  await act(async()=>s.r.unmount());
});
test('real meals screen launches familiar selection and repeat route passes the selected source ID',async()=>{
  const pushes=[];
  const load=loader({
    '@clerk/clerk-expo':{useAuth:()=>({isSignedIn:true,getToken:async()=> 'token'})},
    '@tanstack/react-query':{useInfiniteQuery:()=>({data:{pages:[{meals:[],total:0}]}}),useMutation:()=>({isPending:false}),useQueryClient:()=>({})},
    'expo-router':{Stack:{Screen:'Screen'},useLocalSearchParams:()=>({id:'one'}),useRouter:()=>({push:p=>pushes.push(p),back(){},replace(){}})},
    '@/hooks/use-screen-timing':{useScreenTiming(){}},
    '@/components/FloatingCommandBar':{FloatingCommandBar:'CommandBar'},
    '@/components/command-center':{useCommandCenter:()=>({open(){},startRecording(){}}),toLocalDateString:d=>d.toISOString().slice(0,10)},
    '@/lib/web-preview-mode':{isWebPreviewMode:()=>false},
    '@/lib/api-client':{apiRequest:async()=>({})},
    '@/lib/haptics':{haptic:{tap(){},warning(){}}},
    '@/components/Icon':{Icon:'Icon'},
    '@/components/meal-repeat/RepeatMealFlow':{RepeatMealFlow:'RepeatFlow'},
  });
  const Meals=load('@/app/meals').default;let r;
  await act(async()=>{r=create(React.createElement(Meals));});
  await act(async()=>byId(r,'meals-repeat-open').props.onPress());
  assert.deepEqual(pushes,[{pathname:'/meal-repeat'}]);
  await act(async()=>r.unmount());
  const Route=load('@/app/meal-repeat').default;
  await act(async()=>{r=create(React.createElement(Route));});
  assert.equal(r.root.findByType('RepeatFlow').props.initialMealId,'one');
  await act(async()=>r.unmount());
});

async function repeatFlow(initialId='one') {
  const calls=[], invalidations=[]; let failures=0, uuid=0, deleteResult={deleted:true};
  const source=savedMeal();
  const canonical={...source,id:'new-record',description:'Canonical server meal',calories:59.75,ingredients:[{...source.ingredients[0],grams:49.75,calories:59.75}]};
  const load=loader({
    '@clerk/clerk-expo':{useAuth:()=>({getToken:async()=> 'token'})},
    '@tanstack/react-query':{useQueryClient:()=>({setQueryData:(key,value)=>calls.push({cache:key,value}),invalidateQueries:async key=>invalidations.push(key)})},
    'expo-crypto':{randomUUID:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`},
    '@/lib/api-client':{apiRequest:async(url,options={})=>{
      calls.push({url,...options,parsedBody:options.body?JSON.parse(options.body):undefined});
      if(options.method==='DELETE')return deleteResult;
      if(url.endsWith('/repeat')){if(failures-->0)throw new Error('network uncertain');return canonical;}
      if(url.startsWith('/api/meals?'))return {meals:[{...source,ingredients:undefined},{...savedMeal('two','Paneer'),ingredients:undefined}],total:2};
      return url.endsWith('/two')?savedMeal('two','Paneer'):source;
    }},
  });
  const Component=load('@/components/meal-repeat/RepeatMealFlow').RepeatMealFlow;
  let r;await act(async()=>{r=create(React.createElement(Component,{initialMealId:initialId,onClose(){}}));});
  return {r,calls,invalidations,source,canonical,fail:n=>failures=n,undoResult:value=>deleteResult=value};
}
const textOf=r=>r.root.findAllByType('Text').map(x=>x.children.filter(y=>typeof y==='string').join('')).join('\n');
test('undo stays retryable until the server confirms deletion',async()=>{
  const f=await repeatFlow();
  await act(async()=>byId(f.r,'meal-repeat-save').props.onPress());
  f.undoResult({deleted:false});
  await act(async()=>byId(f.r,'meal-repeat-undo').props.onPress());
  assert.ok(byId(f.r,'meal-repeat-undo'));
  assert.match(textOf(f.r),/not confirm/i);
  f.undoResult({deleted:true});
  await act(async()=>byId(f.r,'meal-repeat-undo').props.onPress());
  assert.match(textOf(f.r),/Repeat removed/);
  await act(async()=>f.r.unmount());
});
test('chooser selects exact source, validates custom portions and blocks duplicate saves',async()=>{
  const f=await repeatFlow('');
  assert.ok(!f.calls.some(c=>c.url==='/api/meals/one'));
  await act(async()=>byId(f.r,'meal-repeat-source-two').props.onPress());
  assert.ok(f.calls.some(c=>c.url==='/api/meals/two'));
  for(const value of ['0','-1','21','']){
    await act(async()=>byId(f.r,'meal-repeat-custom').props.onChangeText(value));
    assert.equal(byId(f.r,'meal-repeat-save').props.disabled,true);
  }
  await act(async()=>byId(f.r,'meal-repeat-custom').props.onChangeText('1.25'));
  const press=byId(f.r,'meal-repeat-save').props.onPress;
  await act(async()=>{press();press();});
  const writes=f.calls.filter(c=>c.url?.endsWith('/repeat'));
  assert.equal(writes.length,1);
  assert.equal(writes[0].url,'/api/meals/two/repeat');
  assert.equal(writes[0].parsedBody.portionMultiplier,1.25);
  await act(async()=>f.r.unmount());
});
test('repeat loads full saved source, previews proportional ingredients, retries identical UUID and undoes only canonical new record',async()=>{
  const f=await repeatFlow();
  assert.ok(f.calls.some(c=>c.url==='/api/meals/one'));
  await act(async()=>byId(f.r,'meal-repeat-portion-0.5').props.onPress());
  assert.match(textOf(f.r),/50.125/);
  assert.match(textOf(f.r),/proportional/i);
  f.fail(1);
  await act(async()=>byId(f.r,'meal-repeat-save').props.onPress());
  assert.ok(byId(f.r,'meal-repeat-save'));
  assert.match(textOf(f.r),/network uncertain/);
  await act(async()=>byId(f.r,'meal-repeat-save').props.onPress());
  const writes=f.calls.filter(c=>c.url?.endsWith('/repeat'));
  assert.equal(writes.length,2);
  assert.deepEqual(writes[0].parsedBody,writes[1].parsedBody);
  assert.equal(writes[0].parsedBody.portionMultiplier,0.5);
  assert.equal(f.calls.filter(c=>c.url==='/api/meals'&&c.method==='POST').length,0);
  assert.match(textOf(f.r),/Canonical server meal/);
  assert.match(textOf(f.r),/59.75/);
  assert.ok(f.calls.some(c=>c.cache?.[1]==='new-record'));
  await act(async()=>byId(f.r,'meal-repeat-undo').props.onPress());
  assert.deepEqual(f.calls.filter(c=>c.method==='DELETE').map(c=>c.url),['/api/meals/new-record']);
  assert.ok(f.invalidations.some(k=>k.queryKey[0]==='dashboard'));
  await act(async()=>f.r.unmount());
});
