const assert=require('node:assert/strict');
const fs=require('node:fs');
const E=require('./engine.js');
const presets=[['homing','trigger','triple','shard'],['trigger','triple','homing','shard'],['triple','trigger','homing','shard']];
for(const [i,seq]of presets.entries()){const c=E.compile(seq);assert.equal(c.ok,true);assert.equal(c.peak,[28,36,52][i]);assert.equal(c.count,[4,4,6][i]);}
assert.equal(E.compile(['homing']).ok,false);
assert.equal(E.compile(['trigger','trigger','trigger','slug']).ok,false);
assert.equal(E.compile(['triple','triple','blast'],'heavy').ok,false);
assert.equal(E.compile(['slug','','','','slug'],'scout').ok,false);
assert.equal(E.canEquip(['slug','slug'],{slug:1}),false);
const bank=E.freshBank(),run=E.makeRun(7,'standard',['slug','','','','','']);bank.modules.slug--;
run.cargo=[{kind:'module',id:'arc',uid:2},{kind:'scrap',value:40,uid:3}];run.safeId=2;
const initial=bank.modules.slug;E.settle(bank,run,true);assert.equal(bank.modules.slug,initial+1);assert.equal(bank.modules.arc,1);assert.equal(bank.scrap,60);assert.equal(bank.wins,1);assert.ok(bank.unlocked.includes('arc'));
E.settle(bank,run,true);assert.equal(bank.modules.arc,1);assert.equal(bank.scrap,60);
const dead=E.makeRun(8,'standard',['blast']);dead.cargo=[{kind:'module',id:'frost',uid:6},{kind:'module',id:'blast',uid:7},{kind:'scrap',value:55,uid:8}];dead.safeId=6;E.settle(bank,dead,false);assert.equal(bank.modules.frost,1);assert.equal(bank.modules.blast,undefined);assert.equal(bank.scrap,60);
assert.equal(E.neighbor(0,'left'),-1);assert.equal(E.neighbor(0,'down'),3);assert.equal(E.neighbor(8,'up'),5);
for(const r of E.makeRun(1,'standard',['slug']).rooms){assert.ok(r.name);assert.ok(r.chests.length>0);assert.ok(r.obstacles.length>0);}
assert.ok(E.circleRect(10,10,5,{x:8,y:8,w:10,h:10}));assert.equal(E.lineBlocked({x:0,y:0},{x:100,y:0},[{x:40,y:-10,w:10,h:20}]),true);
const html=fs.readFileSync('index.html','utf8');const js=fs.readFileSync('game.js','utf8');const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);assert.equal(ids.length,new Set(ids).size);for(const match of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),'Missing DOM ID: '+match[1]);
for(const match of html.matchAll(/(?:src|href)="((?:engine|game|style)\.[^"]+)"/g))assert.ok(fs.existsSync(match[1]));
console.log('PASS: module order, nested triggers, power limits, inventory ownership, successful extraction, death insurance, idempotent settlement, map connections, geometry, DOM references.');
