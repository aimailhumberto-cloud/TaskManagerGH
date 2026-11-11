import assert from 'node:assert/strict';
import { contactDistributors, distributorContacts, contactTarget, contactConnections } from '../src/lib/contactLayer';
const a={id:'dist-a',type:'distributor',frontmatter:{relations:{has_contact:['[[jony]]']}}};
const b={id:'dist-b',type:'distributor'};
const p={id:'jony',type:'person',frontmatter:{spatial_anchor:'dist-b',relations:{contact_for:['[[dist-a]]','[[dist-b]]']}}};
const hb={id:'hb',type:'person'};
const channel={id:'channel',type:'channel'};
const staff={id:'staff',type:'person',frontmatter:{reports_to:'[[hb]]'}};
const ns=[a,b,p,hb,channel,staff];
const ls=[{source:'jony',target:'hb',relationType:'in_contact_with'},{source:{id:'jony'},target:{id:'channel'},relationType:'covers_channel'},{source:'jony',target:'hb',relationType:'reference'}];
assert.deepEqual(contactDistributors(p,ns).map(n=>n.id),['dist-a','dist-b']);
assert.deepEqual(distributorContacts('dist-a',ns).map(n=>n.id),['jony']);
assert.deepEqual(contactConnections('jony',ns,ls).map(c=>c.node.id).sort(),['channel','hb']);
assert.equal(contactConnections('jony',ns,ls).find(c=>c.node.id==='hb')?.labels.length,1);
assert.equal(contactTarget(staff,ns,()=>({x:0,y:0})),null);
assert.equal(contactTarget(a,ns,()=>({x:0,y:0})),null);
for(const base of [{x:-400,y:120},{x:250,y:-600},{x:0,y:0}]){
 let selected='';const target=contactTarget(p,ns,n=>{selected=n.id;return base;})!;
 assert.equal(selected,'dist-b');assert.ok(Math.hypot(target.x-base.x,target.y-base.y)<150);
}
const q={id:'other-contact',type:'person',frontmatter:{relations:{contact_for:['[[dist-b]]']}}};
assert.notDeepEqual(contactTarget(p,[...ns,q],()=>({x:0,y:0})),contactTarget(q,[...ns,q],()=>({x:0,y:0})));
const inheritedAnchor={...q,spatial_anchor:'market-belize'};
assert.notDeepEqual(contactTarget(p,[...ns,inheritedAnchor],()=>({x:0,y:0})),contactTarget(inheritedAnchor,[...ns,inheritedAnchor],()=>({x:0,y:0})));
console.log('PASS: multiple distributors, canonical edges, contacts separate from reporting, shared channels, stable adjacent positions and sibling separation');
