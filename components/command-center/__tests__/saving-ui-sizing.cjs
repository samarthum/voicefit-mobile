const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderOverlay,textOf}=require('./saving-ui-harness.cjs');
test('saving sizing responds to large fonts, narrow screens and safe-area-constrained viewports through the actual overlay',async()=>{
  const normal=await renderOverlay({height:844,width:390,fontScale:1,top:24,bottom:34});
  const large=await renderOverlay({height:844,width:390,fontScale:2,top:24,bottom:34});
  const narrow=await renderOverlay({height:568,width:320,fontScale:1,top:24,bottom:16});
  const tiny=await renderOverlay({height:240,width:320,fontScale:3,top:24,bottom:34});
  try{
    for(const s of [normal,large,narrow,tiny])await s.update({state:'cc_saving',review:{kind:'workout'}});
    assert.ok(large.modal().snapPoints[0]>normal.modal().snapPoints[0],'Large fonts need more space, not the default compact height');
    assert.ok(narrow.modal().snapPoints[0]>=236&&narrow.modal().snapPoints[0]<=280);
    assert.ok(tiny.modal().snapPoints[0]<=216,'Never exceed the top-safe-area container');
    assert.ok(tiny.modal().snapPoints[0]>0);
    const {SheetShell}=tiny.load('@/components/command-center/states/SheetShell');
    assert.equal(tiny.r.root.findByType(SheetShell).props.scrollable,true,'Overflow remains scrollable instead of clipping scaled text');
    assert.ok(tiny.r.root.findAll(n=>n.type==='ScrollView').length>0);
    assert.match(textOf(tiny.r),/Saving your workout…/);
    assert.equal(tiny.r.root.findAll(n=>n.type==='Text').some(n=>n.props.numberOfLines||n.props.allowFontScaling===false),false);
    for(const s of [normal,large,narrow,tiny]){
      await s.update({state:'cc_recording'});assert.deepEqual(s.modal().snapPoints,['92%']);
      await s.update({state:'cc_interpreting_voice'});assert.deepEqual(s.modal().snapPoints,['92%']);
    }
  }finally{for(const s of [normal,large,narrow,tiny])await s.close()}
});
