"""Build mockups/tracker.html — the Pagecraft tracker artifact — from PRD.md, docs/*.md and docs/07-plan.md.

Run from the project root:  python mockups/tracker-build.py
Then publish mockups/tracker.html with the Artifact tool (capabilities: {db: {}}), keeping the same URL.
Row status lives in the artifact db at rows/<id> = {status: "todo"|"doing"|"done", note, updated}.
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOCS = ["PRD.md", "docs/03-requirements.md", "docs/03-user-flows.md", "docs/04-technical-design.md",
        "docs/04-ui-mockups.md", "docs/05-architecture.md", "docs/06-data-and-api.md", "docs/07-plan.md"]
LINKS = {
    "variants": "https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo",
    "screens": "https://claude.ai/artifact/UKnMgDx9dvkEmFUrxWSLjS",
    "landing": "https://pagecraft-viraj.vercel.app",
    "repo": "https://github.com/virajdomadia/pagecraft",
}

def read(p): return (ROOT / p).read_text(encoding="utf-8")

# ── plan rows ──
rows, version, milestone = [], "", ""
for line in read("docs/07-plan.md").splitlines():
    m = re.match(r"^## (v\d) — (.+?) \(", line)
    if m: version = f"{m.group(1)} {m.group(2)}"; continue
    m = re.match(r"^### (Milestone [\d.]+) — (.+?) \(≈ ([\d.]+) h\)", line)
    if m: milestone = f"{m.group(1)} · {m.group(2)}"; continue
    m = re.match(r"^\| ([SFLAD]\d+) \| \*\*(.+?)\*\* \|(.*)\|$", line)
    if m:
        cells = [c.strip() for c in m.group(3).split("|")]
        # v1 tables carry a Who column; v2/v3 do not
        est = next((c for c in cells if re.fullmatch(r"[\d.]+ h", c)), "")
        done = cells[-1]
        rows.append({"id": m.group(1), "part": m.group(2), "version": version, "milestone": milestone, "est": est, "done": done})

docs = [{"name": p.split("/")[-1].replace(".md", ""), "path": p, "md": read(p)} for p in DOCS]

html = r'''<title>Pagecraft Tracker</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.2/marked.min.js"></script>
<style>
:root{--bg:#FFFFFF;--bg-2:#F7F7FC;--ink:#1B1B2F;--ink-2:#4A4A66;--muted:#6E6E8C;--line:#DCDAE8;--grid:#E7E5F0;--guide:#4338CA;--guide-soft:#EEF0FF;--coral:#FF6B6B;--mint:#2EC4B6;--amber:#D97706;
  --font:"Manrope",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#15152A;--bg-2:#1C1C33;--ink:#ECEBF6;--ink-2:#C2C1D6;--muted:#9494B4;--line:#2E2E4A;--grid:#242440;--guide:#8F87FF;--guide-soft:#262650}}
:root[data-theme="dark"]{--bg:#15152A;--bg-2:#1C1C33;--ink:#ECEBF6;--ink-2:#C2C1D6;--muted:#9494B4;--line:#2E2E4A;--grid:#242440;--guide:#8F87FF;--guide-soft:#262650}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font);font-size:14.5px;line-height:1.5;padding-inline:clamp(16px,3vw,40px);padding-block:0 80px}
a{color:var(--guide)}
.top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;padding-block:26px 16px;border-bottom:1px solid var(--line)}
.top h1{margin:0;font-size:clamp(22px,2.6vw,28px);font-weight:800;letter-spacing:-.02em}
.eyebrow{font-family:var(--mono);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.stats{display:flex;gap:18px;flex-wrap:wrap;font-family:var(--mono);font-size:12px;color:var(--muted)}
.stats b{color:var(--ink);font-weight:500;font-size:16px;display:block}
.tabs{display:flex;gap:6px;flex-wrap:wrap;position:sticky;top:0;z-index:20;background:var(--bg);padding-block:10px;border-bottom:1px solid var(--line)}
.tab{appearance:none;border:1px solid var(--line);background:var(--bg-2);color:var(--ink);font:600 13px/1 var(--font);padding:9px 13px;border-radius:999px;cursor:pointer}
.tab[aria-selected="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tab:focus-visible{outline:3px solid var(--mint);outline-offset:2px}
.panel{display:none;padding-top:20px}.panel.on{display:block}
.grid{background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:12px 12px}
/* plan */
.ver{margin-top:22px}
.ver h2{font-size:18px;font-weight:800;margin:0 0 4px;display:flex;align-items:baseline;gap:12px}
.ver h2 small{font-family:var(--mono);font-weight:500;font-size:11.5px;color:var(--muted)}
.ms{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--guide);margin:14px 0 6px}
.rows{display:flex;flex-direction:column;gap:6px}
.rw{display:grid;grid-template-columns:52px 1fr auto auto;gap:12px;align-items:center;border:1px solid var(--line);border-radius:4px;padding:10px 12px;background:var(--bg)}
.rw .id{font-family:var(--mono);font-size:12px;color:var(--muted)}
.rw .part{font-weight:700}
.rw .done{font-size:12.5px;color:var(--ink-2);margin-top:2px}
.rw .est{font-family:var(--mono);font-size:11.5px;color:var(--muted);white-space:nowrap}
.st{appearance:none;border:1px solid var(--line);background:var(--bg-2);color:var(--ink-2);font:500 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;border-radius:999px;cursor:pointer;display:inline-flex;gap:7px;align-items:center;min-width:96px;justify-content:center}
.st i{width:7px;height:7px;border-radius:50%;background:#B8B8CC}
.st[data-s="doing"]{border-color:var(--amber);color:var(--amber)}.st[data-s="doing"] i{background:var(--amber)}
.st[data-s="done"]{border-color:var(--mint);color:#0F8A7E;background:transparent}.st[data-s="done"] i{background:var(--mint)}
.st:disabled{cursor:default;opacity:.8}
.rw.done-row{opacity:.72}
.bar{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin:8px 0 4px}
.bar i{display:block;height:100%;background:var(--mint);width:0;transition:width .4s}
.note{font-family:var(--mono);font-size:11.5px;color:var(--muted);margin-top:10px}
/* docs */
.docnav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
.docnav button{appearance:none;border:1px solid var(--line);background:transparent;color:var(--ink-2);font:500 12px var(--mono);padding:6px 10px;border-radius:3px;cursor:pointer}
.docnav button[aria-selected="true"]{border-color:var(--guide);color:var(--guide);background:var(--guide-soft)}
.md{max-width:900px;font-size:14.5px}
.md h1{font-size:24px;letter-spacing:-.02em}.md h2{font-size:19px;margin-top:32px;padding-top:12px;border-top:1px solid var(--line)}.md h3{font-size:15.5px;margin-top:22px}
.md p,.md li{color:var(--ink-2)}.md strong{color:var(--ink)}
.md code{font-family:var(--mono);font-size:12.5px;background:var(--bg-2);border:1px solid var(--line);border-radius:3px;padding:1px 5px}
.md pre{background:var(--bg-2);border:1px solid var(--line);border-radius:4px;padding:14px;overflow-x:auto;font-size:12.5px}
.md pre code{background:none;border:0;padding:0}
.md .tbl{overflow-x:auto}.md table{border-collapse:collapse;font-size:13px;min-width:600px}.md th,.md td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}.md th{background:var(--bg-2);font-family:var(--mono);font-weight:500;font-size:11.5px;letter-spacing:.04em}
.md pre.mermaid{background:var(--bg);text-align:center}
/* mockups + project */
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{border:1px solid var(--line);border-radius:4px;padding:16px;background:var(--bg)}
.card h3{margin:0 0 6px;font-size:15px}.card p{margin:0 0 10px;color:var(--ink-2);font-size:13px}
.card .k{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.btnl{display:inline-block;font:700 12.5px var(--font);color:#fff;background:var(--guide);padding:8px 12px;border-radius:3px;text-decoration:none}
.kv{display:grid;grid-template-columns:160px 1fr;gap:8px 16px;font-size:13.5px;max-width:820px}
.kv dt{font-family:var(--mono);font-size:11.5px;color:var(--muted);padding-top:2px}.kv dd{margin:0;color:var(--ink-2)}.kv dd b{color:var(--ink)}
@media (max-width:700px){.rw{grid-template-columns:44px 1fr;grid-auto-rows:auto}.rw .est,.rw .st{grid-column:2}.kv{grid-template-columns:1fr}}
</style>
<header class="top">
  <div><div class="eyebrow">Pagecraft · project 3 of 6 · tracker</div><h1>Pagecraft tracker</h1></div>
  <div class="stats"><div><b id="st-done">0</b>rows done</div><div><b id="st-total">0</b>rows</div><div><b id="st-hours">0 h</b>planned</div><div><b id="st-step">4</b>lifecycle step</div></div>
</header>
<nav class="tabs" role="tablist"><button class="tab" role="tab" aria-selected="true" data-p="plan">Plan</button><button class="tab" role="tab" aria-selected="false" data-p="docs">Docs</button><button class="tab" role="tab" aria-selected="false" data-p="mockups">Mockups</button><button class="tab" role="tab" aria-selected="false" data-p="project">Project</button></nav>

<section class="panel on" id="p-plan"><div id="plan"></div><div class="note" id="plan-note">Click a status pill to cycle todo → doing → done. Status is shared with everyone who can open this page.</div></section>
<section class="panel" id="p-docs"><div class="docnav" id="docnav"></div><article class="md" id="doc"></article></section>
<section class="panel" id="p-mockups"><div class="cards" id="mock"></div></section>
<section class="panel" id="p-project"><dl class="kv" id="proj"></dl></section>

<script id="data" type="application/json">__DATA__</script>
<script>
(function(){
  const D = JSON.parse(document.getElementById('data').textContent);
  const rows = D.rows, docs = D.docs, L = D.links;
  const status = {};   // id → {status, updated}
  let db = null, canWrite = true;

  // ── plan ──
  const planEl = document.getElementById('plan');
  function renderPlan(){
    const byVer = {}; rows.forEach(r=>{ (byVer[r.version] ||= []).push(r); });
    planEl.innerHTML = '';
    for(const [ver, rs] of Object.entries(byVer)){
      const done = rs.filter(r=>status[r.id]?.status==='done').length;
      const hours = rs.reduce((a,r)=>a+parseFloat(r.est||0),0);
      const sec = document.createElement('div'); sec.className='ver';
      sec.innerHTML = `<h2>${ver} <small>${rs.length} rows · ≈ ${hours} h · ${done} done</small></h2><div class="bar"><i style="width:${rs.length?done/rs.length*100:0}%"></i></div>`;
      let ms = '';
      rs.forEach(r=>{
        if(r.milestone!==ms){ ms=r.milestone; const h=document.createElement('div'); h.className='ms'; h.textContent=ms; sec.appendChild(h); }
        const s = status[r.id]?.status || 'todo';
        const el = document.createElement('div'); el.className='rw'+(s==='done'?' done-row':'');
        el.innerHTML = `<span class="id">${r.id}</span><div><div class="part">${r.part}</div><div class="done">${r.done}</div></div><span class="est">${r.est||''}</span><button class="st" data-s="${s}" data-id="${r.id}" ${canWrite?'':'disabled'}><i></i>${s}</button>`;
        sec.appendChild(el);
      });
      planEl.appendChild(sec);
    }
    const total = rows.length, done = rows.filter(r=>status[r.id]?.status==='done').length;
    document.getElementById('st-done').textContent = done; document.getElementById('st-total').textContent = total;
    document.getElementById('st-hours').textContent = Math.round(rows.reduce((a,r)=>a+parseFloat(r.est||0),0)) + ' h';
  }
  planEl.addEventListener('click', async e=>{
    const b = e.target.closest('.st'); if(!b || !db || !canWrite) return;
    const id = b.dataset.id, next = {todo:'doing', doing:'done', done:'todo'}[b.dataset.s];
    b.disabled = true;
    try{ await db.doc('rows/'+id).set({status: next, updated: new Date().toISOString()}); }
    catch(err){ if(err && err.code==='invalid_argument'){ canWrite=false; document.getElementById('plan-note').textContent='Read-only for you — status can only be changed by editors.'; } }
    b.disabled = false;
  });
  renderPlan();
  (async()=>{
    db = await claude.use('db');
    if(!db){ document.getElementById('plan-note').textContent = 'Status is not available in this view.'; canWrite=false; renderPlan(); return; }
    const user = await claude.use('user'); const cw = user ? await user.can('data.write') : null; if(cw===false){ canWrite=false; document.getElementById('plan-note').textContent='Read-only for you — status can only be changed by editors.'; }
    db.collection('rows').onSnapshot(snap=>{ snap.docs.forEach(d=>{ if(d.exists) status[d.id]=d.data(); }); snap.docChanges().forEach(c=>{ if(c.type==='removed') delete status[c.doc.id]; }); renderPlan(); }, ()=>{});
  })();

  // ── docs ──
  const nav = document.getElementById('docnav'), art = document.getElementById('doc');
  const renderer = new marked.Renderer();
  renderer.code = function(code, lang){ const c = typeof code==='object' ? code.text : code; const l = typeof code==='object' ? code.lang : lang; if(l==='mermaid') return '<pre class="mermaid">'+c.replace(/</g,'&lt;')+'</pre>'; return '<pre><code>'+c.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</code></pre>'; };
  renderer.table = function(header, body){ if(typeof header==='object'){ const t=header; const h='<tr>'+t.header.map(c=>'<th>'+marked.parseInline(c.text)+'</th>').join('')+'</tr>'; const b=t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+marked.parseInline(c.text)+'</td>').join('')+'</tr>').join(''); return '<div class="tbl"><table><thead>'+h+'</thead><tbody>'+b+'</tbody></table></div>'; } return '<div class="tbl"><table><thead>'+header+'</thead><tbody>'+body+'</tbody></table></div>'; };
  function showDoc(i){ nav.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-selected', i===j)); art.innerHTML = marked.parse(docs[i].md, {renderer, gfm:true}); art.querySelectorAll('a[href^="docs/"],a[href^="../"],a[href$=".md"]').forEach(a=>{ const n=a.getAttribute('href').split('/').pop().replace('.md',''); const k=docs.findIndex(d=>d.name===n); if(k>=0){ a.href='#'; a.onclick=e=>{e.preventDefault(); showDoc(k); window.scrollTo({top:0});}; } }); if(window.mermaid){ try{ mermaid.run({nodes: art.querySelectorAll('pre.mermaid')}); }catch(e){} } }
  docs.forEach((d,i)=>{ const b=document.createElement('button'); b.textContent=d.name; b.setAttribute('aria-selected', i===0); b.onclick=()=>showDoc(i); nav.appendChild(b); });
  showDoc(0);

  // ── mockups ──
  document.getElementById('mock').innerHTML = [
    ['Direction variants · round 1', 'Four editor-chrome directions with live motion candidates. Chosen: C · Blueprint (2026-09-17).', L.variants, 'Open variants'],
    ['Screens · v1', 'All eleven v1 screens in Blueprint: landing, sign in, dashboard, template picker, editor (draw-in live), library, inspector, publish, published sites, settings, 404.', L.screens, 'Open screens'],
    ['Landing · live', 'The existing landing page, deployed on Vercel from web/ (will move to pagecraft.virajdomadia.com).', L.landing, 'Open landing'],
    ['Photos', 'CC photos from Wikimedia Commons in mockups/img/ with credits in CREDITS.md — Kaapi Corner is fictional.', L.repo + '/blob/main/mockups/img/CREDITS.md', 'Credits'],
  ].map(([t,p,u,b])=>`<div class="card"><div class="k">mockup</div><h3>${t}</h3><p>${p}</p><a class="btnl" href="${u}" target="_blank" rel="noopener">${b} ↗</a></div>`).join('');

  // ── project ──
  document.getElementById('proj').innerHTML = [
    ['Name', '<b>Pagecraft</b> · build it together · project 3 of 6, build fifth'],
    ['One-liner', 'A Framer-lite for one-page sites: pick a template, edit sections with a teammate in real time, publish to your own subdomain.'],
    ['URLs', 'pagecraft.virajdomadia.com · sites at {slug}.pagecraft.virajdomadia.com (and /s/{slug}) · api.pagecraft.virajdomadia.com'],
    ['Repo', `<a href="${L.repo}" target="_blank" rel="noopener">github.com/virajdomadia/pagecraft</a> · web/ Next.js 15 · api/ FastAPI + pycrdt`],
    ['Versions', '<b>v1 Solo studio</b> 18 h → <b>v2 Studio session</b> 14 h → <b>v3 Pro</b> 13 h → <b>v4 Your domain, your code</b> 8 h ≈ 53 h'],
    ['Engine', 'Yjs in the browser · pycrdt in FastAPI · Postgres update log + compaction · Upstash stream + SSE fan-out (v2) · server-side publish export · ISR + subdomain middleware'],
    ['Unique feature', 'v4: custom domains from the same Publish button (Vercel Domains API), export as static files or to the user's GitHub, import back — free to run; the round trip is the test'],
    ['Seed', 'Six fictional Bengaluru templates; demo site Kaapi Corner (Indiranagar café); demo logins creator + collaborator'],
    ['Direction', 'C · Blueprint — white chrome on the brand grid, dashed indigo guides, mono section ids; signature = sections draw themselves in as wireframes'],
    ['Lifecycle', 'Steps 1–7 complete (2026-09-17). Next: step 8 = milestone 1.0, after Tripsmith v3 and projects 4 and 5 (order 1 → 2 → 4 → 5 → 3 → 6)'],
    ['Rules', 'Lean setup, rich features · accounts just-in-time · one PR per row, every PR visible in the browser · tests only from 04 §12 · tracker updated per milestone'],
  ].map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join('');

  // ── tabs ──
  const tabs=[...document.querySelectorAll('.tab')];
  function show(p){ tabs.forEach(t=>t.setAttribute('aria-selected', t.dataset.p===p)); document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('on', x.id==='p-'+p)); try{localStorage.setItem('pc-tab',p)}catch(e){} }
  tabs.forEach(t=>t.onclick=()=>show(t.dataset.p));
  let start='plan'; try{ start=localStorage.getItem('pc-tab')||'plan'; }catch(e){} show(start);
})();
</script>
'''
data = json.dumps({"rows": rows, "docs": docs, "links": LINKS}, ensure_ascii=False).replace("</", "<\\/")
out = ROOT / "mockups" / "tracker.html"
out.write_text(html.replace("__DATA__", data), encoding="utf-8", newline="\n")
print(f"wrote {out} · {len(rows)} rows · {len(docs)} docs")
for r in rows: print(" ", r["id"], r["est"], r["part"][:40])
