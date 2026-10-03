// Test-owned IPC bridge: actual POST/schema/idempotency helper, injected DB/auth.
import { createInterface } from "node:readline";
// Resolve cross-project fixtures at runtime so mobile's @/* compiler alias
// never traverses backend validators. Bun still executes the existing loader.
const { helpers, loadFixtureModule, request } = await import(new URL("../../../../backend/tests/route-fixture.js", import.meta.url).href);
const { transactionalStore } = await import(new URL("../../../../backend/tests/transaction-fixture.js", import.meta.url).href);
const store=transactionalStore();
// Model Prisma's nullable/default timestamp columns at the database boundary.
const transaction=store.prisma.$transaction;
store.prisma.$transaction=run=>transaction(async tx=>{
 const create=tx.workoutSet.create;
 tx.workoutSet.create=({data})=>create({data:{reps:null,weightKg:null,durationMinutes:null,notes:null,transcriptRaw:null,createdAt:new Date(),updatedAt:new Date(),...Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined))}});
 return run(tx);
});
const {POST}=await loadFixtureModule("app/api/workout-sets/route.ts",{"@/lib/db":{prisma:store.prisma},"@/lib/api-helpers":helpers("user-a")});
for await(const line of createInterface({input:process.stdin})){
 try{
  const message=JSON.parse(line);
  if(message.stats){process.stdout.write(JSON.stringify({rows:store.state.rows,events:store.state.events,receipts:store.state.receipts})+"\n");continue;}
  const response=await POST(request("workout-sets",message.body));
  process.stdout.write(JSON.stringify({status:response.status,...await response.json()})+"\n");
 }catch(error){process.stdout.write(JSON.stringify({error:String(error)})+"\n");}
}
