const {test}=require('node:test'),assert=require('node:assert/strict');
const {harness,act,ingredient}=require('./ingredient-modal-harness.cjs');
test('modal form uses plain native inputs in a keyboard-aware scrolling form with reachable actions',async()=>{
 const h=await harness();try{
  await h.open('a');const scroll=h.modal().findAllByType('KeyboardAwareScrollView');
  assert.equal(scroll.length,1,'Modal body must not use a Gorhom scrollable');
  assert.equal(scroll[0].props.keyboardShouldPersistTaps,'handled');
  assert.equal(scroll[0].findAllByType('TextInput').length,2);
  assert.equal(h.byId('cc-ingredient-editor-name').props.autoFocus,true);
  assert.equal(h.byId('cc-ingredient-editor-grams').props.keyboardType,'decimal-pad');
  assert.ok(scroll[0].findAll(n=>n.props.testID==='cc-ingredient-editor-submit').length);
 }finally{await h.close()}
});
test('two Save callbacks in one event issue one lookup; failure remains retryable',async()=>{
 let reject,resolve,lookups=0;const h=await harness({lookup:()=>{lookups++;return new Promise((r,j)=>{resolve=r;reject=j})}});try{
  await h.open('a');await h.type('cc-ingredient-editor-name','Paneer');
  const save=h.byId('cc-ingredient-editor-submit').props.onPress;
  await act(async()=>{save();save()});assert.equal(lookups,1);
  await act(async()=>reject(Error('Offline')));assert.ok(h.byId('cc-ingredient-editor-error'));
  assert.equal(h.byId('cc-ingredient-editor-submit').props.disabled,false);
  await h.press('cc-ingredient-editor-submit');assert.equal(lookups,2);
  await act(async()=>resolve({...ingredient(),name:'Paneer'}));assert.equal(h.mode(),null);
  assert.equal(h.log.filter(e=>e.event==='submit').length,1);
 }finally{await h.close()}
});
for(const os of ['android','ios'])test(`${os}: obsolete native dismissal and requestClose after same-row replacement cannot remove new modal`,async()=>{
 const h=await harness({os});try{
  await h.open('a');const oldProps=h.modal().props;await h.type('cc-ingredient-editor-name','Dirty old name');
  await h.open('a');assert.notEqual(h.modal().props.identifier,oldProps.identifier);
  await act(async()=>{oldProps.onDismiss();oldProps.onRequestClose()});
  assert.equal(h.byId('cc-ingredient-editor-name').props.value,'Rice a');assert.ok(h.modal());assert.ok(h.mode());
 }finally{await h.close()}
});
for(const caller of ['single','saved'])test(`${caller}: full-screen native host can cancel before layout and immediately reopen`,async()=>{
 const h=await harness({caller});try{
  await h.open('a');const modal=h.modal();assert.ok(modal,'Ingredient editor must render the installed RN Modal, not another sheet');
  assert.equal(modal.props.presentationStyle,'fullScreen');assert.equal(modal.props.animationType,'none');assert.equal(modal.props.transparent,false);
  const oldClose=modal.props.onRequestClose,oldCancel=h.byId('cc-ingredient-editor-cancel').props.onPress;
  const before=h.draft();await h.press('cc-ingredient-editor-cancel');assert.equal(h.mode(),null);
  await h.open('b');await act(async()=>{oldClose();oldCancel()});
  assert.equal(h.byId('cc-ingredient-editor-name').props.value,'Rice b');assert.deepEqual(h.draft(),before);
  assert.equal(h.log.filter(e=>e.event==='navigationBack').length,0);
 }finally{await h.close()}
});
