const {test}=require('node:test'),assert=require('node:assert/strict');const {screen,act}=require('./branded-screen-harness.cjs');
for(const stage of ['denied','recording','transcription'])test(`actual CoachComposer/voice hook ${stage} guidance is branded; native permission request remains at audio boundary`,async()=>{
 const h=await screen('voice');try{
 h.voice({permission:stage!=='denied',startError:stage==='recording',transcribeError:stage==='transcription'});
 await h.press('Start voice input');
 if(stage==='transcription'){await new Promise(r=>setTimeout(r,550));await h.press('Stop voice input');assert.equal(h.events.filter(e=>e==='transcribe').length,1)}
 assert.equal(h.events.filter(e=>e==='microphonePermission').length,1);assert.ok(h.byId('app-prompt-action-0'),'real composer renders voice prompt');assert.equal(h.alerts.length,0);
 const stale=h.byId('app-prompt-action-0').props.onPress;await h.press('OK');await act(async()=>stale());assert.equal(Boolean(h.byId('app-prompt-action-0')),false);
 }finally{await h.close()}
});
