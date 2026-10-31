const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const sourceCode = fs.readFileSync(require.resolve('../backend/controllers/user/vcards.controller'), 'utf8');
async function duplicate(options = {}) {
  const source = { id: 7, user_id: 4, company_id: null, template_id: 2, title: 'Original', qualifications: 'BSc', description: 'About', website_url: 'https://example.com', phone: '123', email: 'a@example.com', address: 'Address', social_links: [{type:'website',url:'https://example.com'}], settings: {sections:{about:'Details'},hiddenSections:['gallery'],profileImageUrl:'https://example.com/photo.png',contactCaptureRequired:false} };
  const queries = [];
  let released = false;
  const client = { release(){released=true;}, async query(sql, args){
    queries.push({sql,args});
    if(sql.startsWith('SELECT * FROM vcards')) return {rowCount:options.missing?0:1,rows:[source]};
    if(sql.includes('AS card_limit')) return {rows:[{card_limit:2,card_count:options.full?2:1}]};
    if(sql.includes('INSERT INTO vcards')) return {rows:[{id:8,slug:args[5],title:args[3],is_active:false}]};
    return {rows:[]};
  }};
  const exports = {};
  vm.runInNewContext(sourceCode, {exports, Buffer, require(name){
    if(name.includes('subscription-policy'))return {currentSubscription:()=> 'TRUE'};
    if(name.includes('database.config'))return {connect:async()=>client};
    if(name.includes('storage.service'))return {getStorageSummary:async()=>({usedBytes:0,limitBytes:options.storageFull?0:100000})};
    if(name.includes('vcard-entitlements'))return {loadVcardEntitlements:async()=>({templates:options.locked?[]:[{id:2}]})};
    if(name.includes('vcard-url'))return require('../backend/helpers/vcard-url');
    if(name.includes('vcard.validator'))return require('../backend/validators/vcard.validator');
    return require(name);
  }});
  const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  let error;
  await exports.duplicateVcard({params:{id:options.invalid?'bad':'7'},user:{id:4},protocol:'https',get:()=> 'example.com'},res,e=>{error=e;});
  assert.equal(error,undefined);
  return {res,queries,released,source};
}
test('duplicate creates a separate paused editable copy with all content and a unique URL',async()=>{
  const first=await duplicate(),second=await duplicate();
  assert.equal(first.res.code,201);
  assert.notEqual(first.res.body.vcard.slug,second.res.body.vcard.slug);
  assert.equal(first.res.body.vcard.title,'Original (copy)');
  assert.equal(first.res.body.vcard.is_active,false);
  const insert=first.queries.find(q=>q.sql.includes('INSERT INTO vcards'));
  assert.deepEqual(JSON.parse(insert.args[12]),first.source.settings);
  assert.deepEqual(JSON.parse(insert.args[11]),first.source.social_links);
  assert.deepEqual(Array.from(insert.args.slice(6,11)),['About','https://example.com','123','a@example.com','Address']);
  assert.ok(first.queries.some(q=>q.sql.includes('WHERE id=$1 AND user_id=$2') && q.args[1]===4));
  assert.ok(!first.queries.some(q=>q.sql.startsWith('UPDATE vcards')));
  assert.ok(first.queries.some(q=>q.sql==='COMMIT'));
  assert.ok(first.released);
});
test('duplicate rejects inaccessible cards, quota exhaustion, unavailable templates, and full storage',async()=>{
  for(const [options,status] of [[{missing:true},404],[{full:true},403],[{locked:true},403],[{storageFull:true},413]]){
    const result=await duplicate(options);
    assert.equal(result.res.code,status);
    assert.ok(!result.queries.some(q=>q.sql.includes('INSERT INTO vcards')));
    assert.ok(result.queries.some(q=>q.sql==='ROLLBACK'));
    assert.ok(result.released);
  }
});
test('duplicate rejects invalid IDs before opening a transaction',async()=>{
 const result=await duplicate({invalid:true});assert.equal(result.res.code,400);assert.equal(result.queries.length,0);
});
