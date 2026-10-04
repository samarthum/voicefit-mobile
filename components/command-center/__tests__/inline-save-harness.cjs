// Actual provider/controller/overlay/review/footer. Only native/auth/HTTP/cache
// boundaries are local fixtures; this does not verify device gestures or storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),app=createRequire(path.join(root,'package.json'));
const ts=app('typescript'),deps=createRequire(path.join(process.env.MEAL_UI_TEST_DEPS,'package.json'));
const React=deps('react'),{create,act}=deps('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT=true;
const meal=()=>({kind:'meal',source:'text',transcript:'I ate rice',eatenAtLabel:'12:00',totalGrams:100,macros:{protein:2,carbs:25,fat:1},ingredients:[{id:'rice',name:'Rice',grams:100,calories:120,proteinG:2,carbsG:25,fatG:1}],interpreted:{intent:'meal',payload:{mealType:'lunch',description:'Rice',calories:120,proteinG:2,carbsG:25,fatG:1,ingredients:[{name:'Rice',grams:100,calories:120,proteinG:2,carbsG:25,fatG:1}]}}});
const workout=()=>({kind:'workout',source:'text',transcript:'Bench press 80kg for 8 reps',confidence:0.9,exerciseTypeLabel:'Resistance',sessionLabel:'Quick session',sets:[{id:'set-1',setNumber:1,weightKg:'80',reps:'8',notes:''}],interpreted:{intent:'workout_set',payload:{exerciseName:'Bench Press',exerciseType:'resistance',weightKg:80,reps:8,durationMinutes:null,notes:null}}});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}};
async function harness({mediaEvents=[]}={}){
 let api,ports,controller,modal,uuid=0,response=null,refreshFails=false,dashboardData,queryConfig,Dashboard;
 const requests=[],events=[],receipts=new Map(),pushes=[],cache=new Map();
 const token=async()=> 'fixture-token',router={push:p=>pushes.push(p)};
 const native={StyleSheet:{create:x=>x,absoluteFillObject:{}},useWindowDimensions:()=>({width:390,height:844,fontScale:1}),Platform:{OS:'ios',select:x=>x.ios??x.default},Alert:{alert(){}},Keyboard:{dismiss(){}}};
 for(const n of ['View','Text','Pressable','ScrollView','TextInput','ActivityIndicator','Modal','RefreshControl'])native[n]=n;
 const Modal=React.forwardRef((p,ref)=>{modal=p;React.useImperativeHandle(ref,()=>({present(){events.push('present')},dismiss(){events.push('dismiss')}}));return React.createElement('Sheet',p,p.children,p.footerComponent?.({}));});
 const queryClient={getQueriesData:()=>[],setQueryData:(key,updater)=>{const k=JSON.stringify(key);cache.set(k,typeof updater==='function'?updater(cache.get(k)):updater)},invalidateQueries:async()=>{}};
 const http=async(url,options={})=>{const payload=options.body?JSON.parse(options.body):null;requests.push({url,payload});if(url.startsWith('/api/workout-sessions')&&!options.method)return {sessions:[{id:'fixture-session',endedAt:null}]};if(response)return response.promise;const id=payload?.requestId??'request-'+requests.length;if(!receipts.has(id))receipts.set(id,{id:'canonical-'+receipts.size,eatenAt:payload?.eatenAt,calories:null,description:'Meal photo',mealType:'snack',interpretationStatus:'interpreting',ingredients:[]});return receipts.get(id)};
 const shims={react:React,'react/jsx-runtime':deps('react/jsx-runtime'),'react-native':native,
 '@gorhom/bottom-sheet':{BottomSheetModal:Modal,BottomSheetView:'View',BottomSheetScrollView:'ScrollView',BottomSheetFooter:'Footer',BottomSheetBackdrop:'Backdrop'},
 'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:24,bottom:34}),SafeAreaView:'View'},
 '@/components/command-center/SheetTextInput':{BottomSheetTextInput:'TextInput'},
 '@/components/command-center/IngredientEditorSheet':{IngredientEditorSheet:()=>null},
 '@/components/Icon':{Icon:'Icon'},'expo-image':{Image:'Image'},'react-native-svg':{__esModule:true,default:'Svg',Path:'Path',Circle:'Circle'},
 '@/components/command-center/states/RecordingState':{RecordingState:()=>null},
 'react-native-reanimated':(()=>{const chain={duration(){return chain},springify(){return chain}};return {__esModule:true,default:{View:'View',Text:'Text'},FadeIn:chain,FadeInDown:chain,FadeOut:chain,useReducedMotion:()=>true,useSharedValue:v=>({value:v}),useAnimatedStyle:()=>({}),withRepeat:v=>v,withTiming:v=>v,Easing:{inOut:f=>f,quad:x=>x}}})(),
 '@/components/command-center/states/InterpretingState':{InterpretingState:()=>React.createElement('View',{testID:'cc-voice-progress'})},
 'expo-router':{useRouter:()=>router,useFocusEffect(){}},
 'expo-audio':{useAudioRecorder:()=>({prepareToRecordAsync:async()=>{},record(){},stop:async()=>{},uri:'file:///voice.m4a'}),requestRecordingPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{},RecordingPresets:{HIGH_QUALITY:{}}},
 'expo-image-picker':{requestCameraPermissionsAsync:async()=>{mediaEvents.push('camera-permission');return {granted:true}},requestMediaLibraryPermissionsAsync:async()=>{mediaEvents.push('library-permission');return {granted:true}},launchCameraAsync:async()=>{mediaEvents.push('camera-picker');return {canceled:false,assets:[{uri:'file:///camera.png',fileName:'camera.png',mimeType:'image/png',width:1200,height:900}]}},launchImageLibraryAsync:async()=>{mediaEvents.push('library-picker');return {canceled:false,assets:[{uri:'file:///photo.png',fileName:'photo.png',mimeType:'image/png',width:1200,height:900}]}}},
 'expo-crypto':{randomUUID:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`},
 '@clerk/clerk-expo':{useAuth:()=>({getToken:token,isSignedIn:true})},
 '@tanstack/react-query':{useQuery:config=>{if(config.queryKey[0]==='dashboard'){queryConfig=config;return {data:cache.get(JSON.stringify(config.queryKey))??dashboardData,refetch:async()=>{},error:null}}return {data:[]}},useIsRestoring:()=>false,useQueryClient:()=>queryClient},
 '@/hooks/use-screen-timing':{useScreenTiming(){}},
 '@/hooks/use-local-day':{useLocalDay:()=>new Date().toISOString().slice(0,10)},
 '@/hooks/use-health-steps':{useHealthSteps:()=>({steps:null}),useHealthStepsSync(){}},
 '@react-native-community/netinfo':{__esModule:true,default:{addEventListener:()=>()=>{}}},
 '@/components/pulse':{Wordmark:'Wordmark',LoadingBlock:'LoadingBlock',OfflineBanner:'OfflineBanner'},
 '@/lib/haptics':{haptic:{press(){},tap(){},success(){}}},
 '@/lib/web-preview-mode':{isWebPreviewMode:()=>false},
 '@/lib/api/ingredient':{fetchInterpretedIngredient:async()=>({})},
 '@/lib/api-client':{apiRequest:http,apiFormRequest:(url,form,options)=>{requests.push({url,form});return response?response.promise:Promise.resolve({id:'canonical-photo',eatenAt:new Date().toISOString(),calories:null,description:'Meal photo',mealType:'snack',interpretationStatus:'interpreting'})}},
 };
 const modules=new Map();function load(name,from=path.join(root,'index.ts')){if(name in shims)return shims[name];if(!name.startsWith('@/')&&!name.startsWith('.')&&!path.isAbsolute(name))return app(name);const base=name.startsWith('@/')?path.join(root,name.slice(2)):path.resolve(path.dirname(from),name);const file=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());assert.ok(file,name);if(modules.has(file))return modules.get(file).exports;const module={exports:{}};modules.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(n=>load(n,file),module,module.exports);return module.exports;}
 const actual=load('@/components/command-center/controller');shims['@/components/command-center/controller']={...actual,createCommandCenterController:(p,s)=>{const refresh=p.cache.refreshAfterSave;p.cache.refreshAfterSave=async()=>{if(refreshFails)throw Error('cache unavailable');return refresh()};ports=p;controller=actual.createCommandCenterController(p,s);return controller}};
 shims['@/components/dashboard']={MealStatusBadge:load('@/components/dashboard/MealStatusBadge').MealStatusBadge,CalorieRing:'CalorieRing',WeightSparkline:'WeightSparkline',StepsTrendIcon:'StepsTrendIcon',CoachBadge:'CoachBadge',MacroBar:'MacroBar',DayPicker:'DayPicker'};
 const provider=load('@/components/command-center/CommandCenterProvider'),Overlay=load('@/components/command-center/CommandCenterOverlay').CommandCenterOverlay,Bar=load('@/components/FloatingCommandBar').FloatingCommandBar;
 let publicApi;function Probe(){api=provider.useCommandCenterOverlay();publicApi=provider.useCommandCenter();return null}
 let r;await act(async()=>{r=create(React.createElement(provider.CommandCenterProvider,null,React.createElement(Probe),React.createElement(Overlay),React.createElement(Bar,{hint:'Log an entry',onPress(){},overTabBar:true})))});
 return {r,load,requests,events,pushes,cache,receipts,snapshot:()=>api.snapshot,controller:()=>controller,modal:()=>modal,publicApi:()=>publicApi,
 seed:async(draft)=>act(async()=>{ports.state.setReviewDraft(draft);ports.state.setCommandState(draft.kind==='meal'?'cc_review_meal':'cc_review_workout')}),
 setState:async s=>act(async()=>ports.state.setCommandState(s)),dispatch:async e=>act(async()=>api.dispatch(e)),
 start:async fn=>{let pending;await act(async()=>{pending=fn()});return {pending}},
 defer:()=>response=deferred(),release:async value=>act(async()=>response.resolve(value)),reject:async()=>act(async()=>response.reject(Error('response lost after commit'))),
 refreshFailure:v=>refreshFails=v,dismiss:async()=>act(async()=>modal.onDismiss()),
 dashboard:async data=>{dashboardData=data;cache.set(JSON.stringify(['dashboard','home',Intl.DateTimeFormat().resolvedOptions().timeZone,new Date().toISOString().slice(0,10)]),data);Dashboard??=load('@/app/(tabs)/dashboard').default;await act(async()=>r.update(React.createElement(provider.CommandCenterProvider,null,React.createElement(Probe),React.createElement(Overlay),React.createElement(Dashboard))));},queryConfig:()=>queryConfig,
 close:async()=>act(async()=>r.unmount())};
}
const byId=(r,id)=>r.root.findAll(n=>typeof n.type==='string'&&n.props.testID===id)[0];
const textOf=r=>r.root.findAll(n=>n.type==='Text').map(n=>n.children.filter(c=>typeof c==='string').join('')).join(' ');
module.exports={harness,meal,workout,deferred,React,act,byId,textOf};
