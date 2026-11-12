(() => {
  'use strict';
  const E=window.ScrapEngine, M=E.M, C=E.CHASSIS, $=id=>document.getElementById(id);
  const canvas=$('game'),ctx=canvas.getContext('2d'),W=960,H=600,SAVE='scrap-run-v1';
  let bank=E.freshBank(),draft=['homing','trigger','triple','shard','',''],chassis='standard',run=null,testRun=null,mode='camp',auto=true,sound=false,tab='gun',compiled=null;
  let particles=[],beams=[],keys=new Set(),rightDown=false,pointer={x:600,y:300},last=0,saveTimer=0,uiTimer=0,toastTimer=0,audio=null,logs=[],lastContext='',saveAvailable=true;
  let joystick={x:0,y:0},padPointer=null,camera={x:0,viewWidth:W,scale:1};
  const phone=()=>window.matchMedia('(max-width:700px)').matches;
  function resizeCanvas(){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);const cw=Math.round(b.width*dpr),ch=Math.round(b.height*dpr);if(cw&&ch&&(canvas.width!==cw||canvas.height!==ch)){canvas.width=cw;canvas.height=ch;}}
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeCanvas).observe(canvas);window.addEventListener('resize',resizeCanvas);resizeCanvas();
  const camp=E.makeRun(7,'standard',draft);camp.player.x=690;camp.player.y=307;camp.player.angle=-.25;
  function world(){return mode==='test'?testRun:mode==='run'?run:null;}
  function currentLoadout(){return run?run.loadout:draft;}
  function currentChassis(){return run?run.chassis:chassis;}
  function timeText(t){return Math.floor(t/60).toString().padStart(2,'0')+':'+Math.floor(t%60).toString().padStart(2,'0');}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function show(id,value){$(id).classList.toggle('hidden',!value);}
  function log(text){logs.unshift({time:timeText(run?run.time:0),text});logs=logs.slice(0,12);$('log-list').innerHTML=logs.slice(0,6).map(l=>'<div class="log-entry"><time>'+l.time+'</time><span>'+esc(l.text)+'</span></div>').join('');}
  function toast(text){$('toast').textContent=text;$('toast').classList.add('show');toastTimer=3;}
  function beep(freq=340,length=.07,type='triangle',gain=.035){if(!sound)return;try{if(!audio)audio=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{}}
  function save(){try{localStorage.setItem(SAVE,JSON.stringify({version:1,bank,draft,chassis,run,auto,sound}));}catch{saveAvailable=false;$('save-note').textContent='浏览器未允许存档，请在关页前撤离';}}
  function load(){try{const raw=localStorage.getItem(SAVE);if(!raw)return;const s=JSON.parse(raw);if(s.version!==1||!s.bank||!s.bank.modules||!Array.isArray(s.bank.unlocked))return;
    for(const [id,n]of Object.entries(s.bank.modules))if(!M[id]||!Number.isFinite(n)||n<0)throw Error('bad inventory');
    bank=s.bank;bank.unlocked=bank.unlocked.filter(id=>M[id]);chassis=C[s.chassis]?s.chassis:'standard';
    if(Array.isArray(s.draft)&&s.draft.length===6&&s.draft.every(id=>!id||M[id]))draft=s.draft;
    auto=s.auto!==false;sound=s.sound===true;
    if(s.run&&!s.run.settled&&s.run.rooms?.length===9&&C[s.run.chassis]&&s.run.player&&s.run.loadout?.length===6&&s.run.loadout.every(id=>!id||M[id])&&s.run.room>=0&&s.run.room<9){run=s.run;run.paused=true;run.target=null;run.action=null;run.bullets=run.bullets||[];run.enemyBullets=run.enemyBullets||[];run.fires=run.fires||[];mode='run';}
  }catch{toast('存档无法读取，已准备新的回收装备。');}}
  function pool(){if(!run)return bank.modules;return E.counts([...run.loadout,...run.cargo.filter(x=>x.kind==='module').map(x=>x.id)]);}
  function changeLoadout(next){
    if(run&&!run.paused){toast('先按 Tab 暂停，才能安全改装。');updateWorkshop();return false;}
    if(!E.canEquip(next,pool())){toast('库存中没有足够的对应模块。');updateWorkshop();return false;}
    if(run){
      const items=[...run.loadout.filter(Boolean).map(id=>({kind:'module',id,uid:run.nextId++})),...run.cargo];
      for(const id of next.filter(Boolean)){const i=items.findIndex(x=>x.kind==='module'&&x.id===id);items.splice(i,1);}
      if(items.length>6){toast('背包已满，无法收下卸掉的模块。');updateWorkshop();return false;}
      run.loadout=next;run.cargo=items;
      if(!items.some(i=>i.uid===run.safeId))run.safeId=items.find(i=>i.kind==='module')?.uid??null;
      run.shot=0;
    }else draft=next;
    if(testRun){testRun.loadout=next.slice();testRun.shot=0;}
    updateWorkshop();renderBag();save();return true;
  }
  function updateWorkshop(){
    const ids=currentLoadout(),frame=C[currentChassis()],available=pool();compiled=E.compile(ids,currentChassis());
    $('module-slots').innerHTML=ids.map((id,i)=>'<label class="slot '+(i>=frame.slots?'disabled':'')+'"><span class="slot-label">'+String(i+1).padStart(2,'0')+'<b>'+(id?M[id].symbol:'—')+'</b></span><select aria-label="第 '+(i+1)+' 槽模块" data-slot="'+i+'" '+(i>=frame.slots||(run&&!run.paused)?'disabled':'')+'><option value="">空槽</option>'+Object.entries(M).map(([key,m])=>'<option value="'+key+'" '+(key===id?'selected ':'')+(!(available[key]>0)?'disabled':'')+'>'+m.name+(available[key]>0?' ×'+available[key]:' · 未持有')+'</option>').join('')+'</select></label>').join('');
    $('module-slots').querySelectorAll('select').forEach(s=>{
      s.addEventListener('change',()=>{const next=currentLoadout().slice();next[Number(s.dataset.slot)]=s.value;changeLoadout(next);if(s.value)$('module-note').textContent=M[s.value].desc;});
      s.addEventListener('focus',()=>{if(s.value)$('module-note').textContent=M[s.value].desc;});
    });
    $('module-slots').querySelectorAll('.slot-label').forEach((label,i)=>{
      if(i===0||i>=frame.slots)return;const move=document.createElement('button');move.type='button';move.className='slot-move';move.textContent='←';move.setAttribute('aria-label','将第 '+(i+1)+' 槽模块左移');move.title='与左侧模块交换';move.disabled=!!run&&!run.paused;
      move.onclick=event=>{event.preventDefault();event.stopPropagation();const next=currentLoadout().slice();[next[i-1],next[i]]=[next[i],next[i-1]];changeLoadout(next);};label.appendChild(move);
    });
    $('compile-status').classList.toggle('invalid',!compiled.ok);
    $('compile-status').textContent=compiled.ok?'✓ '+compiled.description:'! '+compiled.error;
    $('stat-energy').textContent=compiled.ok?compiled.peak:'—';$('stat-projectiles').textContent=compiled.ok?compiled.count:'—';$('stat-capacity').textContent=frame.energy;$('chassis-slot-count').textContent=frame.slots+' 槽';
    $('gun-nickname').textContent=ids.includes('blast')?'危险的小天才 / MK.04':ids.includes('trigger')?'连锁坏主意 / MK.03':ids.includes('triple')?'雨点制造机 / MK.02':'小型坏主意 / MK.01';
    $('gun-core').setAttribute('fill',compiled.ok?'#e4bf79':'#d67b63');
    $('deploy-btn').disabled=!compiled.ok;$('test-btn').disabled=!compiled.ok&&mode!=='test';
    $('quick-action').disabled=mode==='camp'&&!compiled.ok;
    document.querySelectorAll('[data-chassis]').forEach(b=>{b.classList.toggle('selected',b.dataset.chassis===currentChassis());b.disabled=!!run||mode==='test';});
    document.querySelectorAll('[data-preset]').forEach(b=>b.disabled=!!run&&!run.paused);
    $('clear-gun').disabled=!!run&&!run.paused;
    show('work-btn',!!run);$('work-btn').textContent=run?.paused?'继续回收':'打开改装台';
  }
  function renderBag(){
    $('bag-count').textContent=run?run.cargo.length+'/6':'仓库';$('bag-title').textContent=run?'本局背包 / 尚未入库':'仓库库存 / 已安全入库';$('scrap-total').textContent=bank.scrap;
    if(run){$('bag-list').innerHTML=run.cargo.length?run.cargo.map(i=>'<div class="bag-item"><div class="bag-icon">'+(i.kind==='module'?M[i.id].symbol:'▧')+'</div><div class="item-copy"><strong>'+ (i.kind==='module'?M[i.id].name:'回收材料')+'</strong><small>'+(i.kind==='module'?M[i.id].type==='shot'?'弹体模块':'行为模块':i.value+' 份材料')+'</small></div>'+(i.kind==='module'?'<button data-insure="'+i.uid+'" class="'+(i.uid===run.safeId?'insured':'')+'">'+(i.uid===run.safeId?'▣ 已保险':'保险')+'</button>':'')+'<button class="discard" data-discard="'+i.uid+'">丢弃</button></div>').join(''):'<div class="empty-bag">背包空空，想法很多。<br>靠近补给箱，按 E 搜索。</div>';
      $('bag-list').querySelectorAll('[data-insure]').forEach(b=>b.onclick=()=>{run.safeId=Number(b.dataset.insure);renderBag();save();});
      $('bag-list').querySelectorAll('[data-discard]').forEach(b=>b.onclick=()=>{const uid=Number(b.dataset.discard);run.cargo=run.cargo.filter(i=>i.uid!==uid);if(run.safeId===uid)run.safeId=null;renderBag();updateWorkshop();save();});
    }else{
      $('bag-list').innerHTML=bank.unlocked.map(id=>'<div class="bag-item"><div class="bag-icon">'+M[id].symbol+'</div><div class="item-copy"><strong>'+M[id].name+' ×'+(bank.modules[id]||0)+'</strong><small>'+M[id].cost+' 材料 / 件</small></div><button data-craft="'+id+'" '+(bank.scrap<M[id].cost?'disabled':'')+'>制作</button></div>').join('');
      $('bag-list').querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>{const id=b.dataset.craft;if(bank.scrap<M[id].cost)return;bank.scrap-=M[id].cost;bank.modules[id]=(bank.modules[id]||0)+1;renderBag();updateWorkshop();save();beep(550);});
    }
  }
  function setTab(value){tab=value;show('gun-panel',value==='gun');show('bag-panel',value==='bag');for(const id of ['gun','bag']){$(id+'-tab').classList.toggle('selected',value===id);$(id+'-tab').setAttribute('aria-selected',String(value===id));}if(value==='bag')renderBag();}
  function renderMap(){const w=world()||camp;$('minimap').innerHTML=E.ROOM_NAMES.map((n,i)=>'<div class="map-room '+(w.rooms[i].visited?'visited ':'')+(w.room===i?'current':'')+'"><span>'+esc(n)+'</span><b>'+(i===0||i===8?'↗':w.room===i?'●':w.rooms[i].cleared?'·':'')+'</b></div>').join('');}
  function updateUI(){
    const w=world(),active=!!w;show('camp-overlay',mode==='camp');show('game-hud',active);show('pause-overlay',active&&w.paused);
    show('context-prompt',mode==='run'&&!run.paused&&!!lastContext);
    $('quick-action').textContent=mode==='camp'?'开始回收 ↗':mode==='test'?'结束试射 ■':run.paused?'继续回收 ▷':'搜索 / 撤离 E';
    $('touch-controls').classList.toggle('touch-active',active&&!w.paused);
    const near=active?nearestContext(w):null;$('touch-interact').classList.toggle('ready',!!near);
    $('touch-interact').innerHTML='<strong>'+(w?.action?Math.ceil(w.action.duration-w.action.progress):near?.kind==='extract'?'↗':'E')+'</strong><span>'+(w?.action?w.action.kind==='extract'?'撤离中':'搜索中':near?.kind==='extract'?'撤离':near?'搜索':'交互')+'</span>';
    $('pause-btn').disabled=!active;$('pause-btn').innerHTML=active&&w.paused?'▷<span>继续</span>':'Ⅱ<span>暂停</span>';
    $('zone-name').textContent=mode==='camp'?'回收站 · 出发准备':mode==='test'?'试射场 · 模块验证':E.ROOM_NAMES[run.room]+' · 回收中';
    $('shift-label').textContent=mode==='camp'?'回收员已就位':mode==='test'?'试射不会消耗库存':run.paused?'作业暂时挂起':'第 '+String(bank.runs+1).padStart(2,'0')+' 次回收作业';
    $('run-clock').textContent=timeText(w?.time||0);$('test-btn').textContent=mode==='test'?'■ 结束试射':'◎ 免费试射';$('test-btn').classList.toggle('testing',mode==='test');
    show('deploy-btn',!run&&mode!=='test');show('interact-btn',mode==='run');show('abandon-btn',!!run);
    $('mission-title').textContent=run?'本局战利品 '+run.cargo.length+'/6 · 已击退 '+run.kills+' 名敌人':'回收委托：带回第一件战利品';
    $('mission-copy').textContent=run?'入口与货运升降机均可撤离':'推荐时长 4–7 分钟 · 全程可暂停';
    $('auto-btn').innerHTML='自动射击 <i class="switch-on '+(auto?'':'off')+'"></i>';
    $('sound-btn').innerHTML='♪<span>声音'+(sound?'开':'关')+'</span>';$('sound-btn').setAttribute('aria-label',sound?'关闭声音':'开启声音');
    if(w){const p=w.player;$('hp-label').textContent=Math.max(0,Math.ceil(p.hp));$('hp-fill').style.width=Math.max(0,p.hp)+'%';$('energy-label').textContent=Math.floor(p.energy);$('energy-fill').style.width=(p.energy/C[w.chassis].energy*100)+'%';$('heat-label').textContent=Math.ceil(p.heat);$('heat-fill').style.width=p.heat+'%';$('alert-label').textContent='警戒 '+Math.min(5,Math.floor(w.alarm/20));}
    renderMap();
  }
  function pause(value,reason='pause'){
    const w=world();if(!w)return;w.paused=value;keys.clear();rightDown=false;w.target=null;
    if(!value)document.querySelector('.workbench').classList.remove('mobile-open');
    resetPad();
    $('pause-title').textContent=reason==='edit'?'改装时间':reason==='blur'?'先忙，回来再说。':'作业已暂停';
    $('pause-copy').textContent=reason==='edit'?'在右侧调整模块。敌人已暂停。':'敌人和倒计时都在等你。';
    updateWorkshop();updateUI();save();
  }
  function start(){if(run||mode==='test')return;const ready=E.compile(draft,chassis);if(!ready.ok){toast(ready.error);return;}if(!E.canEquip(draft,bank.modules)){toast('库存不足，请调整模块。');return;}
    document.querySelector('.workbench').classList.remove('mobile-open');
    for(const [id,n]of Object.entries(E.counts(draft)))bank.modules[id]-=n;
    run=E.makeRun(Date.now()>>>0,chassis,draft);mode='run';particles=[];beams=[];logs=[];lastContext='';log('进入装卸区。搜索左下方补给箱，试着带回第一件战利品。');setTab('gun');updateWorkshop();renderBag();updateUI();save();beep(600,.1);$('game-frame').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function toggleTest(){
    document.querySelector('.workbench').classList.remove('mobile-open');
    if(mode==='test'){testRun=null;mode=run?'run':'camp';particles=[];beams=[];toast('试射结束，装配方案已保留。');}
    else{if(!compiled.ok){toast(compiled.error);return;}if(run)pause(true,'edit');testRun=E.makeRun(1,currentChassis(),currentLoadout(),true);testRun.player.x=150;mode='test';particles=[];beams=[];toast('试射场：自动射击木桩，或按住右键指定方向。');}
    updateWorkshop();updateUI();$('game-frame').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function finish(success,abandoned=false){
    if(!run||run.settled)return;const old=run;const items=E.settle(bank,old,success),loot=old.cargo.slice();
    $('result-kicker').textContent=success?'EXTRACTION COMPLETE':'SIGNAL LOST';$('result-title').textContent=success?'这一趟，值了。':abandoned?'本次作业结束':'怪枪还会有的。';
    $('result-copy').textContent=success?'用时 '+timeText(old.time)+'，击退 '+old.kills+' 名敌人。出战模块和 '+loot.length+' 件战利品已入库。'+(loot.length?'获得 20 份作业补贴。':'带回战利品可领取作业补贴。'):timeText(old.time)+' 的探索结束。'+(items.length?'保险模块已送回仓库。':'未保险物品已遗失。')+'基础弹体已补发，可以重新出发。';
    $('result-loot').innerHTML=(success?loot:items).map(i=>'<span>'+(i.kind==='module'?M[i.id].name:i.value+' 材料')+'</span>').join('')||(success?'<span>出战装备全部收回</span>':'<span>基础弹体 ×1 可用</span>');
    run=null;mode='camp';testRun=null;draft=success&&E.canEquip(old.loadout,bank.modules)?old.loadout.slice():['slug','','','','',''];chassis=old.chassis;particles=[];beams=[];keys.clear();rightDown=false;lastContext='';
    log(success?'安全入库。新带回的模块已解锁制作蓝图。':'作业结束。重新组装，下一趟再带回来。');updateWorkshop();renderBag();updateUI();save();$('abandon-dialog').close();$('result-dialog').showModal();beep(success?740:150,.25);
  }
  function nearestContext(w){
    if(!w||w.training)return null;const p=w.player,room=w.rooms[w.room];
    const chest=room.chests.find(c=>!c.opened&&Math.hypot(c.x-p.x,c.y-p.y)<65);if(chest)return{kind:'search',chest};
    const exit=w.room===0?{x:105,y:445}:w.room===8?{x:835,y:450}:null;
    if(exit&&Math.hypot(exit.x-p.x,exit.y-p.y)<65)return{kind:'extract',exit};return null;
  }
  function interact(){
    const w=world();if(!w||w.training)return;if(w.paused){toast('先继续作业，再进行交互。');return;}
    const target=nearestContext(w);if(!target){toast('靠近补给箱或带斜箭头的撤离区，再按 E。');return;}
    if(target.kind==='search'&&w.cargo.length>=6){toast('背包已满：先改装、丢弃物品，或直接撤离。');return;}
    if(!w.action){w.action={kind:target.kind,x:w.player.x,y:w.player.y,progress:0,duration:target.kind==='extract'?5:1.4,chestIndex:target.chest?w.rooms[w.room].chests.indexOf(target.chest):-1};w.target=null;beep(420);}
  }
  function burst(x,y,color,count=9){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=20+Math.random()*95;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.25+Math.random()*.35,max:.6,color,size:2+Math.random()*2});}if(particles.length>220)particles.splice(0,particles.length-220);}
  function hitPlayer(w,damage){const p=w.player;if(p.invulnerable>0||w.training)return;p.hp-=damage;p.invulnerable=.6;burst(p.x,p.y,'#e8a286',8);w.action=null;beep(100,.08,'sawtooth',.035);if(p.hp<=0)finish(false);}
  function hitEnemy(w,enemy,damage,b){if(enemy.hp<=0)return;const facing=Math.atan2(w.player.y-enemy.y,w.player.x-enemy.x);let amount=damage;
    if(enemy.kind==='shield'&&!b?.mods?.includes('pierce')&&b?.kind!=='drill'){const source=Math.atan2((b?.y??w.player.y)-enemy.y,(b?.x??w.player.x)-enemy.x);if(Math.cos(source-facing)>.2)amount*=.4;}
    enemy.hp-=amount;if(b?.mods?.includes('fire'))enemy.burn=2.5;if(b?.mods?.includes('frost'))enemy.frost=2.5;
    burst(enemy.x,enemy.y,b?.mods?.includes('frost')?'#a5d9da':'#dfc18a',4);
    if(enemy.hp<=0){if(enemy.kind==='dummy'){enemy.hp=enemy.maxHp;beep(540,.045);return;}w.kills++;w.alarm+=.8;burst(enemy.x,enemy.y,'#b3c696',14);beep(230,.05);if(w.rooms[w.room].enemies.every(e=>e.hp<=0)){w.rooms[w.room].cleared=true;log('清空 '+w.rooms[w.room].name+'。可以安静搜刮了。');}}
  }
  function fireNode(w,node,x,y,angle,mods=[]){const m=M[node.kind];if(m.type==='mod'){fireNode(w,node.child,x,y,angle,[...mods,node.kind]);return;}if(m.type==='multi'){for(const offset of [-.19,0,.19])fireNode(w,node.child,x,y,angle+offset,mods);return;}
    w.bullets.push({x:x+Math.cos(angle)*8,y:y+Math.sin(angle)*8,px:x,py:y,vx:Math.cos(angle)*m.speed,vy:Math.sin(angle)*m.speed,angle,speed:m.speed,kind:node.kind,damage:m.damage,mods:mods.slice(),child:node.child||null,life:2.1,bounces:mods.includes('bounce')?2:0,pierce:(mods.includes('pierce')?2:0)+(node.kind==='drill'?2:0),hits:[],room:w.room});
  }
  function shoot(w,angle){const plan=E.compile(w.loadout,w.chassis);if(!plan.ok||w.cooldown>0||w.bullets.length>180)return;const index=w.shot%plan.nodes.length,cost=plan.shots[index],p=w.player;
    if(p.energy<cost.energy||p.heat+cost.heat>100)return;p.energy-=cost.energy;p.heat+=cost.heat;
    fireNode(w,plan.nodes[index],p.x+Math.cos(angle)*18,p.y+Math.sin(angle)*18,angle);w.shot=(index+1)%plan.nodes.length;w.cooldown=C[w.chassis].delay+(w.shot===0?C[w.chassis].recharge:0);w.alarm+=.12;burst(p.x+Math.cos(angle)*26,p.y+Math.sin(angle)*26,'#e9cb8c',3);beep(180+Math.random()*70,.045,'square',.012);
  }
  function explosion(w,x,y,radius,damage,selfDamage=true){burst(x,y,'#e7a16c',24);beams.push({x,y,radius,life:.3,kind:'blast'});const room=w.rooms[w.room];for(const e of room.enemies)if(e.hp>0&&Math.hypot(e.x-x,e.y-y)<radius)hitEnemy(w,e,damage,null);
    for(const o of room.obstacles)if(o.kind!=='machine'&&E.circleRect(x,y,radius,o))o.hp-=damage*2;
    for(const t of room.terrain)if(t.kind==='oil'&&E.circleRect(x,y,radius,t))ignite(w,t.x+t.w/2,t.y+t.h/2,100);
    if(selfDamage&&Math.hypot(w.player.x-x,w.player.y-y)<radius)hitPlayer(w,9);w.alarm+=1.5;
  }
  function ignite(w,x,y,radius=60){if(!w.fires.some(f=>Math.hypot(f.x-x,f.y-y)<45))w.fires.push({x,y,radius,life:5,tick:0,room:w.room});}
  function impact(w,b,enemy){
    if(b.child)fireNode(w,b.child,b.x,b.y,b.angle);
    if(b.kind==='blast')explosion(w,b.x,b.y,82,30);
    if(b.kind==='arc'&&enemy){const water=w.rooms[w.room].terrain.some(t=>t.kind==='water'&&E.circleRect(enemy.x,enemy.y,5,t));if(water){const targets=w.rooms[w.room].enemies.filter(e=>e!==enemy&&e.hp>0&&Math.hypot(e.x-enemy.x,e.y-enemy.y)<220).slice(0,3);for(const e of targets){hitEnemy(w,e,18,null);beams.push({x:enemy.x,y:enemy.y,x2:e.x,y2:e.y,life:.25,kind:'arc'});}}}
    if(b.mods.includes('fire'))for(const t of w.rooms[w.room].terrain)if(t.kind==='oil'&&E.circleRect(b.x,b.y,8,t))ignite(w,t.x+t.w/2,t.y+t.h/2,100);
  }
  function move(w,entity,dx,dy,radius=13){const obstacles=w.rooms[w.room].obstacles.filter(o=>o.hp>0);if(!obstacles.some(o=>E.circleRect(entity.x+dx,entity.y,radius,o)))entity.x+=dx;if(!obstacles.some(o=>E.circleRect(entity.x,entity.y+dy,radius,o)))entity.y+=dy;}
  function transition(w,dir){const next=E.neighbor(w.room,dir);if(next<0||w.training||w.doorCooldown>0)return false;
    w.room=next;const p=w.player;if(dir==='left')p.x=W-55;if(dir==='right')p.x=55;if(dir==='up')p.y=H-55;if(dir==='down')p.y=55;
    w.target=null;w.action=null;w.bullets=[];w.enemyBullets=[];w.doorCooldown=.6;particles=[];beams=[];w.rooms[next].visited=true;
    if(w.alarm>=40&&!w.rooms[next].alarmSpawned&&next!==0){w.rooms[next].alarmSpawned=true;w.rooms[next].enemies.push({id:w.nextId++,x:760,y:330,kind:'hunter',hp:38,maxHp:38,cool:0,burn:0,frost:0,angle:0,contact:0});}
    log('进入 '+w.rooms[next].name+'。'+(next===8?'货梯可直接撤离。':''));renderMap();save();return true;
  }
  function step(w,dt){
    if(w.paused)return;w.time+=dt;w.cooldown=Math.max(0,w.cooldown-dt);w.doorCooldown=Math.max(0,w.doorCooldown-dt);const p=w.player,frame=C[w.chassis];p.invulnerable=Math.max(0,p.invulnerable-dt);p.energy=Math.min(frame.energy,p.energy+frame.regen*dt);p.heat=Math.max(0,p.heat-frame.cool*dt);
    let dx=joystick.x+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=joystick.y+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(dx||dy)w.target=null;else if(w.target){const distance=Math.hypot(w.target.x-p.x,w.target.y-p.y);if(distance>7){dx=(w.target.x-p.x)/distance;dy=(w.target.y-p.y)/distance;}else w.target=null;}
    const magnitude=Math.hypot(dx,dy);if(magnitude){const water=w.rooms[w.room].terrain.some(t=>t.kind==='water'&&E.circleRect(p.x,p.y,3,t));move(w,p,dx/magnitude*frame.speed*dt*(water?.82:1),dy/magnitude*frame.speed*dt*(water?.82:1));}
    if(p.x<44&&Math.abs(p.y-300)<62&&transition(w,'left'))return;if(p.x>W-44&&Math.abs(p.y-300)<62&&transition(w,'right'))return;if(p.y<44&&Math.abs(p.x-480)<62&&transition(w,'up'))return;if(p.y>H-44&&Math.abs(p.x-480)<62&&transition(w,'down'))return;
    p.x=Math.max(23,Math.min(W-23,p.x));p.y=Math.max(23,Math.min(H-23,p.y));
    const room=w.rooms[w.room],living=room.enemies.filter(e=>e.hp>0),target=living.filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<590&&(!phone()||(e.x>camera.x-12&&e.x<camera.x+camera.viewWidth+12))&&!E.lineBlocked(p,e,room.obstacles)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    if(rightDown){p.angle=Math.atan2(pointer.y-p.y,pointer.x-p.x);shoot(w,p.angle);}else if(target){p.angle=Math.atan2(target.y-p.y,target.x-p.x);if(auto)shoot(w,p.angle);}else if(magnitude)p.angle=Math.atan2(dy,dx);
    for(const e of living){
      e.frost=Math.max(0,e.frost-dt);e.cool-=dt;e.contact=Math.max(0,e.contact-dt);if(e.burn>0){e.burn-=dt;hitEnemy(w,e,7*dt,{mods:[],x:p.x,y:p.y});}
      if(e.hp<=0||e.kind==='dummy')continue;const distance=Math.hypot(p.x-e.x,p.y-e.y),a=Math.atan2(p.y-e.y,p.x-e.x);e.angle=a;const speed=e.kind==='hunter'?116:e.kind==='swarm'?87:e.kind==='shield'?54:35;
      if(distance>(e.kind==='sentry'?285:25))move(w,e,Math.cos(a)*speed*dt*(e.frost>0?.4:1),Math.sin(a)*speed*dt*(e.frost>0?.4:1),e.kind==='shield'?18:12);
      e.x=Math.max(32,Math.min(W-32,e.x));e.y=Math.max(32,Math.min(H-32,e.y));
      if(e.kind==='sentry'&&distance<510&&e.cool<=0&&!E.lineBlocked(e,p,room.obstacles)){w.enemyBullets.push({x:e.x,y:e.y,vx:Math.cos(a)*210,vy:Math.sin(a)*210,life:3});e.cool=1.7;}
      if(distance<30&&e.contact<=0){hitPlayer(w,e.kind==='hunter'?9:6);e.contact=.9;if(!world())return;}
    }
    const bullets=w.bullets.slice();w.bullets=[];
    for(const b of bullets){
      if(b.life<=0)continue;b.life-=dt;b.px=b.x;b.py=b.y;
      if(b.mods.includes('homing')){const enemy=living.filter(e=>e.hp>0&&!b.hits.includes(e.id)).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];if(enemy){const desired=Math.atan2(enemy.y-b.y,enemy.x-b.x),diff=Math.atan2(Math.sin(desired-b.angle),Math.cos(desired-b.angle));b.angle+=Math.max(-3.8*dt,Math.min(3.8*dt,diff));b.vx=Math.cos(b.angle)*b.speed;b.vy=Math.sin(b.angle)*b.speed;}}
      b.x+=b.vx*dt;b.y+=b.vy*dt;let dead=false;
      const hitWall=b.x<22||b.x>W-22||b.y<22||b.y>H-22;
      const ob=room.obstacles.find(o=>o.hp>0&&E.circleRect(b.x,b.y,4,o));
      if(hitWall||ob){
        if(ob&&ob.kind!=='machine'){ob.hp-=b.kind==='drill'?80:b.damage;if(ob.kind==='tank'&&ob.hp<=0)explosion(w,ob.x+ob.w/2,ob.y+ob.h/2,105,32);}
        if(b.child||b.kind==='blast'){impact(w,b,null);dead=true;}
        else if(b.kind==='drill'&&ob&&ob.kind!=='machine'&&ob.hp<=0){burst(b.x,b.y,'#bcc89e',8);}
        else if(b.bounces>0){b.bounces--;if(hitWall){if(b.x<22||b.x>W-22)b.vx=-b.vx;if(b.y<22||b.y>H-22)b.vy=-b.vy;}else{if(b.px<=ob.x||b.px>=ob.x+ob.w)b.vx=-b.vx;else b.vy=-b.vy;}b.angle=Math.atan2(b.vy,b.vx);b.x=b.px;b.y=b.py;burst(b.x,b.y,'#d5cd99',3);}
        else dead=true;
      }
      if(!dead)for(const e of living){if(e.hp>0&&!b.hits.includes(e.id)&&Math.hypot(e.x-b.x,e.y-b.y)<(e.kind==='shield'?22:18)){b.hits.push(e.id);hitEnemy(w,e,b.damage,b);impact(w,b,e);if(b.child||b.kind==='blast'||b.pierce<=0){dead=true;break;}b.pierce--;}}
      if(!dead&&b.life>0)w.bullets.push(b);
      if(!world())return;
    }
    room.obstacles=room.obstacles.filter(o=>o.hp>0);
    w.enemyBullets=w.enemyBullets.filter(b=>{b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(Math.hypot(b.x-p.x,b.y-p.y)<17){hitPlayer(w,8);return false;}return b.life>0&&b.x>20&&b.x<W-20&&b.y>20&&b.y<H-20&&!room.obstacles.some(o=>E.circleRect(b.x,b.y,4,o));});
    for(const f of w.fires){if(f.room!==w.room)continue;f.life-=dt;f.tick-=dt;if(f.tick<=0){f.tick=.45;for(const e of living)if(e.hp>0&&Math.hypot(e.x-f.x,e.y-f.y)<f.radius)hitEnemy(w,e,6,null);if(Math.hypot(p.x-f.x,p.y-f.y)<f.radius)hitPlayer(w,4);}}
    w.fires=w.fires.filter(f=>f.life>0);if(!world())return;
    if(w.action){const a=w.action;if(Math.hypot(p.x-a.x,p.y-a.y)>24){w.action=null;toast('移动中断了操作。');}else{a.progress+=dt;if(a.progress>=a.duration){w.action=null;if(a.kind==='extract'){finish(true);return;}const chest=room.chests[a.chestIndex];if(chest&&!chest.opened&&w.cargo.length<6){chest.opened=true;w.opened++;const item=E.moduleLoot(w,chest.type);w.cargo.push(item);if(w.safeId===null&&item.kind==='module')w.safeId=item.uid;w.alarm+=chest.type==='lab'||chest.type==='security'?9:4;const label=item.kind==='module'?M[item.id].name:item.value+' 份材料';log('搜到 '+label+'。'+(item.uid===w.safeId?'已放入保险位。':''));toast('获得 '+label);beep(670,.14);renderBag();updateWorkshop();save();}}}}
    const near=nearestContext(w),text=w.action?(w.action.kind==='extract'?'撤离':'搜索')+'中 '+Math.max(0,w.action.duration-w.action.progress).toFixed(1)+' 秒 · 保持原地':near?near.kind==='extract'?'[ E ] 呼叫撤离 · 停留 5 秒':'[ E ] 搜索补给箱 · 1.4 秒':'';
    if(text!==lastContext){lastContext=text;$('context-prompt').textContent=text;show('context-prompt',!!text);}
  }
  function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
  function line(x,y,x2,y2,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
  function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  function label(text,x,y,color='#aaba91',size=12,align='left'){ctx.font=size+'px "Microsoft YaHei", monospace';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(text,x,y);}
  function drawCrate(o){
    rect(o.x+7,o.y+8,o.w,o.h,'#101a1380');rect(o.x,o.y,o.w,o.h,o.kind==='machine'?'#44584b':o.kind==='thin'?'#727354':o.kind==='tank'?'#846647':'#626c49');
    ctx.strokeStyle=o.kind==='machine'?'#829083':'#a5a476';ctx.lineWidth=2;ctx.strokeRect(o.x+2,o.y+2,o.w-4,o.h-4);
    if(o.kind==='machine'){rect(o.x+10,o.y+10,29,22,'#202f28');rect(o.x+13,o.y+13,23,13,'#9cbd8166');circle(o.x+47,o.y+17,3,'#d7b06f');for(let i=0;i<5;i++)line(o.x+58,o.y+10+i*6,o.x+o.w-10,o.y+10+i*6,'#283e30',3);}
    else if(o.kind==='tank'){for(let x=o.x+20;x<o.x+o.w;x+=32){circle(x,o.y+o.h/2,18,'#ad9870');circle(x,o.y+o.h/2,12,'#786347');line(x-8,o.y+o.h/2,x+8,o.y+o.h/2,'#cfb584',2);}}
    else if(o.kind==='thin'){for(let y=o.y+10;y<o.y+o.h;y+=22)line(o.x+2,y,o.x+o.w-2,y,'#b0ae7b',2);}
    else{line(o.x+5,o.y+5,o.x+o.w-5,o.y+o.h-5,'#8a9163',3);line(o.x+o.w-5,o.y+5,o.x+5,o.y+o.h-5,'#8a9163',3);rect(o.x+o.w/2-5,o.y,10,o.h,'#3b5039');}
    for(const [x,y]of [[o.x+5,o.y+5],[o.x+o.w-5,o.y+5],[o.x+5,o.y+o.h-5],[o.x+o.w-5,o.y+o.h-5]])rect(x-1,y-1,2,2,'#c0c7a2');
  }
  function drawRobot(p,time,player=true,kind='swarm',frozen=false){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle||0);const big=kind==='shield'?1.2:1;ctx.scale(big,big);
    ctx.fillStyle='#0b150a50';ctx.beginPath();ctx.ellipse(4,7,19,14,0,0,Math.PI*2);ctx.fill();
    if(kind==='dummy'){rect(-13,-19,26,38,'#96754e');rect(-17,-5,34,10,'#c4aa74');circle(0,0,10,'#e6cc90');circle(0,0,5,'#917047');ctx.restore();return;}
    const color=player?'#c1c89e':frozen?'#a8cccc':kind==='shield'?'#a98b67':kind==='sentry'?'#b69d72':kind==='hunter'?'#b68f70':'#9caa7e';
    const stride=Math.sin(time*11)*2;rect(-12,-18,12,7,'#3d513d');rect(-12,11,12,7,'#3d513d');rect(-12+stride,-20,7,5,color);rect(-12-stride,15,7,5,color);
    rect(-14,-12,28,24,'#4b6050');rect(-13,-13,24,23,color);rect(-6,-10,13,18,player?'#75876d':'#655f48');
    rect(3,-9,13,18,'#2a4234');rect(11,-7,4,14,player?'#e6bc74':frozen?'#c7f5f1':'#efb386');
    rect(7,10,25,7,player?'#b0b998':'#6f7956');rect(25,9,10,9,'#d6c590');rect(-9,-16,10,6,'#7c9673');
    if(kind==='shield'){rect(22,-22,7,44,'#536552');rect(27,-20,4,40,'#c1b68b');rect(23,-4,6,8,'#ead194');}
    if(kind==='sentry'){rect(-9,-8,30,16,'#647752');rect(18,-4,20,8,'#b8bd92');}
    if(kind==='hunter'){ctx.fillStyle='#e3ad81';ctx.beginPath();ctx.moveTo(-8,-16);ctx.lineTo(7,-23);ctx.lineTo(8,-10);ctx.fill();}
    ctx.restore();
  }
  function draw(time=0){
    const w=world()||camp,room=w.rooms[w.room],p=w.player,isCamp=mode==='camp';ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    camera.scale=canvas.height/H;camera.viewWidth=canvas.width/camera.scale;camera.x=Math.max(0,Math.min(Math.max(0,W-camera.viewWidth),p.x-camera.viewWidth*.42));ctx.setTransform(camera.scale,0,0,camera.scale,-camera.x*camera.scale,0);
    rect(0,0,W,H,'#303e2d');
    for(let y=24;y<H-24;y+=48)for(let x=24;x<W-24;x+=48){const seed=((x*13+y*17+w.room*71)%7);rect(x+1,y+1,46,46,['#35432f','#34422e','#364430','#33412e','#384630','#34432f','#354530'][seed]);if(seed===0){rect(x+8,y+15,8,1,'#77836315');rect(x+30,y+34,5,1,'#77836322');}}
    rect(50,57,W-100,H-114,'#1e2e1f15');
    ctx.strokeStyle='#81936a13';ctx.lineWidth=1;ctx.strokeRect(57,59,W-114,H-118);
    for(const t of room.terrain){ctx.fillStyle=t.kind==='water'?'#4e807c5e':'#222a1ed9';ctx.fillRect(t.x,t.y,t.w,t.h);ctx.strokeStyle=t.kind==='water'?'#98bcac55':'#93834e55';ctx.strokeRect(t.x,t.y,t.w,t.h);if(t.kind==='water'){for(let i=0;i<6;i++){const yy=t.y+25+i*34;line(t.x+20+Math.sin(time+i)*6,yy,t.x+t.w-20,yy,'#b4d3be24');}}else for(let i=0;i<4;i++){ctx.strokeStyle='#ae9d4d33';ctx.beginPath();ctx.ellipse(t.x+t.w*.5,t.y+t.h*.5,30+i*20,18+i*13,0,0,Math.PI*2);ctx.stroke();}}
    label(w.training?'TEST RANGE':room.name.toUpperCase(),480,345,'#c0ca9a0a',56,'center');
    for(const x of [98,862]){line(x,85,x,510,'#95a77530',2);for(let y=95;y<510;y+=26)line(x-5,y,x+5,y,'#95a77535');}
    rect(0,0,W,22,'#1c2a20');rect(0,H-22,W,22,'#1c2a20');rect(0,0,22,H,'#1c2a20');rect(W-22,0,22,H,'#1c2a20');
    line(23,24,W-23,24,'#5c7150',2);line(23,H-25,W-23,H-25,'#526648',2);line(24,24,24,H-24,'#586e4d',2);line(W-25,24,W-25,H-24,'#586e4d',2);
    const fontSize=Math.max(12,Math.min(24,11*H/(canvas.clientHeight||H)));
    if(!w.training)for(const dir of ['left','right','up','down']){const next=E.neighbor(w.room,dir);if(next<0)continue;ctx.save();
      if(dir==='left'){rect(0,238,30,124,'#445437');line(29,243,29,357,'#b9c18d',3);label('‹',45,310,'#c4c995',24,'center');}
      if(dir==='right'){rect(W-30,238,30,124,'#445437');line(W-29,243,W-29,357,'#b9c18d',3);label('›',W-45,310,'#c4c995',24,'center');}
      if(dir==='up'){rect(418,0,124,30,'#445437');line(423,29,537,29,'#b9c18d',3);label('⌃',480,55,'#c4c995',26,'center');}
      if(dir==='down'){rect(418,H-30,124,30,'#445437');line(423,H-29,537,H-29,'#b9c18d',3);label('⌄',480,H-34,'#c4c995',26,'center');}
      if(dir==='right')label(E.ROOM_NAMES[next],W-50,227,'#bfc6a2',fontSize,'right');
      if(dir==='left')label(E.ROOM_NAMES[next],50,227,'#bfc6a2',fontSize);
      if(dir==='down')label(E.ROOM_NAMES[next],480,H-66,'#bfc6a2',fontSize,'center');
      if(dir==='up')label(E.ROOM_NAMES[next],480,87,'#bfc6a2',fontSize,'center');ctx.restore();
    }
    if(!w.training&&(w.room===0||w.room===8)){
      const ex=w.room===0?105:835,ey=w.room===0?445:450;
      rect(ex-43,ey-42,86,84,'#b59b4b18');ctx.strokeStyle='#d0b97988';ctx.lineWidth=2;ctx.strokeRect(ex-43,ey-42,86,84);
      for(let i=0;i<6;i++){line(ex-40+i*15,ey-42,ex-32+i*15,ey-34,'#cab37388',3);line(ex-40+i*15,ey+34,ex-32+i*15,ey+42,'#cab37388',3);}
      label('↗',ex,ey+12,'#d9bf79',36,'center');label('撤离',ex,ey+67,'#c4bc8c',fontSize,'center');
      if(w.action?.kind==='extract'){ctx.strokeStyle='#e5d098';ctx.lineWidth=4;ctx.beginPath();ctx.arc(ex,ey,52,-Math.PI/2,-Math.PI/2+Math.PI*2*w.action.progress/w.action.duration);ctx.stroke();}
    }
    for(const o of room.obstacles)drawCrate(o);
    for(const c of room.chests){const x=c.x-22,y=c.y-15;rect(x+5,y+7,44,30,'#10201780');rect(x,y,44,30,c.opened?'#43523a':'#9b9867');ctx.strokeStyle=c.opened?'#687556':'#d4c995';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,42,28);rect(x+19,y,6,30,c.opened?'#2e422f':'#526445');rect(x+16,y+11,12,9,c.opened?'#384a33':'#dfc583');if(!c.opened){circle(c.x,c.y-25,3,'#e3c67d');label(c.type==='lab'?'实验样品':c.type==='security'?'安保物资':'补给箱',c.x,c.y+43,'#c7ceaa',fontSize,'center');}else label('已搜索',c.x,c.y+36,'#6f805f',11,'center');}
    const alive=room.enemies.filter(e=>e.hp>0);
    for(const e of alive){drawRobot(e,time,false,e.kind,e.frost>0);if(e.hp<e.maxHp||e.kind==='dummy'){rect(e.x-19,e.y-29,38,3,'#1a281e');rect(e.x-19,e.y-29,38*Math.max(0,e.hp/e.maxHp),3,e.frost>0?'#9fc9c9':'#bfa77b');}if(e.burn>0)circle(e.x+5,e.y-10,3+Math.sin(time*12),'#e3a465');}
    for(const f of w.fires.filter(f=>f.room===w.room)){ctx.fillStyle='#df9a4820';ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,Math.PI*2);ctx.fill();for(let i=0;i<12;i++){const a=i*Math.PI/6,rr=f.radius*(.35+(i%3)*.2);circle(f.x+Math.cos(a)*rr,f.y+Math.sin(a)*rr,4+Math.sin(time*8+i)*2,'#e7af6a88');}}
    if(!p.invulnerable||Math.floor(time*16)%2===0)drawRobot(p,time,true,'player');
    if(w.target){ctx.strokeStyle='#c3d29a88';ctx.lineWidth=1;ctx.beginPath();ctx.arc(w.target.x,w.target.y,8,0,Math.PI*2);ctx.stroke();line(w.target.x-12,w.target.y,w.target.x-5,w.target.y,'#c3d29a88');line(w.target.x+5,w.target.y,w.target.x+12,w.target.y,'#c3d29a88');}
    for(const b of w.bullets){const color=b.mods.includes('frost')?'#b4e8dd':b.mods.includes('fire')?'#edb17d':M[b.kind].color;line(b.x-b.vx*.018,b.y-b.vy*.018,b.x,b.y,color,b.kind==='trigger'?4:3);circle(b.x,b.y,b.kind==='trigger'?5:3,color);if(b.child){ctx.strokeStyle='#eed49699';ctx.lineWidth=1;ctx.beginPath();ctx.arc(b.x,b.y,8,0,Math.PI*2);ctx.stroke();}}
    for(const b of w.enemyBullets){line(b.x-b.vx*.03,b.y-b.vy*.03,b.x,b.y,'#b7745277',2);circle(b.x,b.y,5,'#ebad80');circle(b.x,b.y,2,'#f7d1a2');}
    for(const particle of particles){ctx.globalAlpha=Math.max(0,particle.life/.6);rect(particle.x,particle.y,particle.size,particle.size,particle.color);}ctx.globalAlpha=1;
    for(const beam of beams){ctx.globalAlpha=Math.min(1,beam.life/.25);if(beam.kind==='blast'){ctx.strokeStyle='#ebbe85';ctx.lineWidth=3;ctx.beginPath();ctx.arc(beam.x,beam.y,beam.radius*(1-beam.life/.4),0,Math.PI*2);ctx.stroke();}else{ctx.strokeStyle='#c0f2e6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(beam.x,beam.y);ctx.lineTo((beam.x+beam.x2)/2+8,(beam.y+beam.y2)/2-14);ctx.lineTo(beam.x2,beam.y2);ctx.stroke();}}ctx.globalAlpha=1;
    if(w.action?.kind==='search'){const a=w.action;rect(p.x-26,p.y-42,52,4,'#1b2c1e');rect(p.x-26,p.y-42,52*a.progress/a.duration,4,'#e5c582');}
    const shade=ctx.createRadialGradient(480,300,150,480,300,570);shade.addColorStop(0,'#111c0f00');shade.addColorStop(1,'#07120a77');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
    if(w.training){label('试射场 / 无限木桩',480,52,'#d5d8b9',fontSize,'center');label('右侧可调整模块，实时观察弹道',480,555,'#b3c49b',fontSize,'center');}
    if(isCamp){ctx.fillStyle='#decc8511';ctx.beginPath();ctx.arc(p.x,p.y,90,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c0c88b44';ctx.setLineDash([5,8]);ctx.beginPath();ctx.arc(p.x,p.y,72,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);label('回收员 / 07',p.x,p.y+110,'#cbd1a7',16,'center');}
  }
  function canvasPoint(event){const b=canvas.getBoundingClientRect();return{x:camera.x+(event.clientX-b.left)*camera.viewWidth/b.width,y:(event.clientY-b.top)*H/b.height};}
  canvas.addEventListener('pointermove',e=>{pointer=canvasPoint(e);});
  canvas.addEventListener('pointerdown',e=>{const w=world();if(!w||w.paused)return;pointer=canvasPoint(e);if(e.button===2){rightDown=true;e.preventDefault();}else if(e.button===0){w.target={x:Math.max(8,Math.min(W-8,pointer.x)),y:Math.max(8,Math.min(H-8,pointer.y))};}canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('pointerup',()=>{rightDown=false;});
  canvas.addEventListener('pointercancel',()=>{rightDown=false;});
  function editingInput(){const tag=document.activeElement?.tagName;return tag==='SELECT'||tag==='INPUT'||tag==='TEXTAREA';}
  window.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||editingInput())return;const k=e.key.toLowerCase();
    if([' ','tab','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
    if(k===' '&&!e.repeat){const w=world();if(w)pause(!w.paused);return;}
    if(k==='tab'&&!e.repeat){const w=world();if(w){pause(!w.paused,'edit');setTab('gun');}return;}
    if(k==='escape'&&!e.repeat){const w=world();if(w)pause(true);return;}
    if(k==='e'&&!e.repeat){interact();return;}if(k==='f'&&!e.repeat){auto=!auto;updateUI();save();return;}
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault();}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{if(world())pause(true,'blur');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&world())pause(true,'blur');});
  window.addEventListener('beforeunload',save);
  $('deploy-btn').onclick=start;$('test-btn').onclick=toggleTest;$('pause-btn').onclick=()=>{const w=world();if(w)pause(!w.paused);};$('resume-btn').onclick=()=>pause(false);
  $('quick-action').onclick=()=>{if(mode==='camp')start();else if(mode==='test')toggleTest();else if(run.paused)pause(false);else interact();};
  $('work-btn').onclick=()=>{if(run){pause(!run.paused,'edit');setTab('gun');}};
  $('gun-tab').onclick=()=>setTab('gun');$('bag-tab').onclick=()=>{if(run&&!run.paused)pause(true,'edit');setTab('bag');};
  $('clear-gun').onclick=()=>changeLoadout(['','','','','','']);
  $('auto-btn').onclick=()=>{auto=!auto;updateUI();save();};$('sound-btn').onclick=()=>{sound=!sound;beep(520);updateUI();save();};
  $('help-btn').onclick=()=>{if(world())pause(true);$('help-dialog').showModal();};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
  $('result-return').onclick=()=>{$('result-dialog').close();setTab('gun');};
  $('abandon-btn').onclick=()=>{if(world())pause(true);$('abandon-dialog').showModal();};$('confirm-abandon').onclick=()=>finish(false,true);
  $('interact-btn').onclick=interact;
  $('mobile-pause').onclick=()=>{const w=world();if(w)pause(!w.paused);};
  function openMobileBench(which){if(world())pause(true,'edit');setTab(which);document.querySelector('.workbench').classList.add('mobile-open');}
  $('mobile-edit').onclick=()=>openMobileBench('gun');$('mobile-bag').onclick=()=>openMobileBench('bag');
  $('bench-close').onclick=()=>{document.querySelector('.workbench').classList.remove('mobile-open');if(world())pause(false);};
  $('mobile-map').onclick=()=>{if(world())pause(true);$('route-modal-map').innerHTML=$('minimap').innerHTML;$('route-dialog').showModal();};
  $('route-return').onclick=()=>{$('route-dialog').close();if(world())pause(false);};
  $('touch-interact').onclick=interact;
  function resetPad(){joystick={x:0,y:0};padPointer=null;$('move-knob').style.transform='translate(0px,0px)';}
  function readPad(event){const b=$('move-pad').getBoundingClientRect(),x=event.clientX-b.left-b.width/2,y=event.clientY-b.top-b.height/2,d=Math.hypot(x,y),radius=30;const factor=d>radius?radius/d:1;joystick={x:d<7?0:x*factor/radius,y:d<7?0:y*factor/radius};$('move-knob').style.transform='translate('+(x*factor)+'px,'+(y*factor)+'px)';}
  $('move-pad').addEventListener('pointerdown',event=>{if(!world()||world().paused)return;event.preventDefault();padPointer=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);readPad(event);});
  $('move-pad').addEventListener('pointermove',event=>{if(event.pointerId===padPointer){event.preventDefault();readPad(event);}});
  $('move-pad').addEventListener('pointerup',resetPad);$('move-pad').addEventListener('pointercancel',resetPad);$('move-pad').addEventListener('lostpointercapture',resetPad);
  document.querySelectorAll('[data-chassis]').forEach(b=>b.onclick=()=>{if(run||mode==='test')return;chassis=b.dataset.chassis;draft=draft.map((id,i)=>i<C[chassis].slots?id:'');updateWorkshop();save();});
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const presets={simple:['slug','','','','',''],homing:['homing','trigger','triple','shard','',''],spread:['triple','bounce','shard','','','']};changeLoadout(presets[b.dataset.preset].slice());});
  function loop(now){const dt=Math.min(.035,((now-last)||16)/1000);last=now;const w=world();if(w)step(w,dt);if(!w||!w.paused){particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);beams.forEach(b=>b.life-=dt);beams=beams.filter(b=>b.life>0);}if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}uiTimer+=dt;saveTimer+=dt;if(uiTimer>.12){uiTimer=0;updateUI();}if(saveTimer>2){saveTimer=0;if(run)save();}draw(now/1000);requestAnimationFrame(loop);}
  load();updateWorkshop();renderBag();updateUI();log(run?'上次作业已恢复。继续前可以先检查装备。':'今天的目标：带一点有意思的东西回来。');requestAnimationFrame(loop);
})();
