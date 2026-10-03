// Web Finish choice handlers with real React rendering.
// Native views, auth and API/cache boundaries are local shims, not device/API evidence.
// WORKOUT_UI_TEST_DEPS=/external/renderer/deps node --test components/workout/__tests__/workout-finish-ui-seam.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const deps = process.env.WORKOUT_UI_TEST_DEPS;
if (!deps) throw new Error('Set WORKOUT_UI_TEST_DEPS to external react@19.1.0/react-test-renderer@19.1.0 dependencies');
const testRequire = createRequire(path.join(deps, 'package.json'));
const React = testRequire('react');
const { create, act } = testRequire('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '../../..');
function loader(extra) {
  const cache = new Map();
  const shims = { react: React, 'react/jsx-runtime': testRequire('react/jsx-runtime'), ...extra };
  function load(name, from = path.join(root, 'index.ts')) {
    if (name in shims) return shims[name];
    if (!name.startsWith('@/') && !name.startsWith('.') && !name.startsWith('/')) return require(name);
    const base = name.startsWith('@/') ? path.join(root, name.slice(2)) : path.resolve(path.dirname(from), name);
    const file = [base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile());
    if (!file) throw new Error('Cannot resolve '+name);
    if (cache.has(file)) return cache.get(file).exports;
    const module = {exports:{}}; cache.set(file,module);
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    new Function('require','module','exports',code)(n=>load(n,file),module,module.exports);
    return module.exports;
  }
  return load;
}
const makeSet = (id, patch={}) => ({id,sessionId:'test-session',exerciseName:'Bench Press',exerciseType:'resistance',reps:8,weightKg:80,durationMinutes:null,notes:null,transcriptRaw:null,performedAt:'2026-10-02T20:00:00Z',createdAt:'2026-10-02T20:00:00Z',updatedAt:'2026-10-02T20:00:00Z',...patch});
async function screen(sets = [makeSet('one'), makeSet('two')], platform = 'web') {
  let routeId='test-session';
  let data={id:'test-session',title:'Synthetic workout',startedAt:'2026-10-02T20:00:00Z',endedAt:null,sets};
  const listeners=new Set(), requests=[], alerts=[];
  let response = async (url, body) => url.startsWith('/api/workout-sets/') ? {...data.sets.find(s=>s.id===url.split('/').pop()),...body} : {...data,...body};
  const notify=()=>listeners.forEach(f=>f());
  const queryClient={cancelQueries:async()=>{},invalidateQueries:async()=>{},getQueryData:()=>data,setQueryData:(_key,value)=>{data=typeof value==='function'?value(data):value;notify();}};
  const useQuery=()=>{const [,tick]=React.useState(0);React.useEffect(()=>{const f=()=>tick(v=>v+1);listeners.add(f);return()=>listeners.delete(f);},[]);return {data,isLoading:false,isError:false};};
  const useMutation=options=>{
    const [isPending,setPending]=React.useState(false);
    const mutateAsync=async vars=>{setPending(true);let context,result,failure;try{context=await options.onMutate?.(vars);result=await options.mutationFn(vars);await options.onSuccess?.(result,vars,context);return result;}catch(error){failure=error;await options.onError?.(error,vars,context);throw error;}finally{try{await options.onSettled?.(result,failure,vars,context);}finally{setPending(false);}}};
    return {isPending,mutateAsync,mutate:vars=>{void mutateAsync(vars).catch(()=>{});}};
  };
  const native={Platform:{OS:platform},StyleSheet:{create:x=>x,absoluteFill:{}},Keyboard:{dismiss(){}},Alert:{alert:(...args)=>alerts.push(args)}};
  for(const name of ['View','Text','Pressable','TextInput','ActivityIndicator','Modal','ScrollView'])native[name]=name;
  const load=loader({
    'expo-crypto':{randomUUID:require('node:crypto').randomUUID},'react-native':native,'react-native-keyboard-controller':{KeyboardAvoidingView:'View',KeyboardAwareScrollView:'ScrollView'},
    'expo-router':{Redirect:'Redirect',Stack:{Screen:'Screen'},useLocalSearchParams:()=>({id:routeId}),useRouter:()=>({setParams(){},push(){},back(){}})},
    '@clerk/clerk-expo':{useAuth:()=>({getToken:async()=> 'synthetic-token',isLoaded:true,isSignedIn:true})},
    '@tanstack/react-query':{useQuery,useMutation,useQueryClient:()=>queryClient},
    'react-native-svg':{default:'Svg',Path:'Path'},
    '@/components/FloatingCommandBar':{FloatingCommandBar:'CommandBar'},'@/components/Icon':{Icon:'Icon'},
    '@/components/pulse':{UndoToast:'UndoToast'},'@/components/command-center':{useCommandCenter:()=>({launcherProps:{}})},
    '@/components/workout':{SessionStatsStrip:'Stats',WorkoutExerciseCard:'ExerciseCard'},
    '@/hooks/use-screen-timing':{useScreenTiming(){}},'@/lib/web-preview-mode':{isWebPreviewMode:()=>false},
    '@/lib/haptics':{haptic:{success(){},warning(){}}},
    '@/lib/api-client':{apiRequest:async(url,options)=>{const body=JSON.parse(options.body);requests.push({url,body});return response(url,body);}},
  });
  const Component=load('@/app/workout-session/[id]').default;
  let r;await act(async()=>{r=create(React.createElement(Component));});
  const card=()=>r.root.findByType('ExerciseCard');
  const finish=()=>r.root.findByType('Screen').props.options.headerRight().props.children.find(e=>e?.props.accessibilityLabel==='Finish workout').props.onPress();
  return {r,requests,alerts,prompt:()=>require('./workout-prompt-fixture.cjs').prompt(r),card,data:()=>data,response:fn=>response=fn,
    switchRoute:async id=>act(async()=>{routeId=id;notify();}),
    button:text=>r.root.findAllByType('Pressable').find(b=>b.props.accessibilityLabel===text),
    modal:()=>r.root.findAllByType('Modal').find(m=>m.props.accessibilityLabel==='Unsaved set changes'),
    edit:async(id,patch)=>act(async()=>card().props.onChangeDraft(id,patch)),
    finish:async()=>act(async()=>{finish();}),
    choose:async text=>{const button=r.root.findAllByType('Pressable').find(b=>b.props.accessibilityLabel===text);assert.ok(button,`missing ${text}`);await act(async()=>{await button.props.onPress();});},
    close:async()=>act(async()=>r.unmount())};
}
test('iOS and Android branded prompt preserves original text, destructive styling and choice ordering',async()=>{
  for(const platform of ['ios','android']){
    const s=await screen(undefined,platform);try{
      await s.edit('one',{weightKg:'85'});await s.finish();
      assert.ok(s.modal());
      assert.equal(s.alerts.length,0);
      assert.equal(s.prompt()[0],'Unsaved set changes');
      assert.equal(s.prompt()[1],'Save your typed changes before finishing, or explicitly discard them. Cancel keeps this workout open.');
      assert.deepEqual(s.prompt()[2].map(({text,style})=>({text,style})),[
        {text:'Cancel',style:'cancel'},
        {text:'Discard & Finish',style:'destructive'},
        {text:'Save & Finish',style:undefined},
      ]);
      assert.equal(s.requests.length,0);
      assert.equal(s.card().props.drafts.one.weightKg,'85');
    }finally{await s.close();}
  }
});
test('web dirty Finish displays an accessible explicit choice; Cancel does not write or lose input',async()=>{
  const s=await screen();try{
    await s.edit('one',{weightKg:'85'});await s.finish();
    assert.ok(s.modal(),'web must render a real modal, not native Alert');
    assert.equal(s.modal().props.transparent,true);
    assert.equal(s.alerts.length,0);
    for(const label of ['Cancel','Discard & Finish','Save & Finish']) assert.ok(s.button(label));
    assert.equal(s.requests.length,0,'opening choice must not execute a callback');
    await s.choose('Cancel');
    assert.equal(Boolean(s.modal()),false);
    assert.equal(s.requests.length,0);
    assert.equal(s.card().props.drafts.one.weightKg,'85');
  }finally{await s.close();}
});

test('web request-close and backdrop dismiss preserve input and invalidate saved callbacks',async()=>{
  const s=await screen();try{
    await s.edit('one',{weightKg:'85'});await s.finish();
    const stale=s.button('Save & Finish').props.onPress;
    await act(async()=>s.modal().props.onRequestClose());
    assert.equal(Boolean(s.modal()),false);
    await s.finish();
    await act(async()=>stale());
    assert.ok(s.modal(),'stale callback must not consume a later prompt');
    assert.equal(s.requests.length,0);
    await s.choose('Dismiss dialog');
    await act(async()=>stale());
    assert.equal(s.requests.length,0);
    assert.equal(s.card().props.drafts.one.weightKg,'85');
  }finally{await s.close();}
});
test('web callbacks cannot write after a route switch or unmount',async()=>{
  for(const unmount of [false,true]){
    const s=await screen();let closed=false;try{
      await s.edit('one',{weightKg:'85'});await s.finish();
      const stale=s.button('Save & Finish').props.onPress;
      if(unmount){await s.close();closed=true;} else await s.switchRoute('different-session');
      await act(async()=>stale());
      assert.equal(s.requests.length,0);
    }finally{if(!closed)await s.close();}
  }
});
test('web consumes one choice once, saves latest drafts before completion, and blocks edits while pending',async()=>{
  const s=await screen();let release;try{
    await s.edit('one',{weightKg:'85'});await s.finish();
    await s.edit('one',{weightKg:'87.5'});
    s.response(async(url,body)=>{
      if(url.endsWith('/one')) await new Promise(resolve=>release=resolve);
      return url.startsWith('/api/workout-sets/') ? {...s.data().sets.find(set=>set.id===url.split('/').pop()),...body} : {...s.data(),...body};
    });
    const save=s.button('Save & Finish').props.onPress;
    const discard=s.button('Discard & Finish').props.onPress;
    let pending;
    await act(async()=>{pending=save();save();discard();});
    assert.equal(s.requests.length,1);
    assert.equal(s.requests[0].body.weightKg,87.5);
    assert.equal(s.data().endedAt,null);
    assert.equal(s.card().props.saving,true);
    await s.edit('one',{weightKg:'90'});assert.equal(s.card().props.drafts.one.weightKg,'87.5');
    await s.finish();assert.equal(s.requests.length,1);
    await act(async()=>{release();await pending;});
    assert.deepEqual(s.requests.map(r=>r.url),['/api/workout-sets/one','/api/workout-sessions/test-session']);
    assert.ok(s.data().endedAt);
    await act(async()=>save());assert.equal(s.requests.length,2);
  }finally{release?.();await s.close();}
});
test('web late choice retains the existing pending-row-mutation guard',async()=>{
  const s=await screen();let release;try{
    await s.edit('one',{weightKg:'85'});await s.finish();
    s.response(async(url,body)=>{
      if(url.endsWith('/one')) await new Promise(resolve=>release=resolve);
      return url.startsWith('/api/workout-sets/') ? {...s.data().sets.find(set=>set.id===url.split('/').pop()),...body} : {...s.data(),...body};
    });
    await act(async()=>s.card().props.onToggleComplete({live:s.data().sets[0]}));
    await s.choose('Discard & Finish');
    assert.equal(s.requests.length,1);assert.equal(s.data().endedAt,null);
    await act(async()=>release());
  }finally{release?.();await s.close();}
});
test('an unconfirmed Finish response cannot discard drafts or report completion',async()=>{
  const s=await screen();try{
    await s.edit('one',{weightKg:'85'});
    s.response(async()=>({...s.data(),endedAt:null}));
    await s.finish();await s.choose('Discard & Finish');
    assert.equal(s.data().endedAt,null);
    assert.equal(s.card().props.drafts.one.weightKg,'85');
    assert.match(s.r.root.findAllByType('Text').map(node=>node.props.children).join(' '),/not confirmed/i);
  }finally{await s.close();}
});
for (const failedStage of ['first-row','second-row','finish']) {
  test(`network failure at ${failedStage} keeps workout open and typed drafts intact`,async()=>{
    const s=await screen();try{
      await s.edit('one',{weightKg:'85'});await s.edit('two',{reps:'9'});
      s.response(async(url,body)=>{
        if ((failedStage==='first-row'&&url.endsWith('/one')) || (failedStage==='second-row'&&url.endsWith('/two')) || (failedStage==='finish'&&url.includes('/workout-sessions/'))) throw new Error('Synthetic network failure');
        return url.startsWith('/api/workout-sets/') ? {...s.data().sets.find(set=>set.id===url.split('/').pop()),...body} : {...s.data(),...body};
      });
      await s.finish();await s.choose('Save & Finish');
      assert.equal(s.data().endedAt,null);
      assert.equal(s.card().props.drafts.one.weightKg,'85');assert.equal(s.card().props.drafts.two.reps,'9');
      assert.match(s.r.root.findAllByType('Text').map(node=>node.props.children).join(' '),/Synthetic network failure/);
      if(failedStage!=='finish') assert.ok(s.requests.every(request=>!request.url.includes('/workout-sessions/')));
    }finally{await s.close();}
  });
}
for (const failFinish of [false,true]) {
  test(`explicit Discard & Finish ${failFinish?'failure retains':'success restores'} drafts without updating rows`,async()=>{
    const s=await screen();try{
      await s.edit('one',{weightKg:'85'});
      s.response(async(_url,body)=>{if(failFinish)throw new Error('Synthetic finish failure');return {...s.data(),...body};});
      await s.finish();await s.choose('Discard & Finish');
      assert.equal(s.requests.length,1);assert.match(s.requests[0].url,/workout-sessions/);
      assert.equal(s.card().props.drafts.one.weightKg,failFinish?'85':'80');
      assert.equal(Boolean(s.data().endedAt),!failFinish);
    }finally{await s.close();}
  });
}
test('clearing a saved value and changing cardio duration both prompt and save explicitly',async()=>{
  for(const [set,patch,field,value] of [[makeSet('one'),{weightKg:''},'weightKg',null],[makeSet('one',{exerciseType:'cardio',durationMinutes:10}),{durationMinutes:'12'},'durationMinutes',12]]){
    const s=await screen([set]);try{
      await s.edit('one',patch);await s.finish();await s.choose('Save & Finish');
      assert.equal(s.requests[0].body[field],value);assert.ok(s.data().endedAt);
    }finally{await s.close();}
  }
});
test('no-op numeric formatting does not prompt or overwrite saved sets',async()=>{
  const s=await screen();try{
    await s.edit('one',{weightKg:'80.00'});await s.finish();
    assert.equal(s.alerts.length,0);assert.equal(s.requests.length,1);assert.ok(s.data().endedAt);
  }finally{await s.close();}
});
test('completed workout correction saves through actual screen without reopening or changing its end time',async()=>{
  const s=await screen();try{
    await s.finish();const ended=s.data().endedAt;assert.ok(ended);
    await s.edit('one',{weightKg:'82.5'});
    await act(async()=>s.card().props.onToggleComplete({live:s.data().sets[0]}));
    assert.equal(s.data().sets[0].weightKg,82.5);assert.equal(s.data().endedAt,ended);
  }finally{await s.close();}
});
