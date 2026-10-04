const {test}=require('node:test');
const assert=require('node:assert/strict');
const {screen,empty,meal}=require('./date-history-harness.cjs');

test('Browsing an empty historical Home day does not persist device steps or create a dot',async()=>{
 const metrics=new Map();
 const s=await screen({deviceSteps:300,response:({scope,date},{method,body})=>{
  if(method==='POST'){const data=JSON.parse(body);metrics.set(data.date,data.steps);return {};}
  const data=empty();data.today.steps.count=metrics.get(date)??null;
  if(scope==='full')data.weeklyTrends=[...metrics].map(([date,steps])=>({date,steps,calories:0,weight:null,workouts:0}));
  return data;
 }});
 try{
  const writes=()=>s.requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body));
  assert.deepEqual(writes(),[{date:'2026-10-04',steps:300}],'today auto-sync remains functional');
  for(const date of ['2026-10-01','2026-10-02','2026-10-03']){
   assert.equal(s.hasDot(date),false,'past day starts empty');
   await s.select(date);await s.settle();
   assert.equal(s.hasDot(date),false,'visiting past day must not create logged evidence');
   assert.doesNotMatch(s.byId('home-day-'+date).props.accessibilityLabel,/logged activity/);
   assert.equal(writes().some(w=>w.date===date),false,'date tap must not POST historical metrics');
  }
  await s.select('2026-10-04');assert.equal(writes().length,1,'returning to today must not duplicate its sync');
 }finally{await s.close();}
});

test('Previously imported step-only days are not logging dots, while real entries stay marked',async()=>{
 const history={...empty(),weeklyTrends:[
  {date:'2026-09-28',steps:5000,calories:0,weight:null,workouts:0},
  {date:'2026-09-29',steps:5000,calories:0,weight:72,workouts:0},
  {date:'2026-09-30',steps:0,calories:0,weight:null,workouts:1},
 ],recentMeals:[meal('2026-10-02',null,'interpreting')]};
 const s=await screen({response:({scope,date})=>{
  if(scope==='full')return history;
  const data=empty();data.today.steps.count=5000;
  if(date==='2026-10-03')data.recentMeals=[meal(date,0)];
  return data;
 }});
 try{
  assert.equal(s.hasDot('2026-09-28'),false,'an already imported step-only metric must not look like a user log');
  for(const date of ['2026-09-29','2026-09-30','2026-10-02'])assert.equal(s.hasDot(date),true,'real weight, workout and pending-meal records stay visible');
  await s.select('2026-10-01');assert.equal(s.hasDot('2026-10-01'),false,'cached selected-day imported steps are not logged evidence');
  await s.select('2026-10-03');assert.equal(s.hasDot('2026-10-03'),true,'a zero-calorie real meal is still logged');
  await s.select('2026-10-04');assert.equal(s.hasDot('2026-10-01'),false,'returning to today cannot expose an imported-step dot');
  assert.equal(s.requests.some(r=>r.method==='POST'),false,'browsing and deriving dots never mutate persisted metrics');
 }finally{await s.close();}
});
