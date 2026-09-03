/* ============ 状态 ============ */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v===null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
let split = store.get("wb_split", "4");
let checks = store.get("wb_checks", {});
let weightLogs = store.get("wb_weightlogs", {}); // {exId:[{d,w,r}]}
let bodyWeight = store.get("wb_bodyweight", []); // [{d,w}]

/* ============ 工具 ============ */
const $ = s => document.querySelector(s);
const todayStr = () => new Date().toISOString().slice(0,10);
function weekId(){
  const d = new Date(); const day = d.getDay()||7;
  d.setDate(d.getDate()-day+1); return d.toISOString().slice(0,10); // 本周一
}

/* ============ 训练计划 ============ */
function renderPlan(){
  const grid = $("#weekGrid");
  grid.innerHTML = "";
  const wk = weekId();
  PLANS[split].forEach(day=>{
    const card = document.createElement("div");
    card.className = "card day" + (day.rest ? " rest" : "");
    if(day.rest){
      card.innerHTML = `<div class="dhead"><span class="t">${day.d}</span></div><span class="muted">😌 ${day.t}</span>`;
    }else{
      let rows = "";
      day.ex.forEach(id=>{
        const e = EX[id]; const key = split+"|"+wk+"|"+day.d+"|"+id;
        const ck = !!checks[key];
        const logs = weightLogs[id];
        const last = logs && logs.length ? `<span class="wlog">上次 ${logs[logs.length-1].w}kg</span>` : "";
        rows += `<div class="exrow${ck?" done":""}">
          <input type="checkbox" data-key="${key}" ${ck?"checked":""}>
          <div class="nm" data-ex="${id}">${e.name}<small>${e.sets} · ${e.weight}</small></div>
          ${last}
          <button class="teach" data-ex="${id}">教学</button>
        </div>`;
      });
      card.innerHTML = `<div class="dhead"><span class="t">${day.d}</span><span class="muted">${day.t}</span></div>` + rows;
    }
    grid.appendChild(card);
  });
  updateBar();
}

function updateBar(){
  const wk = weekId(); let total=0, done=0;
  PLANS[split].forEach(day=>{ if(!day.rest) day.ex.forEach(id=>{ total++; if(checks[split+"|"+wk+"|"+day.d+"|"+id]) done++; }); });
  const pct = total? Math.round(done/total*100):0;
  $("#barFill").style.width = pct+"%";
  $("#barText").textContent = `${done} / ${total}（${pct}%）`;
}

$("#weekGrid").addEventListener("change", e=>{
  if(e.target.matches("input[type=checkbox]")){
    const k = e.target.dataset.key;
    if(e.target.checked) checks[k]=true; else delete checks[k];
    store.set("wb_checks", checks);
    e.target.closest(".exrow").classList.toggle("done", e.target.checked);
    updateBar();
  }
});
$("#weekGrid").addEventListener("click", e=>{
  const id = e.target.dataset.ex;
  if(id) openEx(id);
});

/* 分化切换 */
function syncSplitToggle(){
  document.querySelectorAll("#splitToggle button").forEach(b=>b.classList.toggle("on", b.dataset.split===split));
}
document.querySelectorAll("#splitToggle button").forEach(b=>{
  b.onclick = ()=>{ split = b.dataset.split; store.set("wb_split", split); syncSplitToggle(); renderPlan(); };
});

/* ============ 动作库 ============ */
let libFilter = "全部";
function renderLib(){
  const mus = ["全部","胸","背","肩","肱二头","肱三头","核心","腿 / 全身"];
  const f = $("#libFilters"); f.innerHTML = "";
  mus.forEach(m=>{
    const b = document.createElement("button");
    b.textContent = m; if(m===libFilter) b.className="on";
    b.onclick = ()=>{ libFilter=m; renderLib(); };
    f.appendChild(b);
  });
  const g = $("#libGrid"); g.innerHTML="";
  Object.entries(EX).forEach(([id,e])=>{
    if(libFilter!=="全部" && !e.muscle.includes(libFilter)) return;
    const c = document.createElement("div");
    c.className = "card excard";
    c.innerHTML = F[e.fig] + `<div class="t">${e.name}</div><div class="m">${e.muscle}</div><div class="s">${e.sets}</div>`;
    c.onclick = ()=>openEx(id);
    g.appendChild(c);
  });
}

/* ============ 弹窗 ============ */
function openEx(id){
  const e = EX[id];
  const logs = weightLogs[id]||[];
  const pr = logs.length ? Math.max(...logs.map(l=>l.w)) : null;
  $("#modalBox").innerHTML = `
    <button class="close" id="mClose">×</button>
    <h2>${e.name}</h2>
    <div style="margin-top:6px">
      <span class="tag">${e.muscle}</span><span class="tag">${e.sets}</span><span class="tag">${e.weight}</span><span class="tag">组间 ${e.rest}s</span>
      ${pr!==null?`<span class="tag" style="background:#fdf3e7;color:var(--warn)">PR ${pr}kg</span>`:""}
    </div>
    ${F[e.fig].replace("<svg",'<svg class="fig"')}
    <div class="sec"><h3>✅ 标准动作要领</h3><ol>${e.steps.map(s=>`<li>${s}</li>`).join("")}</ol></div>
    <div class="sec"><h3>⚠️ 常见错误（避坑）</h3><ul>${e.mistakes.map(s=>`<li>${s}</li>`).join("")}</ul></div>
    <div class="sec"><h3>🌬️ 呼吸与节奏</h3><p class="muted" style="font-size:14px">${e.breath}</p></div>
    <div class="sec">
      <h3>🏋️ 重量记录</h3>
      <div class="log-form">
        <input type="number" step="0.5" min="0" id="logW" placeholder="重量 kg">
        <input type="number" step="1" min="1" id="logR" placeholder="次数">
        <button id="logAdd">记录</button>
        <button id="logTimer" style="background:var(--ink)">开始 ${e.rest}s 休息</button>
      </div>
      <ul class="log-list">${logs.slice(-8).reverse().map(l=>`<li><span>${l.d}</span><span>${l.w}kg × ${l.r}次${l.w===pr?'<span class="pr-badge">PR</span>':""}</span></li>`).join("")||'<li class="muted" style="border:none">还没有记录，练完一组来记一笔</li>'}</ul>
    </div>`;
  $("#mask").classList.add("open");
  $("#mClose").onclick = closeModal;
  $("#logAdd").onclick = ()=>{
    const w = parseFloat($("#logW").value), r = parseInt($("#logR").value);
    if(isNaN(w)||isNaN(r)) return;
    (weightLogs[id] = weightLogs[id]||[]).push({d:todayStr(), w, r});
    store.set("wb_weightlogs", weightLogs);
    openEx(id); renderPlan();
  };
  $("#logTimer").onclick = ()=>{ closeModal(); openTimer(e.rest); };
}
function closeModal(){ $("#mask").classList.remove("open"); }
$("#mask").addEventListener("click", e=>{ if(e.target.id==="mask") closeModal(); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

/* ============ 休息计时器 ============ */
let timerInt = null, timerLeft = 0, timerTotal = 0;
function openTimer(sec){
  $("#timerPanel").classList.add("open");
  startTimer(sec);
}
function fmt(s){ return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); }
function startTimer(sec){
  clearInterval(timerInt);
  timerTotal = timerLeft = sec;
  $("#timerPanel").classList.remove("done");
  $("#timerDisplay").textContent = fmt(timerLeft);
  timerInt = setInterval(()=>{
    timerLeft--;
    if(timerLeft<=0){
      clearInterval(timerInt);
      $("#timerDisplay").textContent = "0:00";
      $("#timerPanel").classList.add("done");
      beep();
    }else{
      $("#timerDisplay").textContent = fmt(timerLeft);
    }
  },1000);
}
function beep(){
  try{
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    [0,0.25,0.5].forEach(t=>{
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.15;
      o.start(ctx.currentTime+t); o.stop(ctx.currentTime+t+0.18);
    });
  }catch(e){}
}
$("#timerFab").onclick = ()=>{ $("#timerPanel").classList.toggle("open"); };
document.querySelectorAll(".timer-presets button").forEach(b=>{
  b.onclick = ()=>startTimer(parseInt(b.dataset.sec));
});
$("#timerReset").onclick = ()=>{ clearInterval(timerInt); $("#timerPanel").classList.remove("open","done"); };

/* ============ 体重记录 ============ */
function renderBW(){
  const list = $("#bwList");
  const items = bodyWeight.slice(-7).reverse();
  list.innerHTML = items.map(x=>`<li><span>${x.d}</span><span>${x.w} kg</span></li>`).join("") || '<li class="muted" style="border:none">还没有记录，建议每周晨起空腹称重</li>';
  drawBWChart();
}
function drawBWChart(){
  const cv = $("#bwChart"); if(!cv) return;
  const ctx = cv.getContext("2d");
  const W = cv.width = cv.offsetWidth*2, H = cv.height = 280;
  ctx.clearRect(0,0,W,H);
  const data = bodyWeight.slice(-14);
  if(data.length<2){ ctx.fillStyle="#999"; ctx.font="24px sans-serif"; ctx.fillText("记录 2 次以上后显示趋势图", 20, H/2); return; }
  const ws = data.map(x=>x.w), min = Math.min(...ws)-0.5, max = Math.max(...ws)+0.5;
  const px = i => 40 + i*(W-80)/(data.length-1);
  const py = w => H-30 - (w-min)*(H-70)/(max-min||1);
  ctx.strokeStyle="#e8e6df"; ctx.lineWidth=1;
  for(let i=0;i<4;i++){ const y=30+i*(H-70)/3; ctx.beginPath(); ctx.moveTo(40,y); ctx.lineTo(W-40,y); ctx.stroke(); }
  ctx.strokeStyle="#2e6e4e"; ctx.lineWidth=3; ctx.beginPath();
  data.forEach((x,i)=>{ i?ctx.lineTo(px(i),py(x.w)):ctx.moveTo(px(i),py(x.w)); });
  ctx.stroke();
  ctx.fillStyle="#2e6e4e";
  data.forEach((x,i)=>{ ctx.beginPath(); ctx.arc(px(i),py(x.w),5,0,7); ctx.fill(); });
  ctx.fillStyle="#666"; ctx.font="20px sans-serif";
  ctx.fillText(max.toFixed(1)+"kg", 42, 28); ctx.fillText(min.toFixed(1)+"kg", 42, H-36);
}
$("#bwAdd").onclick = ()=>{
  const w = parseFloat($("#bwInput").value);
  if(isNaN(w)) return;
  bodyWeight.push({d:todayStr(), w});
  store.set("wb_bodyweight", bodyWeight);
  $("#bwInput").value = "";
  renderBW();
};

/* ============ 导航 ============ */
document.querySelectorAll("nav button").forEach(b=>{
  b.onclick = ()=>{
    document.querySelectorAll("nav button").forEach(x=>x.classList.remove("on"));
    b.classList.add("on");
    ["plan","lib","diet"].forEach(t=>$("#tab-"+t).style.display = t===b.dataset.tab?"":"none");
    if(b.dataset.tab==="diet") renderBW();
  };
});

/* ============ 数据备份 / 恢复 ============ */
const BACKUP_KEYS = ["wb_split","wb_checks","wb_weightlogs","wb_bodyweight"];
$("#btnExport").onclick = ()=>{
  const data = {};
  BACKUP_KEYS.forEach(k=>{ const v = localStorage.getItem(k); if(v!==null) data[k]=JSON.parse(v); });
  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "健身数据备份_" + todayStr() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
};
$("#importFile").addEventListener("change", e=>{
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      let n = 0;
      BACKUP_KEYS.forEach(k=>{ if(data[k]!==undefined){ localStorage.setItem(k, JSON.stringify(data[k])); n++; } });
      if(n===0){ alert("文件中没有可识别的训练数据"); return; }
      split = store.get("wb_split","4");
      checks = store.get("wb_checks",{});
      weightLogs = store.get("wb_weightlogs",{});
      bodyWeight = store.get("wb_bodyweight",[]);
      syncSplitToggle(); renderPlan(); renderLib(); renderBW();
      alert("恢复成功！");
    }catch(err){ alert("文件格式不正确，恢复失败"); }
  };
  reader.readAsText(f);
  e.target.value = "";
});

/* ============ 初始化 ============ */
$("#weekLabel").textContent = "本周（打卡与重量记录保存在本机浏览器）";
syncSplitToggle();
renderPlan();
renderLib();
