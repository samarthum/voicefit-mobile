const {test}=require('node:test');
const assert=require('node:assert/strict');
const {renderSaving,renderOverlay,textOf}=require('./saving-ui-harness.cjs');
test('pending save is a small busy status, not a voice hero or an action surface',async()=>{
  const s=await renderSaving('meal');
  try {
    assert.equal(s.r.root.findAll(n=>n.type==='VoiceRing').length,0,'Remove the 180dp voice hero');
    const loader=s.r.root.findByType('ActivityIndicator');
    assert.equal(loader.props.size,'small');
    assert.equal(loader.props.color,'#477461');
    assert.equal(s.r.root.findAll(n=>n.type==='Pressable').length,0);
    assert.match(textOf(s.r),/Saving your meal…/);
    assert.match(textOf(s.r),/Adding it to your log\./);
    assert.doesNotMatch(textOf(s.r),/saved|retry|cancel|\d+%|seconds/i);
    const status=s.r.root.findAll(n=>n.type==='View'&&n.props.testID==='cc-saving-status')[0];
    assert.ok(status,'Expose a single polite busy status');
    assert.equal(status.props.accessible,true);
    assert.equal(status.props.accessibilityLiveRegion,'polite');
    assert.deepEqual(status.props.accessibilityState,{busy:true});
    assert.equal(status.props.accessibilityLabel,'Saving your meal… Adding it to your log.');
    assert.deepEqual(s.dispatches,[]);
  } finally {await s.close()}
});
test('all three saving states compact the existing modal and restore review/error without lifecycle or dispatch side effects',async()=>{
  const s=await renderOverlay();
  try{
    assert.deepEqual(s.events,['mount']);
    await s.update({state:'cc_review_meal',review:{kind:'meal'}});
    assert.deepEqual(s.modal().snapPoints,['92%']);
    assert.deepEqual(s.events,['mount','present']);
    for(const state of ['cc_saving','cc_auto_saving','cc_quick_add_saving']){
      await s.update({state,review:{kind:'meal'}});
      assert.equal(s.modal().snapPoints.length,1);
      assert.equal(typeof s.modal().snapPoints[0],'number',`${state} must not retain the full-height review snap`);
      assert.ok(s.modal().snapPoints[0]>=220&&s.modal().snapPoints[0]<=280);
      assert.match(textOf(s.r),/Saving your meal…/);
      assert.equal(s.modal().enableDynamicSizing,false);
      assert.equal(s.modal().enablePanDownToClose,false);
      assert.equal(s.modal().backdropComponent({}).props.pressBehavior,'none');
      assert.equal(s.modal().footerComponent({}),null);
      assert.equal(s.r.root.findAll(n=>n.type==='Pressable').length,0);
      for(const restore of ['cc_review_meal','cc_error']){
        await s.update({state:restore,error:{copy:{title:'Not saved'}}});
        assert.deepEqual(s.modal().snapPoints,['92%']);
        await s.update({state});
      }
    }
    assert.deepEqual(s.events,['mount','present']);
    assert.deepEqual(s.dispatches,[]);
  }finally{await s.close()}
});
