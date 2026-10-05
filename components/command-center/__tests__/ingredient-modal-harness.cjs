// Actual application host/form/callers + installed RN 0.81 Modal JS wrapper.
// Native RCTModalHostView, keyboard geometry, auth/HTTP/cache are local seams.
// No device/IME/gesture evidence. No dependency-tree modifications.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),app=createRequire(path.join(root,'package.json'));
const deps=createRequire(path.join(process.env.MEAL_UI_TEST_DEPS,'package.json'));
const React=deps('react'),{create,act}=deps('react-test-renderer'),ts=app('typescript');
global.IS_REACT_ACT_ENVIRONMENT=true;global.__DEV__=false;
const ingredient=(id='a')=>({id,name:'Rice '+id,grams:100.25,calories:120.5,proteinG:2.5,carbsG:25.5,fatG:0.5});
const meal=()=>({kind:'meal',interpreted:{payload:{description:'Rice lunch',mealType:'lunch',calories:241}},transcript:'Rice lunch',totalGrams:200.5,eatenAtLabel:'12 PM',macros:{protein:5,carbs:51,fat:1},ingredients:[ingredient('a'),ingredient('b')]});
async function harness({caller='single',lookup,os='android',unknownNutrition=false}={}){
 const log=[],cache=new Map(),backListeners=new Set();let keyboardVisible=false,routeId='saved-one',ports,api,renderer,mode,setMode;
 const native={PanResponder:{create:()=>({panHandlers:{}})},StyleSheet:{create:x=>x,absoluteFillObject:{},flatten:x=>x},useWindowDimensions:()=>({height:844,width:390,fontScale:1}),Platform:{OS:os,select:x=>x[os]??x.default},Keyboard:{isVisible:()=>keyboardVisible,dismiss(){log.push({event:'keyboardDismiss'})}},BackHandler:{addEventListener:(_event,f)=>{backListeners.add(f);return {remove:()=>backListeners.delete(f)}}},Alert:{alert(){}},Linking:{openSettings:async()=>{}}};
 for(const n of ['View','Text','Pressable','ScrollView','TextInput','ActivityIndicator'])native[n]=n;
 // Execute the installed Modal class and its native-host prop forwarding intact.
 const modalFile=path.join(root,'node_modules/react-native/Libraries/Modal/Modal.js');
 const modalCode=app('@babel/core').transformSync(fs.readFileSync(modalFile,'utf8'),{filename:modalFile,babelrc:false,configFile:false,presets:[app.resolve('@react-native/babel-preset')]}).code;
 const ScrollView=()=>null;ScrollView.Context=React.createContext(null);
 const modalImports={react:React,'../EventEmitter/NativeEventEmitter':class {},'./NativeModalManager':null,'./RCTModalHostViewNativeComponent':'RCTModalHostView','@react-native/virtualized-lists':{VirtualizedListContextResetter:({children})=>children},'../Components/ScrollView/ScrollView':{default:ScrollView},'../Components/View/View':{default:'View'},'../ReactNative/AppContainer':{default:({children})=>children},'../ReactNative/I18nManager':{default:{getConstants:()=>({isRTL:false})}},'../ReactNative/RootTag':{RootTagContext:React.createContext(1)},'../StyleSheet/StyleSheet':{default:native.StyleSheet},'../Utilities/Platform':{default:native.Platform}};
 const m={exports:{}};new Function('require','module','exports',modalCode)(n=>{if(n==='react/jsx-runtime')return deps(n);if(n.startsWith('@babel/runtime/'))return app(n);assert.ok(n in modalImports,'Modal native seam '+n);return modalImports[n]},m,m.exports);native.Modal=m.exports.default;
 const sheetModal=React.forwardRef((props,ref)=>{React.useImperativeHandle(ref,()=>({present(){log.push({event:'sheetPresent'})},dismiss(){log.push({event:'sheetDismiss'})}}),[]);return React.createElement('ParentSheet',props,props.children)});
 const sheet={ANIMATION_STATUS:{RUNNING:1,STOPPED:0},useBottomSheetInternal:()=>({animatedPosition:{get:()=>0},animatedDetentsState:{get:()=>({closedDetentPosition:844})},animatedAnimationState:{get:()=>({status:0})}}),BottomSheetModal:sheetModal,BottomSheetModalProvider:({children})=>children,BottomSheetView:'View',BottomSheetScrollView:'ScrollView',BottomSheetBackdrop:'Backdrop',BottomSheetFooter:'Footer'};
 const overrides={react:React,'react/jsx-runtime':deps('react/jsx-runtime'),'react-native':native,'react-native-reanimated':{runOnJS:f=>f,useAnimatedReaction(){},Easing:{exp:x=>x,out:f=>f}},'@gorhom/bottom-sheet':sheet,'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,bottom:34,left:0,right:0}),SafeAreaView:'SafeAreaView',SafeAreaProvider:({children})=>children},'react-native-keyboard-controller':{KeyboardAwareScrollView:'KeyboardAwareScrollView',KeyboardController:{isVisible:()=>keyboardVisible}},'react-native-gesture-handler':{GestureHandlerRootView:'View'},'@/components/command-center/SheetTextInput':{BottomSheetTextInput:'TextInput'},'@/lib/haptics':{haptic:{tap(){},press(){},success(){},warning(){}}},'@/components/Icon':{Icon:'Icon'},'expo-router':{useRouter:()=>({push(){}}),useFocusEffect(){}},'expo-audio':{useAudioRecorder:()=>({}),RecordingPresets:{HIGH_QUALITY:{}},requestRecordingPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{}},'expo-image-picker':{},'expo-crypto':{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},'@clerk/clerk-expo':{useAuth:()=>({getToken:async()=> 'fixture-only',isSignedIn:true})},'@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>({getQueriesData:()=>[],setQueryData(){},invalidateQueries:async()=>{}})},'@/lib/web-preview-mode':{isWebPreviewMode:()=>false},'@/lib/api/ingredient':{fetchInterpretedIngredient:async(_token,name,grams)=>{log.push({event:'lookup',name,grams});return lookup?lookup(name,grams):{...ingredient('lookup'),name,grams:grams??100}}},'@/lib/api-client':{apiRequest:async()=>{throw Error('unexpected API write')},apiFormRequest:async()=>{throw Error('unexpected API write')}}};
 function load(name,from=path.join(root,'index.ts')){
  if(name in overrides)return overrides[name];
  if(!name.startsWith('@/')&&!name.startsWith('.')&&!path.isAbsolute(name))return app(name);
  const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(from),name);
  const file=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());assert.ok(file,'Resolve '+name);
  if(cache.has(file))return cache.get(file).exports;
  const m={exports:{}};cache.set(file,m);
  const relative=path.relative(root,file);
  const sourceFile=process.env.INGREDIENT_MODAL_SOURCE_ROOT&&['components/command-center/IngredientEditor.tsx','components/command-center/IngredientEditorSheet.tsx'].includes(relative)?path.join(process.env.INGREDIENT_MODAL_SOURCE_ROOT,relative):file;
  const code=ts.transpileModule(fs.readFileSync(sourceFile,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',code)(n=>load(n,file),m,m.exports);return m.exports;
 }
 const Host=load('@/components/command-center/IngredientEditorSheet').IngredientEditorSheet;
 let Saved;
 if(caller==='saved'){
  const data={id:routeId,description:'Saved lunch',mealType:'lunch',eatenAt:'2026-10-02T12:00:00Z',updatedAt:'2026-10-02T12:00:00Z',interpretationStatus:'reviewed',calories:241,proteinG:5,carbsG:51,fatG:1,totalGrams:200.5,ingredients:[{...ingredient('a'),position:0},{...ingredient('b'),position:1}]};
  if(unknownNutrition)data.ingredients[0].proteinG=null;
  overrides['expo-router']={Stack:{Screen:'Screen'},useLocalSearchParams:()=>({id:routeId}),useRouter:()=>({back:()=>log.push({event:'navigationBack'}),push(){throw Error('unexpected navigation')}})};
  overrides['@tanstack/react-query']={useQuery:()=>({data,isLoading:false,isError:false}),useMutation:()=>({isPending:false,mutate(){throw Error('unexpected final meal write')}}),useQueryClient:()=>({setQueryData(){},invalidateQueries:async()=>{}})};
  Saved=load('@/app/meal-edit/[id]').default;
 }
 function Single(){[mode,setMode]=React.useState(null);return React.createElement(Host,{mode,fetchInterpreted:lookup??(async(name,grams)=>{log.push({event:'lookup',name,grams});return {...ingredient('lookup'),name,grams:grams??100}}),onSubmitAdd:r=>{log.push({event:'submit',result:r});setMode(null)},onSubmitEdit:r=>{log.push({event:'submit',result:r});setMode(null)},onClose:()=>{log.push({event:'close'});setMode(null)}})}
 await act(async()=>{renderer=create(caller==='saved'?React.createElement(Saved):React.createElement(Single))});
 const byId=id=>renderer.root.findAll(n=>typeof n.type==='string'&&n.props.testID===id)[0];
 const draft=()=>structuredClone(caller==='saved'?renderer.root.findByType(load('@/components/meal-edit/IngredientList').IngredientList).props.ingredients:log.filter(e=>e.event==='submit').map(e=>e.result));
 return {renderer,byId,log,backListeners,Host,load,modal:()=>renderer.root.findAllByType('RCTModalHostView')[0],draft,
  mode:()=>caller==='single'?mode:renderer.root.findByType(Host).props.mode,
  open:async id=>{await act(async()=>caller==='single'?setMode(id==='add'?{kind:'add'}:{kind:'edit',ingredient:ingredient(id)}):byId(caller==='saved'?(id==='add'?'meal-edit-add-ingredient':'meal-edit-ingredient-'+(id==='a'?0:1)):'unused').props.onPress())},
  setMode:async next=>{await act(async()=>setMode(next))},
  press:async id=>{await act(async()=>byId(id).props.onPress())},
  type:async(id,value)=>{await act(async()=>byId(id).props.onChangeText(value))},
  setKeyboardVisible:v=>{keyboardVisible=v},
  requestClose:async()=>{await act(async()=>{const m=renderer.root.findAllByType('RCTModalHostView')[0];assert.ok(m,'Native modal host required');m.props.onRequestClose()})},
  switchRoute:async()=>{routeId='saved-two';await act(async()=>renderer.update(React.createElement(Saved)))},
  leaveReview:async()=>{await act(async()=>ports.setCommandState('cc_collapsed'))},
  close:async()=>{await act(async()=>renderer.unmount());assert.equal(backListeners.size,0)},
 };
}
module.exports={harness,React,act,ingredient,root};
