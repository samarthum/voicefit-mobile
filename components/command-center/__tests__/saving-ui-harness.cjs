// Actual SavingState/SheetShell/Overlay TSX; module-local native/provider seams.
// This verifies rendered props and overlay lifecycle, NOT physical native layout.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const root = path.resolve(__dirname, '../../..');
const appRequire = createRequire(path.join(root, 'package.json'));
const ts = appRequire('typescript');
if (!process.env.MEAL_UI_TEST_DEPS) throw Error('Set MEAL_UI_TEST_DEPS to matching external renderer dependencies');
const deps = createRequire(path.join(process.env.MEAL_UI_TEST_DEPS, 'package.json'));
const React = deps('react');
const {create, act} = deps('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function seam({height=844,width=390,fontScale=1,top=24,bottom=34}={}) {
  let snapshot={state:'cc_collapsed',review:null,error:{copy:null},toast:{message:null}};
  const events=[], dispatches=[];
  const native={StyleSheet:{create:x=>x,absoluteFillObject:{}},useWindowDimensions:()=>({height,width,fontScale,scale:1}),Alert:{alert(){throw Error('Unexpected alert')}}};
  for(const name of ['View','Text','Pressable','ScrollView','ActivityIndicator'])native[name]=name;
  let currentModal;
  const Modal=React.forwardRef((props,ref)=>{
    currentModal=props;
    React.useEffect(()=>{events.push('mount');return()=>events.push('unmount')},[]);
    React.useImperativeHandle(ref,()=>({present(){events.push('present')},dismiss(){events.push('dismiss')}}),[]);
    return React.createElement('NativeModal',props,props.children);
  });
  const overrides={react:React,'react/jsx-runtime':deps('react/jsx-runtime'),'react-native':native,
    'react-native-safe-area-context':{useSafeAreaInsets:()=>({top,bottom,left:0,right:0})},
    '@gorhom/bottom-sheet':{BottomSheetModal:Modal,BottomSheetView:'View',BottomSheetScrollView:'ScrollView',BottomSheetBackdrop:'Backdrop',BottomSheetFooter:'Footer'},
    '@/components/command-center/CommandCenterProvider':{useCommandCenterOverlay:()=>({snapshot,dispatch:a=>dispatches.push(a)})},
    '@/components/command-center/IngredientEditorSheet':{IngredientEditorSheet:()=>null},
    '@/components/Icon':{Icon:'Icon'},
    '@/components/pulse/VoiceRing':{VoiceRing:'VoiceRing'},
  };
  for(const name of ['IdleState','PhotoState','RecordingState','InterpretingState','MealReviewState','WorkoutReviewState','ReviewActionsFooter','ErrorState','SavedToastState'])overrides['@/components/command-center/states/'+name]={[name]:()=>React.createElement(name)};
  const cache=new Map();
  function load(name,from=path.join(root,'index.ts')) {
    if(name in overrides)return overrides[name];
    if(!name.startsWith('@/')&&!name.startsWith('.')&&!path.isAbsolute(name))return appRequire(name);
    const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(from),name);
    const file=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
    assert.ok(file,'Resolve '+name);
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(n=>load(n,file),module,module.exports);
    return module.exports;
  }
  return {load,events,dispatches,modal:()=>currentModal,setSnapshot:next=>{snapshot={...snapshot,...next}}};
}
async function renderSaving(kind,options) {
  const s=seam(options), Saving=s.load('@/components/command-center/states/SavingState').SavingState;
  let r; await act(async()=>{r=create(React.createElement(Saving,{kind,onClose:()=>s.dispatches.push({type:'close'})}))});
  return {...s,r,close:()=>act(async()=>r.unmount())};
}
async function renderOverlay(options) {
  const s=seam(options), Overlay=s.load('@/components/command-center/CommandCenterOverlay').CommandCenterOverlay;
  let r;await act(async()=>{r=create(React.createElement(Overlay))});
  return {...s,r,update:async next=>{s.setSnapshot(next);await act(async()=>r.update(React.createElement(Overlay)))},close:()=>act(async()=>r.unmount())};
}
function textOf(r){return r.root.findAll(n=>n.type==='Text').map(n=>n.props.children).flat(Infinity).join(' ')}
module.exports={React,act,seam,renderSaving,renderOverlay,textOf,root};
