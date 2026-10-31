const test=require('node:test'),assert=require('node:assert/strict');
const {deliverEmails}=require('../backend/jobs/email-notification.job');
async function deliver(enabled=true){
 const queue=[{id:1,user_id:8,dedup_key:'notification:10',subject:'New VCard enquiry',body:'Visitor details'}, {id:2,user_id:8,dedup_key:'notification:10:vcard',recipient_email:'card@example.test',subject:'New VCard enquiry',body:'Visitor details'}, {id:3,user_id:8,dedup_key:'appointment-decision:4',recipient_email:'visitor@example.test',subject:'Appointment confirmed',body:'Confirmed'}];
 const sent=[],updates=[];
 const db={async query(sql,args){if(sql.startsWith('WITH candidate'))return {rows:queue.length?[queue.shift()]:[]};if(sql.startsWith('SELECT u.email'))return {rows:[{email:'owner@example.test',status:'active',enabled}]};updates.push({sql,args});return {rows:[]};}};
 await deliverEmails(db,async mail=>sent.push(mail));return {sent,updates};
}
test('separate queued alerts deliver to account and VCard inboxes; decisions go to customer',async()=>{const {sent}=await deliver();assert.deepEqual(sent.map(m=>m.to),['owner@example.test','card@example.test','visitor@example.test']);assert.equal(sent[0].text,sent[1].text);});
test('notification preferences apply to both owner and VCard copies without suppressing customer decisions',async()=>{const {sent,updates}=await deliver(false);assert.deepEqual(sent.map(m=>m.to),['visitor@example.test']);assert.equal(updates.filter(q=>q.sql.includes("status='cancelled'")).length,2);});
