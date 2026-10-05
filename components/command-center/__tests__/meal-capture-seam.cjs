// Actual provider HTTP adapters + actual controllers; synthetic commit/response-loss.
// Native/auth/cache/HTTP are module-local boundaries, not a live server/device test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const deps = process.env.MEAL_UI_TEST_DEPS;
if (!deps) throw new Error('Set MEAL_UI_TEST_DEPS to external React renderer deps');
const req = createRequire(path.join(deps, 'package.json'));
const React = req('react');
const { create, act } = req('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '../../..');
function loader(shims) {
  const cache = new Map();
  function load(name, from = path.join(root, 'index.ts')) {
    if (name in shims) return shims[name];
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(from), name);
    const file = [base, base+'.ts', base+'.tsx'].find(f=>fs.existsSync(f));
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports:{}}; cache.set(file,module);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(n=>load(n,file),module,module.exports);
    return module.exports;
  }
  return load;
}
async function harness() {
  const originalFormData=global.FormData;
  global.FormData=class {fields=[];append(key,value){this.fields.push([key,value]);}};
  const requests=[], receipts=new Map(); let uuid=0, failures=1, refreshFails=false, controller, api;
  let clockNow="2026-10-02T12:00:00.000Z", clockZone="UTC";
  const photo={uri:'file:///original.png',fileName:'original.png',mimeType:'image/png',width:1200,height:900};
  const queryClient={getQueriesData:()=>[],setQueryData(){},invalidateQueries:async()=>{if(refreshFails)throw new Error('cache unavailable');}};
  const token=async()=> 'fixture-token'; const router={push(){}};
  const http=async(url,options,form)=>{
    const payload=form?Object.fromEntries(form.fields):JSON.parse(options.body);
    requests.push({url,payload:structuredClone(payload),form:!!form});
    const key=payload.requestId || 'missing-'+requests.length;
    if(!receipts.has(key))receipts.set(key,{id:'canonical-'+receipts.size,eatenAt:payload.eatenAt,ingredients:[],interpretationStatus:'interpreting'});
    if(failures-->0)throw new Error('response lost after synthetic commit');
    return receipts.get(key);
  };
  const shims={
    react:React,'react/jsx-runtime':req('react/jsx-runtime'),
    'react-native':{Alert:{alert(){}},Keyboard:{dismiss(){}},Linking:{openSettings:async()=>{}}},
    'expo-router':{useRouter:()=>router,useFocusEffect(){}},
    'expo-audio':{useAudioRecorder:()=>({prepareToRecordAsync:async()=>{},record(){},stop:async()=>{},uri:'file:///voice.m4a'}),RecordingPresets:{HIGH_QUALITY:{}},requestRecordingPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{}},
    'expo-image-picker':{requestMediaLibraryPermissionsAsync:async()=>({granted:true}),launchImageLibraryAsync:async()=>({canceled:false,assets:[photo]})},
    'expo-crypto':{randomUUID:()=>`00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`},
    '@clerk/clerk-expo':{useAuth:()=>({getToken:token,isSignedIn:true})},
    '@tanstack/react-query':{useQuery:()=>({data:[]}),useQueryClient:()=>queryClient},
    '@/lib/haptics':{haptic:{press(){},tap(){},success(){}}},
    '@/lib/web-preview-mode':{isWebPreviewMode:()=>false},
    '@/lib/api/ingredient':{fetchInterpretedIngredient:async()=>({})},
    '@/lib/api-client':{apiRequest:(url,options)=>http(url,options),apiFormRequest:(url,form,options)=>http(url,options,form)},
  };
  const load=loader(shims);
  const actual=load('@/components/command-center/controller');
  shims['@/components/command-center/controller']={...actual,createCommandCenterController:(ports,state)=>{ports.clock.now=()=>new Date(clockNow);ports.clock.getTimezone=()=>clockZone;controller=actual.createCommandCenterController(ports,state);return controller;}};
  const provider=load('@/components/command-center/CommandCenterProvider');
  function Probe(){api=provider.useCommandCenterOverlay();return null;}
  let r;await act(async()=>{r=create(React.createElement(provider.CommandCenterProvider,null,React.createElement(Probe)));});
  return {requests,receipts,photo,controller:()=>controller,snapshot:()=>api.snapshot,
    dispatch:async e=>{await act(async()=>api.dispatch(e));},
    invoke:async fn=>{await act(async()=>fn(controller));},
    setFailures:n=>failures=n,setRefreshFailure:v=>refreshFails=v,
    advanceClock:()=>{clockNow="2026-10-03T20:00:00.000Z";clockZone="Asia/Kolkata";},
    close:async()=>{await act(async()=>r.unmount());global.FormData=originalFormData;}};
}
test('actual typed capture HTTP retries the committed original UUID/time/text after provider recreation',async()=>{
  const h=await harness();try{
    await h.dispatch({type:'text.set',text:'I had rice for lunch'});
    const firstController=h.controller();
    await h.dispatch({type:'text.submit'});
    assert.notEqual(h.controller(),firstController);
    const first=h.requests[0].payload;
    assert.match(first.requestId,/^[0-9a-f-]{36}$/);
    assert.equal(first.eatenAt,"2026-10-02T12:00:00.000Z");assert.equal(first.timezone,"UTC");
    h.advanceClock();
    await h.dispatch({type:'error.primary'});
    assert.equal(h.requests.length,2);
    assert.deepEqual(h.requests[1].payload,first);
    assert.equal(h.receipts.size,1);
    assert.equal(h.snapshot().state,'cc_saved');
  }finally{await h.close();}
});
test('actual photo capture multipart retries original UUID/time/file/context after response loss',async()=>{
  const h=await harness();try{
    await h.invoke(c=>c.launchPhotoPicker('library'));
    await h.dispatch({type:'text.set',text:'  rice and tofu  '});
    await h.dispatch({type:'photo.submit'});
    const first=h.requests[0].payload;
    assert.match(first.requestId,/^[0-9a-f-]{36}$/);
    assert.deepEqual(first.photo,{uri:'file:///original.png',name:'original.png',type:'image/png'});
    assert.equal(first.context,'rice and tofu');assert.equal(first.transcript,'rice and tofu');
    assert.equal(first.source,'photo');assert.equal(first.eatenAt,'2026-10-02T12:00:00.000Z');assert.equal(first.timezone,'UTC');
    h.advanceClock();
    await h.dispatch({type:'error.primary'});
    assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1].payload,first);
    assert.equal(h.receipts.size,1);assert.equal(h.snapshot().state,'cc_saved');
  }finally{await h.close();}
});
test('actual voice capture retries original transcript without recording again',async()=>{
  const h=await harness();try{
    await h.invoke(c=>c.interpretVoiceTranscript('I ate chicken rice'));
    assert.equal(h.requests[0].payload.source,'voice');
    const first=h.requests[0].payload;
    await h.dispatch({type:'error.primary'});
    assert.equal(h.requests.length,2);assert.deepEqual(h.requests[1].payload,first);
    assert.equal(h.receipts.size,1);assert.equal(h.snapshot().state,'cc_saved');
  }finally{await h.close();}
});
const legacyAction=()=>({kind:'entry',source:'text',transcript:'I ate rice',interpreted:{intent:'meal',payload:{mealType:'lunch',description:'Rice',calories:120,proteinG:2,carbsG:25,fatG:1,ingredients:[{name:'Rice',grams:100,calories:120,proteinG:2,carbsG:25,fatG:1}]}}});
test('successful meal capture ignores trailing submit taps until a new draft is opened',async()=>{
  const h=await harness();try{
    h.setFailures(0);await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    await h.dispatch({type:'text.submit'});await h.dispatch({type:'photo.submit'});
    assert.equal(h.requests.length,1);
    await h.dispatch({type:'open'});await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    assert.equal(h.requests.length,2);assert.notEqual(h.requests[0].payload.requestId,h.requests[1].payload.requestId);
  }finally{await h.close();}
});
test('explicit photo picking and microphone start each begin a new logical meal after acknowledgement',async()=>{
  const h=await harness();try{
    h.setFailures(0);await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    await h.invoke(c=>c.launchPhotoPicker('library'));await h.dispatch({type:'photo.submit'});
    assert.equal(h.requests.length,2);
    await h.dispatch({type:'voice.start'});await h.invoke(c=>c.interpretVoiceTranscript('I ate tofu'));
    assert.equal(h.requests.length,3);assert.equal(h.requests[2].payload.source,'voice');
  }finally{await h.close();}
});
test('uncertain capture blocks new drafts, close, edit, secondary action and media replacement with truthful copy',async()=>{
  const h=await harness();try{
    await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    const first=h.requests[0].payload;
    for(const event of [{type:'text.set',text:'I ate paneer'},{type:'text.change',text:'changed'},{type:'voice.transcript.change',text:'changed voice'},{type:'text.edit'},{type:'photo.context.edit'},{type:'error.secondary'},{type:'close'},{type:'open'},{type:'voice.start'},{type:'text.submit'}])await h.dispatch(event);
    await h.invoke(c=>c.launchPhotoPicker('library'));
    assert.equal(h.snapshot().input.text,'I ate rice');assert.equal(h.snapshot().input.selectedMealPhoto,null);
    assert.equal(h.snapshot().state,'cc_error');assert.equal(h.requests.length,1);
    assert.equal(h.snapshot().error.copy.primary,'Retry original');assert.equal(h.snapshot().error.copy.secondary,null);
    assert.match(h.snapshot().error.copy.body,/memory|closing the app/i);
    await h.dispatch({type:'error.primary'});assert.deepEqual(h.requests[1].payload,first);
  }finally{await h.close();}
});
test('acknowledged capture stays saved when cache refresh fails and primary action cannot create again',async()=>{
  const h=await harness();try{
    h.setFailures(0);h.setRefreshFailure(true);
    await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    assert.equal(h.snapshot().state,'cc_saved');await h.dispatch({type:'error.primary'});
    assert.equal(h.requests.length,1);
  }finally{await h.close();}
});
test('uncertain capture also blocks a direct late workout interpretation from replacing the meal draft',async()=>{
  const h=await harness();try{
    await h.dispatch({type:'text.set',text:'I ate rice'});await h.dispatch({type:'text.submit'});
    const interpreted={intent:'workout_set',payload:{exerciseName:'Bench Press',exerciseType:'resistance',reps:8,weightKg:80,durationMinutes:null,notes:null,confidence:1,assumptions:[]}};
    await h.invoke(c=>c.routeInterpretedEntry(interpreted,'bench 80kg 8 reps','text'));
    assert.equal(h.snapshot().review,null);assert.equal(h.snapshot().state,'cc_error');assert.equal(h.requests.length,1);
  }finally{await h.close();}
});
