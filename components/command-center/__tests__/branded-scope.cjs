const {test}=require('node:test'),assert=require('node:assert/strict');
const {screen,act}=require('./branded-screen-harness.cjs');
test('health permission guidance is app branded; Cancel/stale settings choice do not open OS settings',async()=>{
 const h=await screen('settings');try{
 await act(async()=>h.byId('settings-health-row').props.onPress());assert.ok(h.byId('app-prompt-action-1'));
 const old=h.byId('app-prompt-action-1').props.onPress;await h.press('Not now');await act(async()=>old());assert.equal(h.events.includes('healthSettings'),false);
 await act(async()=>h.byId('settings-health-row').props.onPress());await h.press('Open settings');assert.equal(h.events.filter(e=>e==='healthSettings').length,1);assert.equal(h.alerts.length,0);
 }finally{await h.close()}
});
test('new workout failure renders app-owned error acknowledgment without native Alert',async()=>{
 const h=await screen('workouts');try{
 await act(async()=>h.mutationOptions.at(-1).onError(Error('Controlled create failure')));
 assert.ok(h.byId('app-prompt-action-0'));assert.equal(h.alerts.length,0);await h.press('OK');assert.equal(Boolean(h.byId('app-prompt-action-0')),false);assert.equal(h.requests.length,0);
 }finally{await h.close()}
});
test('Apple sign-in is offered only on iOS; other platforms never render it or start SSO',async()=>{
 const previous=process.env.EXPO_OS;
 try{
  for(const os of ['web','android']){process.env.EXPO_OS=os;const h=await screen('signin');try{
   assert.equal(h.button('Continue with Apple'),undefined);assert.equal(h.events.includes('SSO'),false);assert.ok(h.button('Continue with Google'));
  }finally{await h.close()}}
  process.env.EXPO_OS='ios';const h=await screen('signin');try{assert.ok(h.button('Continue with Apple'))}finally{await h.close()}
 }finally{if(previous===undefined)delete process.env.EXPO_OS;else process.env.EXPO_OS=previous}
});
