(()=>{'use strict';
const $=id=>document.getElementById(id),tiers=['一般','高級','稀有','英雄','傳說','神話','超越神話','唯一'],colors=['#a3a6aa','#5bbd87','#6aa8fa','#e84b50','#a46cf2','#e9bd57','#e9bd57','#38d58b'];
const clone=o=>JSON.parse(JSON.stringify(o)),base=clone(window.L2M_DATABASE);
const read=(key,fallback)=>{try{const x=JSON.parse(localStorage.getItem(key));return x??fallback}catch{return fallback}};
let db=read('l2m-db-v2',clone(base)),strictMode=false,save=read('l2m-save-v2',{inventory:{},draws:[],fusions:[],total:{class:0,spirit:0}}),type='class';
if(!save.guarantee||typeof save.guarantee!=='object')save.guarantee={};
function ensureShop(){if(!save.shop||typeof save.shop!=='object'||Array.isArray(save.shop))save.shop={};if(!Number.isSafeInteger(save.shop.diamonds)||save.shop.diamonds<0)save.shop.diamonds=0;if(!Number.isSafeInteger(save.shop.totalTWD)||save.shop.totalTWD<0)save.shop.totalTWD=0;if(!Array.isArray(save.shop.purchases))save.shop.purchases=[];if(!Number.isSafeInteger(save.shop.essence)||save.shop.essence<0)save.shop.essence=0;if(!Array.isArray(save.shop.crafts))save.shop.crafts=[];if(!Number.isSafeInteger(save.shop.arcStones)||save.shop.arcStones<0)save.shop.arcStones=0;if(!Array.isArray(save.shop.craftRewards)||save.shop.craftRewards.length!==3)save.shop.craftRewards=[0,0,0]}
ensureShop();
const shopPacks={'130':100,'440':330,'1240':930,'2040':1530,'4000':2990,'40000':25000};
function renderShop(){const el=$('shopDiamonds');if(el)el.textContent=save.shop.diamonds.toLocaleString('zh-TW');if($('shopEssence'))$('shopEssence').textContent='×'+save.shop.essence.toLocaleString('zh-TW');if(window.renderCraftShared)window.renderCraftShared()}
let pendingMaterialBoxes=null;
function materialModalClose(){const m=$('materialPurchaseModal');m.hidden=true;pendingMaterialBoxes=null}
function materialModalUpdate(){
 const boxes=pendingMaterialBoxes,unitPrice=boxes===11?1000:boxes===1?100:null;
 const raw=$('materialCount').value.trim(),quantity=Number(raw);
 const valid=raw!==''&&/^\d+$/.test(raw)&&Number.isSafeInteger(quantity)&&quantity>=1;
 const total=valid&&unitPrice!==null?quantity*unitPrice:NaN;
 const essence=valid?quantity*boxes*4:NaN;
 const safe=valid&&Number.isSafeInteger(total)&&Number.isSafeInteger(essence);
 $('materialTotalCost').textContent=safe?total.toLocaleString('zh-TW'):'—';
 $('materialTotalEssence').textContent=safe?'×'+essence.toLocaleString('zh-TW'):'—';
 $('materialRemaining').textContent=safe?(save.shop.diamonds-total).toLocaleString('zh-TW'):'—';
 const error=!safe?'請輸入有效的正整數購買次數。':total>save.shop.diamonds?'鑽石餘額不足，無法購買。':'';
 $('materialDialogError').textContent=error;
 $('materialDialogConfirm').disabled=Boolean(error);
 document.querySelectorAll('.material-quick button').forEach(b=>b.classList.toggle('chosen',b.dataset.count===raw));
 return error?null:{boxes,quantity,total,essence};
}
function buyMaterial(boxes){
 if(boxes!==11&&boxes!==1)return;
 pendingMaterialBoxes=boxes;
 $('materialDialogProduct').textContent=boxes===11?'太古氣息箱 11個（每次 1,000 鑽石）':'太古氣息箱（每次 100 鑽石）';
 $('materialCount').value='';$('materialPurchaseModal').hidden=false;
 materialModalUpdate();$('materialCount').focus();
}
function confirmMaterialPurchase(){
 const data=materialModalUpdate();if(!data)return;
 if(save.shop.diamonds<data.total)return;
 save.shop.diamonds-=data.total;save.shop.essence+=data.essence;
 save.shop.purchases.unshift({time:new Date().toISOString(),type:'material',boxes:data.boxes,quantity:data.quantity,diamonds:0,diamondsSpent:data.total,essence:data.essence,twd:0});
 save.shop.purchases=save.shop.purchases.slice(0,1000);
 persist();renderShop();materialModalClose();
 $('materialNotice').textContent=`購買成功：${data.boxes}箱組合 ×${data.quantity.toLocaleString('zh-TW')} 次，獲得創造氣息 ×${data.essence.toLocaleString('zh-TW')}，剩餘鑽石 ${save.shop.diamonds.toLocaleString('zh-TW')}。`;
}
function craftBoxes(index,qty,stones=0){
 const rates=[7,7,3.5],bonus=[3.5,3.5,1.5],limits=[27,3,6];
 if(!Number.isInteger(index)||index<0||index>2||!Number.isSafeInteger(qty)||qty<1||qty>999||!Number.isSafeInteger(stones)||stones<0||stones>limits[index])return null;
 const cost=3840*qty,stoneCost=stones*qty;
 if(save.shop.essence<cost||save.shop.arcStones<stoneCost)return null;
 const rate=Math.min(100,rates[index]+stones*bonus[index]);
 // Commit the whole batch once. Revealing a result never changes inventory.
 const results=Array.from({length:qty},()=>Math.random()*100<rate);
 const successes=results.filter(Boolean).length,failures=qty-successes;
 const refund=failures*384;
 save.shop.essence=save.shop.essence-cost+refund;
 save.shop.arcStones=save.shop.arcStones-stoneCost+failures;
 const batch={time:new Date().toISOString(),box:index+1,attempts:qty,successes,failures,results,spentEssence:cost,refundedEssence:refund,spentArcStones:stoneCost,earnedArcStones:failures,successRate:rate};
 save.shop.crafts.unshift(batch);
 save.shop.crafts=save.shop.crafts.slice(0,1000);
 save.shop.craftRewards[index]+=successes;
 persist();renderShop();return {...batch,cost,stoneCost,rate};
}
function buyShopPack(amount){
 const price=shopPacks[String(amount)],qty=Number(amount);
 if(!Number.isSafeInteger(price)||!Number.isSafeInteger(qty)||qty<=0)return;
 ensureShop();
 if(!Number.isSafeInteger(save.shop.diamonds+qty)||!Number.isSafeInteger(save.shop.totalTWD+price)){
  alert('模擬鑽石或消費總額已超出可安全儲存的範圍。');return;
 }
 save.shop.diamonds+=qty;
 save.shop.totalTWD+=price;
 save.shop.purchases.unshift({time:new Date().toISOString(),type:'diamond',diamonds:qty,twd:price});
 save.shop.purchases=save.shop.purchases.slice(0,1000);
 persist();
 renderShop();
 // Statistics may already be open; update immediately, not only on navigation.
 stats();
 const notice=$('shopNotice');
 if(notice)notice.textContent=`模擬購買成功：獲得 ${qty.toLocaleString('zh-TW')} 鑽石；累計模擬消費 TWD ${save.shop.totalTWD.toLocaleString('zh-TW')}。`;
}

if(db.version!==base.version && /^(0\.|1\.[0-5](?:-|$))/.test(String(db.version))){
 const prior=db;const oldById=new Map(prior.cards.map(c=>[c.id,c]));const newByKey=new Map(base.cards.map(c=>[c.type+'|'+c.rarity+'|'+c.name,c]));const remap=id=>{const old=oldById.get(id);return old?newByKey.get(old.type+'|'+old.rarity+'|'+old.name)?.id:null};
 const inventory={};let legacy=0;for(const [id,qty] of Object.entries(save.inventory||{})){const newId=remap(id);if(newId){inventory[newId]=(inventory[newId]||0)+qty}else{legacy+=qty}}
 save.inventory=inventory;save.draws=(save.draws||[]).map(d=>({...d,ids:(d.ids||[]).map(remap).filter(Boolean)}));save.fusions=(save.fusions||[]).map(f=>({...f,id:f.id?remap(f.id):null,materials:(f.materials||[]).map(remap).filter(Boolean)}));save.legacyCardsRemoved=legacy;
 db=clone(base);try{localStorage.setItem('l2m-db-v2',JSON.stringify(db));localStorage.setItem('l2m-save-v2',JSON.stringify(save))}catch{}
}
const persist=()=>{try{localStorage.setItem('l2m-save-v2',JSON.stringify(save))}catch(e){alert('本機儲存失敗：'+e.message)}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function validateDb(x){if(!x||x.schemaVersion!==2||!Array.isArray(x.cards)||!x.cards.length||!x.drawRates||!x.fusion)throw Error('資料庫結構錯誤');
const ids=new Set();for(const c of x.cards){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id)||!['class','spirit'].includes(c.type)||!tiers.includes(c.rarity)||typeof c.name!=='string'||!c.name.trim())throw Error('卡片欄位錯誤或ID重複');if(c.individualWeight!=null&&(!Number.isFinite(c.individualWeight)||c.individualWeight<=0))throw Error('卡片權重必須是正數');ids.add(c.id)}
for(const typ of ['class','spirit']){let sum=0;for(const r of tiers.slice(0,6)){const v=x.drawRates[typ]?.[r];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw Error('抽卡機率錯誤');sum+=v;if(v>0&&!x.cards.some(c=>c.type===typ&&c.rarity===r&&c.drawEligible!==false))throw Error(typ+' '+r+'缺少可抽卡片')}if(Math.abs(sum-100)>0.000001)throw Error(typ+' 機率總和必須100')}
for(const typ of ['class','spirit'])for(const grade of ['normal','advanced','supreme','master']){const rates=x.summonRates?.[typ]?.[grade];if(!rates)continue;let total=0;for(const r of tiers.slice(0,6)){const v=rates[r];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw Error('召喚機率無效');total+=v;if(v>0&&!x.cards.some(c=>c.type===typ&&c.rarity===r&&c.drawEligible!==false))throw Error('召喚池缺少卡片')}if(Math.abs(total-100)>0.000001)throw Error('召喚機率合計必須100%')}
for(const typ of ['class','spirit']){for(const r of tiers.slice(0,5)){const rule=x.fusion.normal?.[typ]?.[r];if(!rule||rule.materials!==(r==='傳說'?2:4)||typeof rule.successRate!=='number'||rule.successRate<0||rule.successRate>100)throw Error('一般合成規則無效')}const rule=x.fusion.transcendent?.[typ];if(!rule||rule.mythicMaterials!==1||rule.legendaryMaterials!==1||typeof rule.successRate!=='number'||rule.successRate<0||rule.successRate>100)throw Error('超越神話合成規則無效')}return true}
try{validateDb(db)}catch(e){db=clone(base);console.warn('已使用內建資料庫',e)}
function card(c,qty){const color=colors[tiers.indexOf(c.rarity)]||'#ddd',symbol=c.type==='class'?'⚔':'✦';return `<div class="card ${qty===0?'locked':''} ${c.rarity==='超越神話'?'transcendent':c.rarity==='唯一'?'unique':''}" style="--c:${color}"><div class="check">${c.sourceStatus==='user-game-capture'?'遊戲名錄':c.verified?'名稱已核對':'待確認'}</div><div class="art">${symbol}</div><strong>${esc(c.name)}</strong><small>${esc(c.rarity)}${qty===undefined?'':' · ×'+qty}</small></div>`}
function resultCard(c,label){return card(c).replace('</small></div>',` · ${esc(label)}</small></div>`)}
function pool(t,r){return db.cards.filter(c=>c.type===t&&c.rarity===r&&c.drawEligible!==false&&(!strictMode||(c.verified===true&&c.individualWeightVerified===true)))}
// 超越神話是神話階級的特殊取得分類，不在普通抽卡與一般合成升階結果中。
function normalFusionTarget(r){const next=tiers[tiers.indexOf(r)+1];return next==='超越神話'||next==='唯一'?null:next}
function choice(a){if(!a.length)throw Error('沒有可用卡片');return a[Math.floor(Math.random()*a.length)]}
function weightedChoice(a){if(!a.length)throw Error('沒有可用卡片');const weights=a.map(c=>c.individualWeight==null?1:c.individualWeight),total=weights.reduce((s,n)=>s+n,0);let n=Math.random()*total;for(let i=0;i<a.length;i++){n-=weights[i];if(n<0)return a[i]}return a[a.length-1]}
function catalogAudit(){const rows=[];for(const type of ['class','spirit'])for(const rarity of tiers){const cards=db.cards.filter(c=>c.type===type&&c.rarity===rarity),official=cards.filter(c=>c.verified&&!c.placeholder).length,demo=cards.filter(c=>!c.verified&&!c.placeholder).length,placeholders=cards.filter(c=>c.placeholder).length;rows.push({type,rarity,official,demo,placeholders,complete:false})}return rows}
function weightAudit(){const pools=[];for(const type of ['class','spirit'])for(const rarity of tiers.slice(0,6)){const a=pool(type,rarity);if(!a.length)continue;pools.push({type,rarity,count:a.length,allWeightsPresent:a.every(c=>Number.isFinite(c.individualWeight)&&c.individualWeight>0),allWeightsVerified:a.every(c=>c.individualWeightVerified===true),demoCount:a.filter(c=>!c.verified).length})}return pools}

const grades={normal:'一般召喚',advanced:'上級召喚',supreme:'最上級召喚',master:'大師召喚',testLegend:'傳說召喚（測試）',testMythic:'神話召喚（測試）'};
function testSummonTier(){return {testLegend:'傳說',testMythic:'神話'}[$('summonGrade').value]||null}
function testSummonPool(t,r){return db.cards.filter(c=>c.type===t&&c.rarity===r&&!c.placeholder&&!c.name.startsWith('示範'))}
function activeRates(){const special=testSummonTier();if(special)return Object.fromEntries(tiers.slice(0,6).map(r=>[r,r===special?100:0]));return db.summonRates?.[type]?.[$('summonGrade').value]??null}
function summonInfo(){const special=testSummonTier();if(special){const n=testSummonPool(type,special).length;$('single').disabled=$('eleven').disabled=n===0;$('summonRateInfo').textContent=`【測試專用，非官方召喚券】${type==='class'?'職業變身':'娃娃壺精'}・${special} 100%｜同階級 ${n} 張等機率隨機取得｜支援單抽與11抽，結果加入收藏與紀錄。`;return}const r=activeRates();const missing=r&&tiers.slice(0,6).filter(t=>r[t]>0&&!pool(type,t).length);$('single').disabled=$('eleven').disabled=!r||!!missing?.length;$('summonRateInfo').textContent=r?`${type==='class'?'職業':'壺精'}・${grades[$('summonGrade').value]}｜${tiers.slice(0,6).filter(t=>r[t]>0).map(t=>t+' '+r[t]+'%').join('｜')}｜來源：${db.summonRateSource?.[type]||'自訂資料'}`:'此召喚級別尚未設定機率，暫停抽卡。'}
function roll(t,rates){let v=Math.random()*100;for(const r of tiers.slice(0,6)){v-=rates[r];if(v<0)return weightedChoice(pool(t,r))}throw Error('機率表總和異常')}
function draw(n){try{const special=testSummonTier();if(special){const candidates=testSummonPool(type,special);if(!candidates.length)throw Error('此階級沒有可供測試的卡片');const a=Array.from({length:n},()=>choice(candidates));for(const c of a)save.inventory[c.id]=(save.inventory[c.id]||0)+1;save.total[type]+=n;save.draws.unshift({time:new Date().toISOString(),type,grade:$('summonGrade').value,testOnly:true,ids:a.map(c=>c.id)});save.draws=save.draws.slice(0,500);persist();$('results').innerHTML='<p class="warning">測試召喚結果（非官方召喚券）</p>'+a.map(c=>card(c,save.inventory[c.id])).join('');return}const rates=activeRates();if(strictMode&&tiers.slice(0,6).some(r=>rates?.[r]>0&&!pool(type,r).length))throw Error('嚴格模式：目前缺少已驗證個別機率的卡片，無法執行抽卡');if(!rates)throw Error('此召喚尚未設定機率');const a=Array.from({length:n},()=>roll(type,rates));for(const c of a)save.inventory[c.id]=(save.inventory[c.id]||0)+1;save.total[type]+=n;save.draws.unshift({time:new Date().toISOString(),type,grade:$('summonGrade').value,ids:a.map(c=>c.id)});save.draws=save.draws.slice(0,500);persist();$('results').innerHTML=a.map(c=>card(c,save.inventory[c.id])).join('')}catch(e){alert(e.message)}}
function tab(name){document.querySelectorAll('section.panel').forEach(e=>e.classList.toggle('hidden',e.id!==name));document.querySelectorAll('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===name));({collection:collection,fusion:fusion,craft:craft,stats:stats,settings:settings,unique:unique}[name]||(()=>{}))()}
function collection(){const list=db.cards.filter(c=>($('filterType').value==='all'||c.type===$('filterType').value)&&($('filterTier').value==='all'||c.rarity===$('filterTier').value)&&($('filterOwned').value==='all'||($('filterOwned').value==='owned'?save.inventory[c.id]>0:!save.inventory[c.id]))&&($('filterVerified').value==='all'||(c.verified?'verified':'demo')===$('filterVerified').value));const owned=db.cards.filter(c=>save.inventory[c.id]>0).length;$('collectionInfo').textContent=`已收藏 ${owned} / ${db.cards.length} 種；篩選顯示 ${list.length} 種`;$('collectionProgress').style.width=(100*owned/db.cards.length)+'%';$('collectionCards').innerHTML=list.map(c=>card(c,save.inventory[c.id]||0)).join('')||'<p>沒有符合條件的卡片</p>'}
function available(t,r){return db.cards.filter(c=>c.type===t&&c.rarity===r&&!c.placeholder&&((save.inventory[c.id]||0)>0)).concat(db.cards.filter(c=>c.type===t&&c.rarity===r&&c.placeholder&&(save.inventory[c.id]||0)>0))}
function materials(t,r){return available(t,r).flatMap(c=>Array(Math.min(save.inventory[c.id]||0,4)).fill(c))}
// Material gallery shows each owned card only once; quantity remains in inventory.
function materialGallery(t,rarities){const list=rarities.flatMap(r=>available(t,r));return list.map(c=>card(c,undefined).replace('</small></div>',` · 持有 ${save.inventory[c.id]} 張</small></div>`)).join('')||'<p>沒有可用素材。可先抽卡取得材料。</p>'}
function outputPool(t,r){return db.cards.filter(c=>c.type===t&&c.rarity===r&&!c.placeholder).concat(db.cards.filter(c=>c.type===t&&c.rarity===r&&c.placeholder))}
// 保底依「目標」階級計數：稀有→英雄、英雄→傳說、傳說→神話。
const guaranteeTargets={'稀有':'英雄','英雄':'傳說','傳說':'神話'};
const guaranteeKey=(t,r)=>t+':'+guaranteeTargets[r];
function failureCount(t,r){const n=save.guarantee?.[guaranteeKey(t,r)];return Number.isSafeInteger(n)&&n>=0?n:0}
function fusionContext(){const t=$('fusionType').value,r=$('fusionTier').value,unique=r==='唯一',trans=r==='超越神話',rule=unique?(db.fusion.unique?.[t]||{materials:3,successRate:10}):trans?db.fusion.transcendent[t]:db.fusion.normal[t][r];return {t,r,trans,unique,rule,need:trans?1:rule.materials}}
function fusion(){const {t,r,trans,unique,rule,need}=fusionContext();if(unique){const name=t==='class'?'波那伊特':'吉爾塔斯',a=materials(t,'超越神話'),ok=a.length>=3;$('fusionInfo').textContent=`超越神話 → 唯一｜目標：${name}｜材料 ${a.length}/3 張超越神話｜成功率 ${rule.successRate}%｜成功或失敗均消耗3張材料`;$('fusionMaterials').innerHTML=materialGallery(t,['超越神話']);$('fuse').disabled=$('fuseMax').disabled=!ok;$('fuse').textContent='一般合成';$('guaranteePanel').classList.add('hidden');$('batchInfo').textContent='唯一合成：一般合成1次；最大合成最多11次，每次使用3張超越神話卡。失敗不返還。';return;}const a=materials(t,trans?'神話':r),leg=trans?materials(t,'傳說'):[],ok=trans?a.length>=1&&leg.length>=1:a.length>=need;
$('fusionInfo').textContent=trans?`神話 ${a.length}/1 張＋傳說 ${leg.length}/1 張｜成功率 ${rule.successRate}%｜失敗僅消耗傳說`:`可投入 ${a.length}/${need} 張${r}｜成功率 ${rule.successRate}%｜失敗消耗素材並隨機返還1張同階卡片`;
$('fusionMaterials').innerHTML=materialGallery(t,trans?['神話','傳說']:[r]);
$('fuse').disabled=$('fuseMax').disabled=!ok;
$('fuse').textContent='一般合成';
const panel=$('guaranteePanel');panel.classList.toggle('hidden',!guaranteeTargets[r]);
if(guaranteeTargets[r]){const n=failureCount(t,r),claims=Math.floor(n/20);$('failureCounter').textContent=n+'/20';$('guaranteeAvailable').textContent=`目前可保底合成領取 ${claims} 次（${guaranteeTargets[r]}）`;$('claimGuarantee').disabled=claims<1;$('guaranteeProgress').style.width=(Math.min(20,n%20===0&&n>0?20:n%20)/20*100)+'%'}
$('batchInfo').textContent=trans?'最大合成：每次點擊最多11次；逐次消耗傳說卡，神話成功升級後停止。':'最大合成：每次點擊最多11次；材料不足則提前停止，失敗返還卡片可繼續使用。';}
function fuseOnce(){const {t,r,trans,unique,rule,need}=fusionContext();const a=materials(t,unique?'超越神話':trans?'神話':r),leg=trans?materials(t,'傳說'):[];
if(a.length<need||(trans&&!leg.length))return null;
const success=Math.random()*100<rule.successRate;let result=null,used=[],retained=null;
if(unique){used=a.slice(0,3);if(success){const options=db.cards.filter(c=>c.type===t&&c.rarity==='唯一'&&!c.placeholder);if(!options.length)throw Error('唯一階級獎勵卡不存在');result=choice(options)}}
else if(trans){const myth=a[0],legend=leg[0];used=[legend];if(!success)retained=myth;if(success){const options=outputPool(t,'超越神話');if(!options.length)throw Error('超越神話結果資料尚未設定');result=choice(options);used.push(myth)}}
else{const target=success?normalFusionTarget(r):r,options=outputPool(t,target);if(!options.length)throw Error('目標階級卡片資料尚未設定');result=choice(options);used=a.slice(0,need)}
used.forEach(c=>save.inventory[c.id]--);if(result)save.inventory[result.id]=(save.inventory[result.id]||0)+1;
if(!success&&guaranteeTargets[r]){const key=guaranteeKey(t,r);save.guarantee[key]=failureCount(t,r)+1}
save.fusions.unshift({time:new Date().toISOString(),type:t,from:r,success,id:result?.id||null,materials:used.map(c=>c.id),ruleVersion:'v1.7',mode:'normal'});save.fusions=save.fusions.slice(0,500);
return {success,result,trans,unique,retained};}
function fuse(){try{const x=fuseOnce();if(!x)return;persist();const title=x.unique?(x.success?'唯一合成成功：獲得唯一卡片':'唯一合成失敗：3張超越神話材料已消耗'):x.trans?(x.success?'超越神話成功：神話已升級，傳說已消耗':'超越神話失敗：傳說已消耗，神話保留'):(x.success?'合成成功':'合成失敗：返還隨機1張同階卡片');$('fusionResult').innerHTML=`<b>${title}</b>`+(x.result?`<div class="cards">${resultCard(x.result,'本次獲得 ×1')}</div>`:'')+(x.retained?`<p>本次保留的神話卡片（未新增）</p><div class="cards">${resultCard(x.retained,'保留 ×1次')}</div>`:'');fusion()}catch(e){alert(e.message)}}
function fuseMax(){try{const {t,r,trans,unique,need}=fusionContext();const a=materials(t,unique?'超越神話':trans?'神話':r),leg=trans?materials(t,'傳說'):[];const initial=trans?leg.length:Math.floor(a.length/need);if(!initial)return;
if(!confirm(`確定執行最多11次合成？目前素材可先執行約 ${initial} 次（返還素材可繼續使用）。`))return;
let total=0,successes=0,failures=0;const outcomes=[],LIMIT=11;
while(total<LIMIT){const x=fuseOnce();if(!x)break;total++;if(x.success)successes++;else failures++;outcomes.push({success:x.success,trans:x.trans,unique:x.unique,result:x.result,retained:x.retained});if(trans&&x.success)break;}
persist();
// Store every attempt before rendering. Pages prevent thousands of cards from freezing the browser.
window.lastFusionBatch=outcomes;
$('fusionResult').innerHTML=`<b>最大合成完成：${total}次｜成功${successes}次｜失敗${failures}次</b><p class="muted">以下列出每一次合成結果（含失敗返還）；每頁顯示50筆。</p><div id="fusionBatchPages"></div>${total===LIMIT?'<p>本批已達11次上限，可再次點擊最大合成。</p>':''}`;
renderFusionBatchPage(0);fusion();}catch(e){alert(e.message)}}
function renderFusionBatchPage(page){const all=window.lastFusionBatch||[],gained=new Map(),retained=new Map();for(const x of all){if(x.result){const v=gained.get(x.result.id)||{card:x.result,n:0};v.n++;gained.set(x.result.id,v)}if(x.retained){const v=retained.get(x.retained.id)||{card:x.retained,n:0};v.n++;retained.set(x.retained.id,v)}}const obtained=[...gained.values()].map(x=>resultCard(x.card,'本次獲得 ×'+x.n)).join('');const kept=[...retained.values()].map(x=>resultCard(x.card,'保留 ×'+x.n+'次')).join('');$('fusionBatchPages').innerHTML=`<h3>本次獲得卡片（${[...gained.values()].reduce((n,x)=>n+x.n,0)}張）</h3><div class="cards">${obtained||'<p class="muted">本批沒有獲得卡片</p>'}</div>`+(retained.size?`<h3>超越神話失敗：保留的神話材料（不是新獲得）</h3><div class="cards">${kept}</div>`:'');}
function claimGuarantee(){const {t,r}=fusionContext();if(!guaranteeTargets[r])return;const n=failureCount(t,r);if(n<20)return;const options=outputPool(t,guaranteeTargets[r]);if(!options.length){alert('此階級尚未設定可領取卡片');return}const reward=choice(options);const key=guaranteeKey(t,r);save.guarantee[key]=n-20;save.inventory[reward.id]=(save.inventory[reward.id]||0)+1;
save.fusions.unshift({time:new Date().toISOString(),type:t,from:r,success:true,id:reward.id,materials:[],ruleVersion:'v1.7',mode:'guarantee'});save.fusions=save.fusions.slice(0,500);persist();$('fusionResult').innerHTML=`<b>保底合成成功：獲得 ${esc(reward.name)}，扣除20次失敗次數</b><div class="cards">${card(reward,save.inventory[reward.id])}</div>`;fusion()}
function unique(){}
function stats(){const all=db.cards.filter(c=>save.inventory[c.id]>0).length;$('statsData').innerHTML=[['變身抽數',save.total.class],['壺精抽數',save.total.spirit],['已收集卡種',all],['測試合成次數',save.fusions.length],['目前鑽石',save.shop.diamonds],['累計模擬消費 TWD',save.shop.totalTWD],['創造氣息',save.shop.essence],['製作弧光石(神話)',save.shop.arcStones],['製作次數',save.shop.crafts.reduce((a,x)=>a+(x.attempts||0),0)],['製作成功',save.shop.crafts.reduce((a,x)=>a+(x.successes||0),0)]].map(([name,n])=>`<div class="metric">${name}<b>${Number(n)||0}</b></div>`).join('');$('history').innerHTML=save.draws.slice(0,40).map(d=>`<p>${esc(new Date(d.time).toLocaleString('zh-TW'))} · ${d.type==='class'?'變身':'壺精'} ${grades[d.grade]||'舊版召喚'}${d.testOnly?' [測試]':''} ${d.ids.length}抽 · ${d.ids.map(id=>esc(db.cards.find(c=>c.id===id)?.name||id)).join('、')}</p>`).join('')||'<p>尚無紀錄</p>'}
function settings(){const audit=catalogAudit(),weights=weightAudit();$('strictMode').checked=strictMode;$('strictInfo').textContent=strictMode?'嚴格模式已啟用：未驗證官方逐卡機率前抽卡會停用':'等權模式：使用者提供的名錄，同階級內均分；非官方逐卡機率';$('officialSources').innerHTML='<p>本版名錄來自使用者提供的遊戲截圖與文字。完整名錄請至收藏圖鑑查看；逐卡官方召喚資格及機率未獨立核實。</p>';$('catalogAudit').innerHTML='<table><thead><tr><th>類別</th><th>階級</th><th>已核對名稱</th><th>示範</th><th>占位</th><th>完整性</th></tr></thead><tbody>'+audit.map(r=>`<tr><td>${r.type==='class'?'職業':'壺精'}</td><td>${r.rarity}</td><td>${r.official}</td><td>${r.demo}</td><td>${r.placeholders}</td><td class="pending">未證實完整</td></tr>`).join('')+'</tbody></table>';$('weightStatus').textContent=`本版 ${weights.length} 個普通階級池，使用同階級等權分配；官方個別卡片機率未驗證。`;$('dbInfo').textContent=`版本 ${db.version||'未知'}｜${db.cards.length} 張｜使用者名錄 ${db.cards.filter(c=>c.sourceStatus==='user-game-capture').length} 張｜${db.source||'無來源說明'}`;$('rates').innerHTML=['class','spirit'].map(t=>`<h4>${t==='class'?'變身':'壺精'}</h4>`+Object.entries(grades).map(([g,n])=>`<p><b>${n}</b>：${tiers.slice(0,6).filter(r=>db.summonRates?.[t]?.[g]?.[r]>0).map(r=>`<span class="tag">${r} ${db.summonRates[t][g][r]}%</span>`).join(' ')}</p>`).join('')).join('')}
function exportJSON(data,name){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
async function fileJSON(input,callback){const file=input.files?.[0];if(!file)return;try{if(file.size>4_000_000)throw Error('檔案不得超過4MB');await callback(JSON.parse(await file.text()))}catch(e){alert('匯入失敗：'+e.message)}finally{input.value=''}}
function validateSave(x){if(!x||typeof x.inventory!=='object'||Array.isArray(x.inventory)||!Array.isArray(x.draws)||!Array.isArray(x.fusions)||!x.total||!Number.isSafeInteger(x.total.class)||!Number.isSafeInteger(x.total.spirit))throw Error('進度格式錯誤');for(const [k,v] of Object.entries(x.inventory)){if(typeof k!=='string'||!Number.isSafeInteger(v)||v<0)throw Error('持有數量錯誤')}if(x.guarantee!==undefined){if(!x.guarantee||typeof x.guarantee!=='object'||Array.isArray(x.guarantee))throw Error('保底資料錯誤');for(const [k,v] of Object.entries(x.guarantee))if(!/^(class|spirit):(英雄|傳說|神話)$/.test(k)||!Number.isSafeInteger(v)||v<0)throw Error('保底計數無效')}if(x.shop!==undefined){const s=x.shop;if(!s||typeof s!=='object'||Array.isArray(s)||!Number.isSafeInteger(s.diamonds)||s.diamonds<0||!Number.isSafeInteger(s.totalTWD)||s.totalTWD<0||!Array.isArray(s.purchases))throw Error('商城進度格式錯誤');if(s.essence!==undefined&&(!Number.isSafeInteger(s.essence)||s.essence<0))throw Error('創造氣息數量錯誤');if(s.arcStones!==undefined&&(!Number.isSafeInteger(s.arcStones)||s.arcStones<0))throw Error('製作弧光石數量錯誤');if(s.crafts!==undefined&&!Array.isArray(s.crafts))throw Error('製作紀錄格式錯誤');for(const p of s.purchases){if(!p||!Number.isSafeInteger(p.diamonds)||p.diamonds<0||!Number.isSafeInteger(p.twd)||p.twd<0||typeof p.time!=='string')throw Error('購買紀錄格式錯誤')}}return true}
function reset(){save={inventory:{},draws:[],fusions:[],total:{class:0,spirit:0},guarantee:{},shop:{diamonds:0,totalTWD:0,essence:0,arcStones:0,purchases:[],crafts:[],craftRewards:[0,0,0]}};persist();stats();renderShop()}
document.querySelectorAll('[data-tab]').forEach(e=>e.addEventListener('click',()=>tab(e.dataset.tab)));document.querySelectorAll('[data-type]').forEach(e=>e.addEventListener('click',()=>{type=e.dataset.type;document.querySelectorAll('[data-type]').forEach(b=>b.classList.toggle('active',b.dataset.type===type));summonInfo()}));
$('summonGrade').onchange=summonInfo;summonInfo();$('single').onclick=()=>draw(1);$('eleven').onclick=()=>draw(11);$('fuse').onclick=fuse;$('fuseMax').onclick=fuseMax;$('claimGuarantee').onclick=claimGuarantee;
for(const r of tiers)$('filterTier').add(new Option(r,r));for(const r of [...tiers.slice(0,5),'超越神話','唯一'])$('fusionTier').add(new Option(r==='超越神話'?'神話＋傳說 → 超越神話':r==='唯一'?'超越神話 → 唯一':r+' → '+normalFusionTarget(r),r));

for(const id of ['filterType','filterTier','filterOwned','filterVerified'])$(id).onchange=collection;
for(const id of ['fusionType','fusionTier'])$(id).onchange=fusion;
$('strictMode').onchange=e=>{strictMode=e.target.checked;settings();summonInfo()};
$('exportAudit').onclick=()=>exportJSON({version:db.version,generatedAt:new Date().toISOString(),catalogComplete:false,rarities:catalogAudit(),individualWeights:weightAudit(),notes:'卡片名錄完整性未核實，官方總數未知；已核對名稱不等於完整官方卡池。'},'lineage2m-catalog-audit-v16.json');
$('exportSave').onclick=()=>exportJSON(save,'lineage2m-save-v22.json');$('exportDb').onclick=()=>exportJSON(db,'lineage2m-database-v13.json');
$('resetSave').onclick=()=>{if(confirm('確定刪除本機抽卡與合成紀錄？'))reset()};
$('restoreDb').onclick=()=>{if(confirm('恢復內建資料庫並清除進度？')){db=clone(base);localStorage.setItem('l2m-db-v2',JSON.stringify(db));reset();settings();summonInfo()}};
$('importDb').onchange=e=>fileJSON(e.target,x=>{validateDb(x);if(!confirm('匯入資料庫會清除進度，繼續？'))return;localStorage.setItem('l2m-db-v2',JSON.stringify(x));db=x;reset();settings();summonInfo();alert('資料庫已匯入')});
$('importSave').onchange=e=>fileJSON(e.target,x=>{validateSave(x);save=x;save.guarantee??={};ensureShop();persist();renderShop();alert('進度已匯入')});
// Delegated handler covers every diamond product, including the 40,000 pack.
document.getElementById('shopWealthPanel').addEventListener('click',event=>{
 const button=event.target.closest('button.shop-buy[data-diamonds]');
 if(!button||!event.currentTarget.contains(button))return;
 event.preventDefault();
 buyShopPack(button.dataset.diamonds);
});
document.querySelectorAll('.material-buy').forEach(button=>button.addEventListener('click',()=>buyMaterial(Number(button.dataset.boxes))));
document.querySelectorAll('.material-quick button').forEach(button=>button.addEventListener('click',()=>{$('materialCount').value=button.dataset.count;materialModalUpdate()}));
$('materialCount').addEventListener('input',materialModalUpdate);
$('materialDialogClose').addEventListener('click',materialModalClose);
$('materialDialogCancel').addEventListener('click',materialModalClose);
$('materialDialogConfirm').addEventListener('click',confirmMaterialPurchase);
$('materialPurchaseModal').addEventListener('click',e=>{if(e.target===$('materialPurchaseModal'))materialModalClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('materialPurchaseModal').hidden)materialModalClose()});

window.performCraftShared=craftBoxes;
renderShop();settings();unique();
})();

// Shared crafting UI; inventory and manufacturing are persisted by the main application.
let selectedCraft=0,craftQty=1,craftStones=0;
const craftNames=['神話技能書選擇箱','華麗神話技能書選擇箱','燦爛神話技能書選擇箱'];
const craftRates=[7,7,3.5],craftBonusRates=[3.5,3.5,1.5],craftLimits=[27,3,6];
const ce=id=>document.getElementById(id);
function ownedCraft(){try{return JSON.parse(localStorage.getItem('l2m-save-v2')||'{}').shop||{}}catch{return {}}}
function craft(){
 const shop=ownedCraft(),essence=shop.essence||0,arc=shop.arcStones||0;
 const bonus=craftStones*craftBonusRates[selectedCraft],need=craftStones*craftQty;
 ce('craftTitle').textContent=craftNames[selectedCraft];
 ce('craftRate').textContent=craftRates[selectedCraft]+'%';
 ce('craftBonus').textContent='↑'+bonus+'%';
 ce('craftBonusRight').textContent='↑'+bonus+'%';
 ce('craftQty').textContent=craftQty;
 ce('craftMaterials').textContent='持有 '+essence.toLocaleString('zh-TW')+' / 需要 '+(craftQty*3840).toLocaleString('zh-TW');
 ce('craftStoneOwned').textContent='持有 '+arc.toLocaleString('zh-TW')+' / 需要 '+need.toLocaleString('zh-TW');
 ce('craftStoneCount').textContent=craftStones+' / '+craftLimits[selectedCraft];
 ce('craftStoneHint').textContent='每顆 +'+craftBonusRates[selectedCraft]+'%，最多 '+craftLimits[selectedCraft]+' 顆；實際成功率 '+Math.min(100,craftRates[selectedCraft]+bonus)+'%。';
 ce('craftStoneReset').disabled=craftStones===0;
 ce('craftStoneMinus').disabled=craftStones===0;
 ce('craftStonePlus').disabled=craftStones>=craftLimits[selectedCraft]||(craftStones+1)*craftQty>arc;
 ce('craftStoneMax').disabled=craftStones>=Math.min(craftLimits[selectedCraft],Math.floor(arc/craftQty));
 ce('craftMake').disabled=essence<craftQty*3840||arc<need;
 ce('craftMake').textContent=ce('craftMake').disabled?'製作（材料不足）':'製作 '+craftQty+' 次';
 document.querySelectorAll('[data-craft]').forEach(b=>b.classList.toggle('active',Number(b.dataset.craft)===selectedCraft));
}
document.querySelectorAll('[data-craft]').forEach(b=>b.addEventListener('click',()=>{selectedCraft=Number(b.dataset.craft);craftQty=1;craftStones=0;ce('craftOutcome').textContent='';craft()}));
ce('craftMinus').onclick=()=>{craftQty=Math.max(1,craftQty-1);craftStones=Math.min(craftStones,Math.floor((ownedCraft().arcStones||0)/craftQty));craft()};
ce('craftPlus').onclick=()=>{craftQty=Math.min(999,craftQty+1);craftStones=Math.min(craftStones,Math.floor((ownedCraft().arcStones||0)/craftQty));craft()};
ce('craftStoneReset').onclick=()=>{craftStones=0;craft()};
ce('craftStoneMinus').onclick=()=>{craftStones=Math.max(0,craftStones-1);craft()};
ce('craftStonePlus').onclick=()=>{craftStones=Math.min(craftLimits[selectedCraft],craftStones+1);craft()};
ce('craftStoneMax').onclick=()=>{craftStones=Math.min(craftLimits[selectedCraft],Math.floor((ownedCraft().arcStones||0)/craftQty));craft()};
window.renderCraftShared=craft;
const progressOverlay=ce('craftProgressOverlay'),resultOverlay=ce('craftResultOverlay');
const resultGrid=ce('craftResultGrid'),resultSummary=ce('craftResultSummary');
let pendingBatch=null, revealed=new Set(), craftingBusy=false, animationTimer=null;
const craftStartSound=new Audio('assets/sounds/craft-start.mp3');
const craftCompleteSound=new Audio('assets/sounds/craft-complete.mp3');
const craftSuccessSound=new Audio('assets/sounds/craft-success.mp3');
const craftFailureSound=new Audio('assets/sounds/craft-failure.mp3');
craftStartSound.preload='auto';craftCompleteSound.preload='auto';
craftSuccessSound.preload='auto';craftFailureSound.preload='auto';
const FALLBACK_CRAFT_DURATION_MS=3024;
let craftAnimationToken=0;
function playCraftSound(sound){
 try{sound.pause();sound.currentTime=0;const playback=sound.play();if(playback&&typeof playback.catch==='function')playback.catch(()=>{});}
 catch(error){console.warn('音效無法播放，製作動畫仍會繼續。',error);}
}
function runCraftAnimation(result){
 const token=++craftAnimationToken;
 const progressFill=ce('craftProgressFill');
 const seconds=Number.isFinite(craftStartSound.duration)&&craftStartSound.duration>0?craftStartSound.duration:FALLBACK_CRAFT_DURATION_MS/1000;
 const durationMs=Math.round(seconds*1000);
 progressFill.style.animation='none';
 progressFill.style.setProperty('--craft-progress-duration',seconds+'s');
 // Force a fresh animation on every click, including consecutive batches.
 void progressFill.offsetWidth;
 progressFill.style.animation='';
 progressOverlay.hidden=false;
 let finished=false;
 const finish=()=>{
  if(finished||token!==craftAnimationToken)return;
  finished=true;
  clearTimeout(animationTimer);
  progressFill.removeEventListener('animationend',onAnimationEnd);
  progressOverlay.hidden=true;
  craftingBusy=false;
  playCraftSound(craftCompleteSound);
  showCraftResults(result);
  craft();
 };
 const onAnimationEnd=e=>{if(e.target===progressFill&&e.animationName==='craftLoad')finish()};
 progressFill.addEventListener('animationend',onAnimationEnd);
 // Safety fallback for suspended animations or unusual browser timing.
 animationTimer=setTimeout(finish,durationMs+180);
 playCraftSound(craftStartSound);
}
function hideCraftResult(){resultOverlay.hidden=true;pendingBatch=null;revealed.clear();resultGrid.classList.remove('craft-result-single')}
function revealCraft(index, withSound=true){
 if(!pendingBatch||revealed.has(index))return;
 revealed.add(index);
 const card=resultGrid.querySelector('[data-result-index="'+index+'"]');
 const success=pendingBatch.results[index];
 if(!card)return;
 if(withSound)playCraftSound(success?craftSuccessSound:craftFailureSound);
 card.classList.add('revealed',success?'craft-win':'craft-loss');
 card.setAttribute('aria-label',`第${index+1}次：${success?'製作成功':'製作失敗'}`);
 const name=craftNames[pendingBatch.box-1];
 card.innerHTML=success?`<span class="craft-result-order">第 ${index+1} 次</span><img src="assets/craft-chest-large.png" alt="神話技能書選擇箱"><strong>${name}</strong><b class="craft-success">製作成功</b>`:`<span class="craft-result-order">第 ${index+1} 次</span><img class="craft-essence-reward" src="assets/creation-essence.png" alt="創造氣息"><strong>創造氣息 ×384</strong><b class="craft-failure">製作失敗</b><span>返還創造氣息 ×384</span><span>獲得製作弧光石(神話) ×1</span>`;
 ce('craftRevealCount').textContent=`${revealed.size} / ${pendingBatch.attempts} 已揭曉`;
 if(revealed.size===pendingBatch.attempts){
  resultSummary.hidden=false;
  resultSummary.textContent=`本批製作 ${pendingBatch.attempts} 次｜成功 ${pendingBatch.successes} 次｜失敗 ${pendingBatch.failures} 次｜返還創造氣息 ×${pendingBatch.refundedEssence.toLocaleString('zh-TW')}｜獲得弧光石 ×${pendingBatch.failures}`;
 }
}
function showCraftResults(batch){
 pendingBatch=batch;revealed.clear();resultGrid.innerHTML='';resultSummary.hidden=true;
 resultGrid.classList.toggle('craft-result-single',batch.attempts===1);
 ce('craftRevealCount').textContent=`0 / ${batch.attempts} 已揭曉`;
 batch.results.forEach((_,i)=>{
  const card=document.createElement('button');card.type='button';card.className='craft-result-card';card.dataset.resultIndex=String(i);
  card.innerHTML=`<span class="craft-result-order">第 ${i+1} 次</span><span class="craft-mystery">✦</span><strong>點擊揭曉</strong>`;
  card.addEventListener('click',()=>revealCraft(i));resultGrid.appendChild(card);
 });
 resultOverlay.hidden=false;
}
ce('craftRevealAll').onclick=()=>{
 if(!pendingBatch)return;
 const unseen=pendingBatch.results.map((success,i)=>({success,i})).filter(({i})=>!revealed.has(i));
 if(!unseen.length)return;
 // Reveal all in one action; play a single result sound to avoid overlapping audio.
 const hasSuccess=unseen.some(x=>x.success);
 playCraftSound(hasSuccess?craftSuccessSound:craftFailureSound);
 unseen.forEach(({i})=>revealCraft(i,false));
};
ce('craftResultClose').onclick=hideCraftResult;
resultOverlay.addEventListener('click',e=>{if(e.target===resultOverlay)hideCraftResult()});
ce('craftMake').onclick=()=>{
 if(craftingBusy||!resultOverlay.hidden)return;
 const result=window.performCraftShared?.(selectedCraft,craftQty,craftStones);
 if(!result){craft();return}
 craftingBusy=true;craftStones=0;craft();ce('craftMake').disabled=true;
 ce('craftOutcome').textContent=`本次製作 ${result.attempts} 次，材料已結算。請在進度完成後點擊揭曉結果。`;
 // The fill duration follows the start sound (~3.024 s). Completion sound
 // plays exactly as the fill ends and before the click-to-reveal results.
 runCraftAnimation(result);
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!resultOverlay.hidden)hideCraftResult()});

craft();
