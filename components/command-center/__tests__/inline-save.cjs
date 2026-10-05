const {test}=require('node:test');
const assert=require('node:assert/strict');
const {harness,workout,act,byId,textOf}=require('./inline-save-harness.cjs');
test('real workout caller retains sets and blocks stale edit/close/save callbacks during the deferred write',async()=>{
 const h=await harness();try{
 await h.seed(workout());const save=byId(h.r,'cc-review-save').props.onPress,edit=byId(h.r,'cc-review-workout-kg-0').props.onChangeText,close=byId(h.r,'cc-review-discard').props.onPress;
 h.defer();await h.start(save);assert.match(textOf(h.r),/Bench Press/);assert.match(textOf(h.r),/Saving…/);
 assert.equal(byId(h.r,'cc-review-workout-kg-0').props.editable,false);assert.equal(byId(h.r,'cc-review-add-set').props.disabled,true);
 await act(async()=>{save();edit('150');close()});assert.equal(h.requests.length,2,'session lookup then batch, no duplicate');assert.equal(h.snapshot().review.sets[0].weightKg,'80');
 await h.release({id:'canonical-workout'});assert.equal(h.snapshot().state,'cc_saved');await h.dismiss();assert.match(textOf(h.r),/Sets added/);
 }finally{await h.close()}
});

test('actual photo submit stays on the photo action until upload ACK and failure retries that action',async()=>{
 const h=await harness();try{
 await act(async()=>h.controller().launchPhotoPicker('library'));h.defer();const submit=byId(h.r,'cc-photo-submit').props.onPress;
 await h.start(submit);assert.ok(byId(h.r,'cc-photo-preview'));assert.match(textOf(h.r),/Uploading…/);
 assert.equal(byId(h.r,'cc-photo-submit').props.disabled,true);assert.equal(byId(h.r,'cc-photo-replace').props.disabled,true);assert.equal(byId(h.r,'cc-photo-context').props.editable,false);
 await act(async()=>submit());assert.equal(h.requests.length,1);await h.reject();
 assert.ok(byId(h.r,'cc-photo-preview'));assert.match(textOf(h.r),/Retry original/);
 h.defer();await h.start(byId(h.r,'cc-photo-submit').props.onPress);await h.release({id:'canonical-photo',eatenAt:new Date().toISOString(),calories:null,interpretationStatus:'interpreting'});await h.dismiss();
 const toast=byId(h.r,'cc-saved-toast');assert.ok(toast);assert.equal(toast.findByType('Icon').props.name,'sparkle');assert.match(textOf(h.r),/Photo logged — estimating calories/);assert.doesNotMatch(textOf(h.r),/LOGGED|ENTRY SAVED|KCAL LEFT/);
 }finally{await h.close()}
});
test('all no-review saving command states keep a disabled input/action surface, never blank or a saving sheet',async()=>{
 const h=await harness();try{
 await h.dispatch({type:'open'});await h.dispatch({type:'text.set',text:'I ate rice'});
 for(const state of ['cc_saving','cc_auto_saving','cc_quick_add_saving']){
 await h.setState(state);assert.ok(byId(h.r,'cc-input-text'));assert.equal(byId(h.r,'cc-input-text').props.editable,false);assert.equal(byId(h.r,'cc-send').props.disabled,true);assert.match(textOf(h.r),/Saving…/);assert.deepEqual(h.modal().snapPoints,['92%']);
 }
 }finally{await h.close()}
});

test('actual dashboard canonical pending row persists after feedback expiry and becomes ready/failed without zero nutrition',async()=>{
 const h=await harness();try{
 const day=new Date().toISOString().slice(0,10),eatenAt=day+'T12:00:00.000Z';
 const base={today:{calories:{consumed:0,goal:2000},macros:{protein:null,carbs:null,fat:null},steps:{count:0,goal:10000},weight:null},weeklyTrends:[],recentMeals:[]};
 await h.dashboard(base);assert.equal(byId(h.r,'home-meal-row-canonical-photo'),undefined);
 const pending={id:'canonical-photo',description:'Meal photo',calories:null,mealType:'snack',eatenAt,interpretationStatus:'interpreting'};
 await h.dashboard({...base,recentMeals:[pending]});
 const row=byId(h.r,'home-meal-row-canonical-photo');assert.ok(row);assert.match(row.findAllByType('Text').map(n=>n.props.children).join(' '),/Estimating…/);
 assert.equal(h.queryConfig().refetchInterval({state:{data:{recentMeals:[pending]}}}),2000);
 await act(async()=>row.props.onPress());assert.deepEqual(h.pushes.at(-1),{pathname:'/meal-edit/[id]',params:{id:'canonical-photo'}});
 await h.dispatch({type:'close'});assert.ok(byId(h.r,'home-meal-row-canonical-photo'));
 await h.dashboard({...base,recentMeals:[{...pending,description:'Rice and tofu',calories:450,interpretationStatus:'needs_review'}]});
 assert.match(textOf(h.r),/Rice and tofu/);assert.doesNotMatch(textOf(h.r),/Analyzing/);assert.match(textOf(h.r),/450/);
 await h.dashboard({...base,recentMeals:[{...pending,interpretationStatus:'failed'}]});assert.match(textOf(h.r),/Couldn't estimate/);assert.doesNotMatch(textOf(h.r),/450/);
 await act(async()=>byId(h.r,'home-meal-row-canonical-photo').props.onPress());assert.equal(h.pushes.at(-1).params.id,'canonical-photo');
 }finally{await h.close()}
});

test('actual controller rejects stale mutable dispatches during a workout write',async()=>{
 const h=await harness();try{
 await h.seed(workout());h.defer();await h.start(byId(h.r,'cc-review-save').props.onPress);
 const before=structuredClone(h.snapshot().input);
 await h.dispatch({type:'text.set',text:'different entry'});await h.dispatch({type:'voice.transcript.change',text:'different voice'});
 assert.deepEqual(h.snapshot().input,before);await h.release({id:'workout-ack'});
 }finally{await h.close()}
});
test('workout ACK survives a cache invalidation rejection and never duplicates a trailing save',async()=>{
 const h=await harness();try{
 await h.seed(workout());h.refreshFailure(true);const save=byId(h.r,'cc-review-save').props.onPress;
 await act(async()=>save());assert.equal(h.snapshot().state,'cc_saved');await act(async()=>save());assert.equal(h.requests.filter(r=>r.url==='/api/workout-sets/batch').length,1);
 }finally{await h.close()}
});

for(const capture of ['photo','text','voice'])test(`actual ${capture} capture ACK inserts a canonical pending dashboard row, expires feedback only, then refetch replaces it`,async()=>{
 const h=await harness();try{
 const day=new Date().toISOString().slice(0,10),base={today:{calories:{consumed:0,goal:2000},macros:{protein:null,carbs:null,fat:null},steps:{count:0,goal:10000},weight:null},weeklyTrends:[],recentMeals:[]};
 await h.dashboard(base);await h.dispatch({type:'open'});
 if(capture==='photo')await act(async()=>h.controller().launchPhotoPicker('library'));else await h.dispatch({type:'text.set',text:'I ate rice'});
 h.defer();await h.start(()=>capture==='photo'?byId(h.r,'cc-photo-submit').props.onPress():capture==='voice'?h.controller().interpretVoiceTranscript('I ate rice'):byId(h.r,'cc-send').props.onPress());
 assert.equal(byId(h.r,'home-meal-row-canonical-ack'),undefined,'No invented optimistic record before ACK');
 const row={id:'canonical-ack',description:capture==='photo'?'Meal photo':'I ate rice',calories:null,mealType:'snack',eatenAt:day+'T12:00:00.000Z',interpretationStatus:'interpreting'};
 await h.release(row);await h.dismiss();assert.ok(byId(h.r,'home-meal-row-canonical-ack'));assert.match(textOf(h.r),/Estimating…/);
 assert.equal(byId(h.r,'cc-saved-toast').findByType('Icon').props.name,'sparkle');
 await act(async()=>new Promise(resolve=>setTimeout(resolve,2300)));assert.equal(byId(h.r,'cc-saved-toast'),undefined);assert.ok(byId(h.r,'home-meal-row-canonical-ack'));
 await h.dashboard({...base,recentMeals:[{...row,description:'Rice and tofu',calories:450,interpretationStatus:'needs_review'}]});assert.equal(h.r.root.findAll(n=>n.type==='Pressable'&&n.props.testID==='home-meal-row-canonical-ack').length,1);assert.match(textOf(h.r),/450/);assert.doesNotMatch(textOf(h.r),/Analyzing/);
 }finally{await h.close()}
});
test('quick-add actual caller routes to full-source repeat selection, never writes a summary as a meal',async()=>{
 const h=await harness();try{await h.dispatch({type:'open'});await h.dispatch({type:'quick-add.save',item:{id:'source-meal',description:'Rice',calories:120,mealType:'lunch'}});assert.equal(h.snapshot().state,'cc_collapsed');assert.deepEqual(h.pushes,[{pathname:'/meal-repeat',params:{id:'source-meal'}}]);assert.equal(h.requests.length,0);}finally{await h.close()}
});

test('capture upload action stays busy and immutable throughout ACK dismissal',async()=>{
 for(const capture of ['photo','text']){const h=await harness();try{
 await h.dispatch({type:'open'});if(capture==='photo')await act(async()=>h.controller().launchPhotoPicker('library'));else await h.dispatch({type:'text.set',text:'I ate rice'});
 h.defer();const id=capture==='photo'?'cc-photo-submit':'cc-send';await h.start(byId(h.r,id).props.onPress);await h.release({id:'capture-ack',interpretationStatus:'interpreting',calories:null,eatenAt:new Date().toISOString()});
 assert.equal(h.snapshot().state,'cc_saved');assert.equal(byId(h.r,id).props.disabled,true,'Retained action must not flicker enabled during dismissal');assert.equal(byId(h.r,id).props.accessibilityState.busy,true);await h.dismiss();
 }finally{await h.close()}}
});
test('a new workout opened after acknowledged dismissal can save normally',async()=>{
 const h=await harness();try{
 await h.seed(workout());await act(async()=>byId(h.r,'cc-review-save').props.onPress());await h.dismiss();await h.dispatch({type:'open'});await h.seed(workout());await act(async()=>byId(h.r,'cc-review-save').props.onPress());assert.equal(h.requests.filter(r=>r.url==='/api/workout-sets/batch').length,2);
 }finally{await h.close()}
});

test('voice meal capture hands off on the progress view, never the editor, and keeps its transcript if the save fails',async()=>{
 const h=await harness();try{
 await h.dispatch({type:'open'});await h.dispatch({type:'voice.transcript.change',text:'I ate rice'});h.defer();await h.start(()=>h.controller().interpretVoiceTranscript('I ate rice'));
 assert.ok(byId(h.r,'cc-voice-progress'));assert.equal(byId(h.r,'cc-input-text'),undefined);assert.equal(h.modal().enableDynamicSizing,true);
 await h.reject();assert.equal(byId(h.r,'cc-input-text').props.value,'I ate rice');assert.equal(byId(h.r,'cc-input-text').props.editable,false);
 }finally{await h.close()}
});

test('busy text/voice submit has a visible accent surface, not white busy copy on a disabled white button',async()=>{
 const h=await harness();try{
 await h.dispatch({type:'open'});await h.setState('cc_auto_saving');const action=byId(h.r,'cc-send');const style=Object.assign({},...action.props.style({pressed:false}).filter(Boolean));assert.equal(style.backgroundColor,h.load('@/lib/tokens').color.accent);assert.equal(style.opacity??1,1);
 }finally{await h.close()}
});

test('starting a fresh microphone capture after a workout ACK does not suppress its next reviewed save',async()=>{
 const h=await harness();try{
 await h.seed(workout());await act(async()=>byId(h.r,'cc-review-save').props.onPress());await h.dismiss();await act(async()=>h.controller().startRecording());assert.equal(h.snapshot().state,'cc_recording');await h.seed(workout());await act(async()=>byId(h.r,'cc-review-save').props.onPress());assert.equal(h.requests.filter(r=>r.url==='/api/workout-sets/batch').length,2);
 }finally{await h.close()}
});
