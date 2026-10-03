// Application callback matrix, no native gesture or IME measurements implied.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,act,ingredient}=require('./ingredient-modal-harness.cjs');
const input='cc-ingredient-editor-',exits=['cancel','header','requestClose','grams','rename','add'];
for(const caller of ['overlay','saved'])for(const exit of exits)for(const next of ['a','b','add'])test(`${caller}: ${exit} -> immediate ${next}, no layout/dismiss callback`,async()=>{
 const h=await harness({caller});try{
  await h.open(exit==='add'?'add':'a');const modal=h.modal(),oldClose=modal.props.onRequestClose,oldNativeDismiss=modal.props.onDismiss;
  const oldIdentifier=modal.props.identifier;
  const oldCancel=h.byId(input+'cancel').props.onPress,oldHeader=h.byId(input+'close').props.onPress;
  const before=h.draft();
  if(exit==='grams')await h.type(input+'grams','50.125');
  if(exit==='rename'||exit==='add')await h.type(input+'name','Paneer');
  const oldSave=h.byId(input+'submit').props.onPress;
  if(['grams','rename','add'].includes(exit))await h.press(input+'submit');
  else if(exit==='requestClose')await h.requestClose();
  else await h.press(input+(exit==='header'?'close':'cancel'));
  assert.equal(h.mode(),null);const expected=h.draft();
  if(exit==='grams')assert.deepEqual(expected[0],{...before[0],grams:50.125,calories:60.25,proteinG:1.25,carbsG:12.75,fatG:0.25});
  else if(exit==='rename')assert.equal(expected[0].name,'Paneer');
  else if(exit==='add')assert.equal(expected.length,3);
  else assert.deepEqual(expected,before);
  await h.open(next);assert.notEqual(h.modal().props.identifier,oldIdentifier);
  // FIFO delivery after the replacement has mounted. Old callbacks are inert.
  await act(async()=>{oldClose();oldCancel();oldHeader();oldSave();oldNativeDismiss()});
  assert.deepEqual(h.draft(),expected);assert.ok(h.mode());
  const row=next==='add'?null:expected.find(x=>x.id===next);
  assert.equal(h.byId(input+'name').props.value,row?.name??'');
  assert.equal(h.byId(input+'grams').props.value,row?String(row.grams):'');
  assert.equal(h.log.filter(x=>x.event==='navigationBack').length,0);
  if(caller==='overlay')assert.equal(h.log.filter(x=>x.event==='sheetDismiss').length,0);
 }finally{await h.close()}
});
for(const caller of ['overlay','saved'])test(`${caller}: IME-only native Back retains dirty fields until a later Back while hidden`,async()=>{
 const h=await harness({caller});try{
  await h.open('a');await h.type(input+'name','Dirty name');await h.type(input+'grams','50.25');const before=h.draft();
  h.setKeyboardVisible(true);await h.requestClose();await h.requestClose();
  assert.ok(h.mode());assert.equal(h.byId(input+'name').props.value,'Dirty name');assert.equal(h.byId(input+'grams').props.value,'50.25');assert.deepEqual(h.draft(),before);
  // Only visibility changes; no hide-completion callback may close the editor.
  h.setKeyboardVisible(false);await act(async()=>{});assert.ok(h.mode());
  await h.requestClose();assert.equal(h.mode(),null);assert.deepEqual(h.draft(),before);
  assert.equal(h.backListeners.size,0,'Modal must not rely on scoped BackHandler');
 }finally{await h.close()}
});
for(const caller of ['overlay','saved'])for(const exit of ['cancel','header','requestClose','same','different','add','callerExit'])for(const outcome of ['resolve','reject'])test(`${caller}: lookup ${outcome} after ${exit} cannot write or revive`,async()=>{
 let resolve,reject;const h=await harness({caller,lookup:()=>new Promise((r,j)=>{resolve=r;reject=j})});try{
  await h.open('a');await h.type(input+'name','Late name');await h.press(input+'submit');
  const oldClose=h.modal().props.onRequestClose;
  if(exit==='callerExit')await(caller==='saved'?h.switchRoute():h.leaveReview());
  else if(exit==='requestClose')await h.requestClose();
  else if(['same','different','add'].includes(exit))await h.open(exit==='same'?'a':exit==='different'?'b':'add');
  else await h.press(input+(exit==='header'?'close':'cancel'));
  const expected=h.draft(),newMode=h.mode();
  await act(async()=>{oldClose();outcome==='resolve'?resolve({...ingredient(),name:'Late name',calories:999}):reject(Error('Old failure'))});
  assert.deepEqual(h.draft(),expected);assert.equal(h.mode(),newMode);
  if(['same','different','add'].includes(exit)){
   assert.ok(h.modal());assert.equal(h.byId(input+'name').props.value,exit==='add'?'':'Rice '+(exit==='same'?'a':'b'));
   assert.equal(h.byId(input+'submit').props.disabled,true);
   assert.equal(h.byId(input+'error'),undefined);
  }else assert.equal(h.modal(),undefined);
  assert.equal(h.log.filter(x=>x.event==='navigationBack').length,0);
 }finally{await h.close()}
});
for(const caller of ['overlay','saved'])test(`${caller}: failed lookup retains fields, allows correction and one successful retry`,async()=>{
 let attempts=0;const h=await harness({caller,lookup:async(name,grams)=>{if(++attempts===1)throw Error('Offline');return {...ingredient(),name,grams}}});try{
  await h.open('a');await h.type(input+'name','Paneer');await h.type(input+'grams','75.25');const before=h.draft();
  await h.press(input+'submit');assert.ok(h.modal());assert.equal(h.byId(input+'name').props.value,'Paneer');assert.equal(h.byId(input+'grams').props.value,'75.25');assert.ok(h.byId(input+'error'));assert.deepEqual(h.draft(),before);
  await h.type(input+'grams','80.5');assert.equal(h.byId(input+'error'),undefined);
  const save=h.byId(input+'submit').props.onPress;await act(async()=>{save();save()});assert.equal(attempts,2);
  assert.equal(h.mode(),null);assert.equal(h.draft()[0].grams,80.5);
 }finally{await h.close()}
});
test('same mode object replaced with a fresh same-row object discards field state and consumes old callbacks',async()=>{
 const h=await harness();try{
  const mode={kind:'edit',ingredient:ingredient()};await h.setMode(mode);await h.type(input+'grams','20');const save=h.byId(input+'submit').props.onPress;
  await h.setMode({...mode});await act(async()=>save());assert.equal(h.log.filter(x=>x.event==='submit').length,0);assert.equal(h.byId(input+'grams').props.value,'100.25');
 }finally{await h.close()}
});
test('saved caller preserves NULL nutrition and exact decimal scale without lookup or final meal write',async()=>{
 const h=await harness({caller:'saved',unknownNutrition:true});try{
  await h.open('a');await h.type(input+'grams','50.125');
  const save=h.byId(input+'submit').props.onPress;await act(async()=>{save();save()});
  assert.equal(h.mode(),null);assert.equal(h.draft()[0].proteinG,null);assert.equal(h.draft()[0].calories,60.25);
  assert.equal(h.log.filter(x=>x.event==='lookup').length,0);
 }finally{await h.close()}
});
