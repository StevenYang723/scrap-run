(function(root){
  'use strict';
  const M={
    slug:{name:'标准弹',type:'shot',symbol:'▪',e:5,h:4,damage:16,speed:540,color:'#dbe6af',cost:12,desc:'稳定的直射弹体。低耗能，适合持续射击。'},
    shard:{name:'破片弹',type:'shot',symbol:'⋰',e:4,h:3,damage:11,speed:450,color:'#e8c786',cost:16,desc:'轻量弹体。与多重发射组合，形成一片扇形弹幕。'},
    trigger:{name:'撞击触发弹',type:'trigger',symbol:'◉',e:8,h:5,damage:6,speed:420,color:'#e6b77c',cost:35,desc:'命中敌人或障碍物时，释放后面的完整组合。未命中不会释放。'},
    triple:{name:'三重发射',type:'multi',symbol:'⋔',e:4,h:4,cost:35,desc:'复制后面的一组发射组合，向三个方向发射。每份都消耗能量。'},
    homing:{name:'追踪',type:'mod',symbol:'⌁',e:4,h:1,cost:40,desc:'后面的下一组弹体会追踪敌人。放在触发弹前只影响载弹。'},
    bounce:{name:'弹跳',type:'mod',symbol:'⌇',e:2,h:1,cost:25,desc:'下一组弹体可在墙面与障碍物上反弹两次。'},
    pierce:{name:'穿透',type:'mod',symbol:'⇥',e:4,h:3,cost:30,desc:'下一组弹体可多穿过两个敌人，并忽略正面盾牌减伤。'},
    fire:{name:'燃烧',type:'mod',symbol:'♨',e:5,h:5,cost:40,desc:'命中附加持续燃烧。射中油污或油桶会引发火焰。'},
    frost:{name:'冰冻',type:'mod',symbol:'✳',e:4,h:2,cost:40,desc:'命中使敌人减速 60%，持续 2.5 秒。适合带着战利品撤退。'},
    drill:{name:'钻头弹',type:'shot',symbol:'▷',e:12,h:8,damage:24,speed:580,color:'#c0dba4',cost:55,desc:'穿透两个敌人，快速破坏薄墙与木箱，开辟新的射击角度。'},
    blast:{name:'爆破弹',type:'shot',symbol:'✹',e:22,h:18,damage:30,speed:340,color:'#eca280',cost:65,desc:'命中后范围爆炸。会引燃油污、破坏掩体，并伤到靠得太近的自己。'},
    arc:{name:'电弧弹',type:'shot',symbol:'ϟ',e:15,h:10,damage:21,speed:550,color:'#a8dada',cost:55,desc:'命中水中的敌人时，电弧会连锁至附近敌人。'}
  };
  const CHASSIS={scout:{name:'轻便型',slots:4,energy:68,regen:29,cool:32,speed:205,delay:.34,recharge:.55},standard:{name:'均衡型',slots:6,energy:100,regen:25,cool:29,speed:182,delay:.38,recharge:.65},heavy:{name:'重载型',slots:6,energy:150,regen:22,cool:26,speed:158,delay:.42,recharge:.8}};
  function parse(sequence){
    const tokens=sequence.filter(Boolean); let i=0;
    function next(depth){
      if(i>=tokens.length) throw new Error('模块后缺少弹体：请补上弹体或触发组合');
      const kind=tokens[i++],m=M[kind];
      if(!m)throw new Error('未知模块');
      if(m.type==='trigger' && depth>=2)throw new Error('最多支持两层命中触发');
      return m.type==='shot'?{kind}:{kind,child:next(depth+(m.type==='trigger'?1:0))};
    }
    const nodes=[];while(i<tokens.length)nodes.push(next(0));
    if(!nodes.length)throw new Error('请至少装入一枚弹体');
    return nodes;
  }
  function tally(node,mods=[]){
    const m=M[node.kind];
    if(m.type==='mod')return tally(node.child,[...mods,node.kind]);
    if(m.type==='multi'){
      const c=tally(node.child,mods);return{energy:m.e+c.energy*3,heat:m.h+c.heat*3,count:c.count*3};
    }
    const t={energy:m.e+mods.reduce((s,id)=>s+M[id].e,0),heat:m.h+mods.reduce((s,id)=>s+M[id].h,0),count:1};
    if(node.child){const c=tally(node.child);t.energy+=c.energy;t.heat+=c.heat;t.count+=c.count;}
    return t;
  }
  function describe(node){const m=M[node.kind];return node.child?m.name+'〔'+describe(node.child)+'〕':m.name;}
  function compile(sequence,chassis='standard'){
    try{
      const frame=CHASSIS[chassis];if(!frame)throw new Error('未知机匣');
      if(sequence.slice(frame.slots).some(Boolean))throw new Error('机匣槽位不足');
      const nodes=parse(sequence),shots=nodes.map(n=>tally(n));
      const peak=Math.max(...shots.map(s=>s.energy)),heat=Math.max(...shots.map(s=>s.heat)),count=shots.reduce((n,s)=>n+s.count,0);
      if(peak>frame.energy)throw new Error('供能不足：需要 '+peak+'，机匣上限 '+frame.energy);
      if(heat>100)throw new Error('单次发射过热：减少复制或高热模块');
      if(shots.some(s=>s.count>48))throw new Error('单次弹体过多：请减少复制层数');
      return{ok:true,nodes,shots,peak,heat,count,description:nodes.map(describe).join(' → ')};
    }catch(e){return{ok:false,error:e.message,nodes:[],shots:[],peak:0,heat:0,count:0};}
  }
  function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  function counts(list){const out={};for(const id of list)if(id)out[id]=(out[id]||0)+1;return out;}
  function canEquip(sequence,pool){return Object.entries(counts(sequence)).every(([id,n])=>n<=(pool[id]||0));}
  function freshBank(){return{scrap:0,runs:0,wins:0,modules:{slug:3,shard:3,trigger:1,triple:1,homing:1,bounce:1},unlocked:['slug','shard','trigger','triple','homing','bounce']};}
  const ROOM_NAMES=['装卸入口','包装车间','样品实验室','零件仓库','积水泵房','安保中枢','低温仓库','熔炼车间','货运升降机'];
  function neighbor(room,dir){const x=room%3,y=Math.floor(room/3);return dir==='left'?(x>0?room-1:-1):dir==='right'?(x<2?room+1:-1):dir==='up'?(y>0?room-3:-1):(y<2?room+3:-1);}
  function makeRun(seed,chassis,loadout,training=false){
    const random=rng(seed),rooms=[];
    for(let r=0;r<9;r++){
      const obstacles=[{x:180,y:127,w:110,h:65,kind:'crate',hp:55},{x:650,y:400,w:135,h:65,kind:r===7?'tank':'crate',hp:60},{x:605,y:125,w:100,h:55,kind:'machine',hp:1e9}];
      if(r===3 || r===5)obstacles.push({x:448,y:103,w:22,h:120,kind:'thin',hp:65});
      if(r===4)obstacles.push({x:200,y:410,w:115,h:45,kind:'machine',hp:1e9});
      const terrain=r===4?[{x:345,y:170,w:265,h:240,kind:'water'}]:r===7?[{x:350,y:180,w:220,h:230,kind:'oil'}]:r===2?[{x:360,y:190,w:190,h:150,kind:'water'}]:[];
      const chests=r===0?[{x:295,y:425,opened:false,type:'starter'}]:[{x:740,y:180,opened:false,type:r===2?'lab':r===5?'security':'normal'},{x:245,y:445,opened:false,type:r===6?'cold':'normal'}];
      const enemies=[];
      if(r>0){const n=3+(r>3?1:0)+(r>6?1:0);for(let j=0;j<n;j++){
        const positions=[[660,280],[425,195],[750,485],[320,350],[525,430]],kinds=['swarm','sentry','hunter','shield'];
        const kind=kinds[(r+j)%4],pos=positions[j],maxHp=kind==='shield'?75:kind==='sentry'?46:kind==='hunter'?35:28;
        enemies.push({id:r*20+j,x:pos[0]+random()*30,y:pos[1]+random()*25,kind,hp:maxHp,maxHp,cool:random()*1.2,burn:0,frost:0,angle:0,contact:0});
      }}
      rooms.push({name:ROOM_NAMES[r],obstacles,terrain,chests,enemies,visited:r===0,cleared:r===0,alarmSpawned:false});
    }
    if(training){rooms[0].obstacles=[];rooms[0].terrain=[];rooms[0].chests=[];rooms[0].enemies=[170,300,430].map((y,i)=>({id:i,x:650,y,kind:'dummy',hp:150,maxHp:150,cool:0,burn:0,frost:0,angle:Math.PI,contact:0}));}
    return{seed,chassis,loadout:loadout.slice(),room:0,rooms,player:{x:110,y:300,hp:100,energy:CHASSIS[chassis].energy,heat:0,angle:0,invulnerable:0},cargo:[],safeId:null,bullets:[],enemyBullets:[],fires:[],time:0,alarm:0,kills:0,opened:0,shot:0,cooldown:0,paused:false,action:null,nextId:1000,training,target:null,doorCooldown:0};
  }
  function moduleLoot(run,type){
    const random=rng(run.seed+run.nextId*17+run.opened*101),pick=a=>a[Math.floor(random()*a.length)];
    if(type==='starter')return{kind:'module',id:'bounce',uid:run.nextId++};
    const pools={lab:['trigger','homing','arc','blast'],security:['pierce','triple','drill','blast'],cold:['frost','homing','arc'],normal:['slug','shard','bounce','fire','pierce','triple']};
    if(random()<.28)return{kind:'scrap',value:25+Math.floor(random()*35),uid:run.nextId++};
    return{kind:'module',id:pick(pools[type]||pools.normal),uid:run.nextId++};
  }
  function award(bank,item){if(item.kind==='scrap')bank.scrap+=item.value;else{bank.modules[item.id]=(bank.modules[item.id]||0)+1;if(!bank.unlocked.includes(item.id))bank.unlocked.push(item.id);}}
  function settle(bank,run,success){
    if(run.settled)return[];run.settled=true;bank.runs++;
    const recovered=success?[...run.loadout.filter(Boolean).map(id=>({kind:'module',id})),...run.cargo]:run.cargo.filter(i=>i.uid===run.safeId && i.kind==='module');
    for(const item of recovered)award(bank,item);
    if(success){bank.wins++;if(run.cargo.length)bank.scrap+=20;}
    bank.modules.slug=Math.max(1,bank.modules.slug||0);
    return recovered;
  }
  function circleRect(x,y,r,o){const nx=Math.max(o.x,Math.min(x,o.x+o.w)),ny=Math.max(o.y,Math.min(y,o.y+o.h));return (x-nx)**2+(y-ny)**2<r*r;}
  function lineBlocked(a,b,obstacles){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(d/12));for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;if(obstacles.some(o=>x>o.x&&x<o.x+o.w&&y>o.y&&y<o.y+o.h))return true;}return false;}
  const api={M,CHASSIS,ROOM_NAMES,parse,tally,compile,rng,counts,canEquip,freshBank,neighbor,makeRun,moduleLoot,award,settle,circleRect,lineBlocked};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.ScrapEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
