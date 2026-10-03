// Web Finish choice handlers with real React rendering.
// Native views, auth and API/cache boundaries are local shims, not device/API evidence.
// WORKOUT_UI_TEST_DEPS=/external/renderer/deps node --test components/workout/__tests__/workout-finish-ui-seam.cjs

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
async function screen(sets = [makeSet('one'), makeSet('two')], platform = 'web', options = {}) {
  let routeId=options.sessionId??'test-session';
  let data={id:routeId,title:'Synthetic workout',startedAt:'2026-10-02T20:00:00Z',endedAt:null,sets};
  const listeners=new Set(), requests=[], alerts=[];
  let response = async (url, body) => url.startsWith('/api/workout-sets/') ? {...data.sets.find(s=>s.id===url.split('/').pop()),...body} : {...data,...body};
  const notify=()=>listeners.forEach(f=>f());
  const queryClient={cancelQueries:async()=>{},invalidateQueries:async()=>{await options.invalidate?.();},getQueryData:()=>data,setQueryData:(_key,value)=>{data=typeof value==='function'?value(data):value;notify();}};
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
    '@clerk/clerk-expo':{useAuth:()=>({getToken:async()=>options.getToken?options.getToken():'synthetic-token',isLoaded:true,isSignedIn:true})},
    '@tanstack/react-query':{useQuery,useMutation,useQueryClient:()=>queryClient},
    'react-native-svg':{default:'Svg',Path:'Path'},
    '@/components/FloatingCommandBar':{FloatingCommandBar:'CommandBar'},'@/components/Icon':{Icon:'Icon'},
    '@/components/pulse':{UndoToast:'UndoToast'},'@/components/command-center':{useCommandCenter:()=>({launcherProps:{}})},
    '@/components/workout':{SessionStatsStrip:'Stats',WorkoutExerciseCard:'ExerciseCard'},
    '@/hooks/use-screen-timing':{useScreenTiming(){}},'@/lib/web-preview-mode':{isWebPreviewMode:()=>false},
    '@/lib/haptics':{haptic:{success(){},warning(){}}},
    '@/lib/api-client':{apiRequest:async(url,options)=>{const body=options.body?JSON.parse(options.body):null;requests.push({url,body,method:options.method});return options.method==='DELETE'?{deleted:true}:response(url,body);}},
  });
  const Component=load('@/app/workout-session/[id]').default;
  let r;await act(async()=>{r=create(React.createElement(Component));});
  const card=()=>r.root.findByType('ExerciseCard');
  const finish=()=>r.root.findByType('Screen').props.options.headerRight().props.children.find(e=>e?.props.accessibilityLabel==='Finish workout').props.onPress();
  return {r,requests,alerts,prompt:()=>require('./workout-prompt-fixture.cjs').prompt(r),card,data:()=>data,response:fn=>response=fn,
    switchRoute:async id=>act(async()=>{routeId=id;data={...data,id,sets:data.sets.map(s=>({...s,sessionId:id}))};notify();}),
    add:async()=>act(async()=>{await card().props.onAddSet(card().props.card);}),
    text:()=>r.root.findAllByType('Text').map(n=>n.props.children).join(' '),
    button:text=>r.root.findAllByType('Pressable').find(b=>b.props.accessibilityLabel===text),
    modal:()=>r.root.findAllByType('Modal').find(m=>m.props.accessibilityLabel==='Unsaved set changes'),
    edit:async(id,patch)=>act(async()=>card().props.onChangeDraft(id,patch)),
    finish:async()=>act(async()=>{finish();}),
    choose:async text=>{const button=r.root.findAllByType('Pressable').find(b=>b.props.accessibilityLabel===text);assert.ok(button,`missing ${text}`);await act(async()=>{await button.props.onPress();});},
    close:async()=>act(async()=>r.unmount())};
}

module.exports={screen,makeSet,act};
