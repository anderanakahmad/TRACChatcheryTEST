import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const sql=await fs.readFile(new URL('../database/schema.sql',import.meta.url),'utf8');
for(const snippet of ["role='admin'", "submission_type in ('new_nest','milestone','correction')", "review_state in ('pending','approved','rejected','returned')",'nest_audit','supersedes_submission_id','tracc_decide_submission','allowed_milestone','Forbidden milestone public field','Administrators see protected scientific records','Administrators see full audit history'])assert.ok(sql.includes(snippet),`Missing schema policy: ${snippet}`);
assert.ok(!sql.includes("role in ('warden','editor','admin')"),'Wardens cannot read staff research');
assert.ok(!sql.includes('grant update on public.nests'),'Do not grant direct edits');
console.log('V5 schema policy static contract: PASS (not a substitute for live RLS tests)');
