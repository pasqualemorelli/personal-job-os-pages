const primary = [
  ["today", "Today"], ["dashboard", "Dashboard"], ["jobs", "All Jobs"],
  ["applications", "Applications"], ["cv", "CV Builder"], ["files", "Files"], ["insights", "Insights"]
];
const secondary = [["profile", "Profile"], ["settings", "Settings"]];
const state = {route:"today", summary:null, config:null, detail:null, letter:"", answers:"", answerSections:[], todayIndex:0, search:"", statusFilter:"all", filePath:"", fileArea:"output", fileList:null, cvSource:null, cvDraft:null, cvId:null, cvDirty:false, compare:false, masterCV:null, previewFocus:false};
const $ = (selector, root=document) => root.querySelector(selector);
const staticMode = Boolean(window.PERSONAL_JOB_OS_STATIC);
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[character]));
const short = value => value ? String(value).replace(/_/g," ") : "—";
const safeUrl = value => {try {const url=new URL(value); return url.protocol==="https:" ? url.href : "#"} catch {return "#"}};
const downloadUrl = (area, path) => staticMode ? "./assets/"+area+"/"+path.split("/").map(encodeURIComponent).join("/") : "/api/download?area="+encodeURIComponent(area)+"&path="+encodeURIComponent(path);
const fileUrl = path => downloadUrl("output",path.replace(/^.*\/output\//,""));
const humanDate = () => new Intl.DateTimeFormat("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date());

async function api(path, options={}) {
  if(staticMode)return window.staticApi(path,options);
  const response = await fetch(path,{headers:{"Content-Type":"application/json"},...options});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function textFile(path) {const response=await fetch(fileUrl(path)); if(!response.ok) return ""; return response.text()}
function notice(message,error=false){const node=$("#notice");node.className="notice"+(error?" error":"");node.textContent=message;clearTimeout(notice.timer);notice.timer=setTimeout(()=>node.textContent="",4200)}
async function refresh(){state.summary=await api("/api/summary")}
function routeGroup(){return state.route.startsWith("workspace/")?"today":state.route}
function navHtml(items){return items.map(([key,label])=>`<button class="nav-link" data-route="${key}" ${routeGroup()===key?"aria-current=page":""}>${label}</button>`).join("")}
function shellMeta(){
  $("#primary-nav").innerHTML=navHtml(primary);$("#secondary-nav").innerHTML=navHtml(secondary);
  $("#topbar-meta").textContent=humanDate();
  $("#side-budget").innerHTML=staticMode?`GitHub sync<strong>${esc(window.staticSync?.status?.()||"Read only")}</strong>`:`AI usage<strong>No app limit</strong>`;
}
function pageHead(title,description="",actions=""){return `<div class="page-head"><div><h1>${title}</h1>${description?`<p>${description}</p>`:""}</div>${actions?`<div class="page-actions">${actions}</div>`:""}</div>`}
function empty(title,body,action=""){return `<div class="empty"><h2>${title}</h2><p>${body}</p>${action}</div>`}
function viewStatus(job){return job.filter_decision==="REJECT"&&job.status==="FOUND"?"SCREENED_OUT":job.status}
function statusHtml(value){return `<span class="status ${esc(String(value||"").toLowerCase())}">${esc(short(value))}</span>`}
function jobLink(job,label="Open job"){return `<button class="link-button" data-route="workspace/${esc(job.id)}">${label}</button>`}

function renderToday(){
  const all=state.summary.today||[];
  const queue=all.filter(job=>!job.latest_decision);
  if(state.todayIndex>=queue.length)state.todayIndex=Math.max(0,queue.length-1);
  let content=pageHead("Today", "A small set of roles worth a closer look. Decide one at a time; every score is preliminary.", `<button class="button secondary" data-route="jobs">Browse all jobs</button>`);
  if(!queue.length) return content+empty(all.length?"You are caught up for today.":"No shortlist yet.",all.length?"Your decisions are saved. Revisit Maybe jobs in Applications or browse the full list.":"Run discovery and matching from the CLI. Jobs that pass the evidence threshold will appear here.",`<button class="button" data-route="applications">Open applications</button>`);
  const job=queue[state.todayIndex]; const analysis=job.analysis||{};const reasons=analysis.why_this_fits||[];const gaps=analysis.gaps||[];
  const score=Math.round(job.match_score||0);
  content+=`<div class="decision"><div class="decision-top"><div><div class="company">${esc(job.company)}</div><h2>${esc(job.role)}</h2><div class="job-meta"><span>${esc(job.location||"Location not stated")}</span><span>${esc(job.ats_provider||job.source||"Source unknown")}</span>${job.salary?`<span>${esc(job.salary)}</span>`:""}</div></div><div class="score"><strong>${score}/100</strong><span>preliminary fit</span><div class="score-line" style="--score:${score}%"></div></div></div><div class="decision-body"><section class="decision-panel"><h3>Why this fits</h3>${reasons.length?reasons.slice(0,4).map(reason=>`<div class="reason"><strong>${esc(reason.dimension)}</strong><span>${esc(reason.cv_evidence)} <span class="micro">· Master CV</span></span></div>`).join(""):"<p class=muted>Evidence is still being checked.</p>"}</section><section class="decision-panel"><h3>Check before applying</h3>${gaps.length?gaps.slice(0,4).map(gap=>`<div class="gap">${esc(gap)}</div>`).join(""):"<p class=muted>No specific gap captured yet. Verify the live role and work rights.</p>"}</section></div><div class="decision-actions"><div class="action-group"><button class="button secondary" data-action="decision" data-id="${job.id}" data-decision="SKIP">SKIP</button><button class="button secondary" data-action="decision" data-id="${job.id}" data-decision="MAYBE">MAYBE</button><button class="button lime" data-action="decision" data-id="${job.id}" data-decision="APPLY">APPLY</button></div><span class="decision-foot">Apply opens your preparation workspace. Submission stays manual. Keys: 1 Skip · 2 Maybe · 3 Apply.</span></div></div><div class="decision-feedback"><span>Match quality</span><button class="link-button" data-action="quick-feedback" data-id="${job.id}" data-rating="GREAT_MATCH">Great</button><button class="link-button" data-action="quick-feedback" data-id="${job.id}" data-rating="GOOD_MATCH">Good</button><button class="link-button" data-action="quick-feedback" data-id="${job.id}" data-rating="BAD_MATCH">Poor</button></div><div class="decision-nav"><button class="link-button" data-action="prev" ${state.todayIndex===0?"disabled":""}>Previous</button><span>${state.todayIndex+1} of ${queue.length}</span><button class="link-button" data-action="next" ${state.todayIndex===queue.length-1?"disabled":""}>Next</button></div>`;
  return content;
}

function renderDashboard(){
  const jobs=state.summary.jobs;const counts=state.summary.counts||{};
  const usage=state.summary.budget||{};
  const toReview=(state.summary.today||[]).filter(job=>!job.latest_decision).length;
  const prepared=jobs.filter(job=>job.cv_path&&job.validation_status==="REVIEW REQUIRED").length;
  const applied=(counts.APPLIED||0)+(counts.INTERVIEW||0)+(counts.OFFER||0);
  const interviews=(counts.INTERVIEW||0);
  const recent=jobs.filter(job=>job.match_score!=null&&job.filter_decision!=="REJECT").slice(0,5);
  return pageHead("Dashboard","Your search at a glance, with only the numbers that change your next action.",`<button class="button" data-route="today">Review today</button>`)+`<div class="metric-strip"><div class="metric"><strong>${toReview}</strong><span>Decisions waiting</span></div><div class="metric"><strong>${prepared}</strong><span>Drafts to check</span></div><div class="metric"><strong>${applied}</strong><span>Applications sent</span></div><div class="metric"><strong>${interviews}</strong><span>Interviews</span></div></div><div class="two-col"><section><h2 class="section-title">Relevant roles</h2><div class="plain-list">${recent.length?recent.map(job=>`<div class="plain-row"><div><h3>${esc(job.role)}</h3><p>${esc(job.company)} · ${esc(job.location||"Location unconfirmed")}</p></div>${jobLink(job,"Review →")}</div>`).join(""):"<p class=muted>No analysed roles yet.</p>"}</div></section><section><h2 class="section-title">Next steps</h2><div class="plain-list"><div class="plain-row"><div><h3>Check work rights</h3><p>Current visa conditions are still unverified.</p></div></div><div class="plain-row"><div><h3>Review prepared drafts</h3><p>CV and answers require a final factual check.</p></div></div><div class="plain-row"><div><h3>Keep the shortlist selective</h3><p>Roles below the threshold stay in All Jobs.</p></div></div></div></section></div><section class="usage-section"><h2 class="section-title">AI usage</h2><div class="usage-row"><div><strong>Today</strong><span>${esc(usage.daily_used||0)} ${esc(usage.unit||"credits")}</span></div><div><strong>This week</strong><span>${esc(usage.weekly_used||0)} ${esc(usage.unit||"credits")}</span></div><div><strong>Month to date</strong><span>${esc(usage.monthly_used||0)} ${esc(usage.unit||"credits")}</span></div></div><p class="micro">Job OS has no app-imposed AI usage limit. No external AI provider is connected; matching and browsing currently run locally.</p></section>`;
}

function renderJobs(){
  const filter=state.statusFilter; const term=state.search.toLowerCase();
  const jobs=state.summary.jobs.filter(job=>(filter==="all"||viewStatus(job)===filter)&&(!term||[job.company,job.role,job.location].some(value=>(value||"").toLowerCase().includes(term))));
  const rows=jobs.map(job=>`<tr><td data-label="Role"><div class="role-cell">${esc(job.role)}</div><div class="company-cell">${esc(job.company)}</div></td><td data-label="Location">${esc(job.location||"—")}</td><td data-label="Fit" class="nowrap">${job.match_score!=null?Math.round(job.match_score)+" / 100":"—"}</td><td data-label="Status">${statusHtml(viewStatus(job))}</td><td data-label="Found on">${esc(job.date_found)}</td><td data-label="Action">${jobLink(job,"Open →")}</td></tr>`).join("");
  return pageHead("All Jobs",`${state.summary.total} opportunities collected. Filter locally; browsing does not use AI credits.`)+`<div class="toolbar"><input aria-label="Search jobs" id="job-search" placeholder="Search role, company or location" value="${esc(state.search)}"><select aria-label="Filter by status" id="job-status"><option value=all>All statuses</option>${["FOUND","SCREENED_OUT","ANALYSED","PREPARED","MAYBE","SKIPPED","APPLIED","INTERVIEW","REJECTED","WITHDRAWN","OFFER","ARCHIVED"].map(value=>`<option ${filter===value?"selected":""}>${value}</option>`).join("")}</select></div>${jobs.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Role / company</th><th>Location</th><th>Fit</th><th>Status</th><th>Found</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:empty("No jobs match this view.","Try another search or status filter.")}`;
}

function renderApplications(){
  const jobs=state.summary.jobs.filter(job=>job.date_reviewed||job.date_prepared||["APPLIED","INTERVIEW","REJECTED","OFFER"].includes(job.status));
  return pageHead("Applications","Every decision and application stays visible in one place.",`<a class="button secondary" href="${staticMode?"./assets/reports/application-tracker.csv":"/api/tracker.csv"}" download="application-tracker.csv">Export CSV</a>`)+ (jobs.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>Role / company</th><th>Decision</th><th>Materials</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${jobs.map(job=>`<tr><td data-label="Role"><div class="role-cell">${esc(job.role)}</div><div class="company-cell">${esc(job.company)}</div></td><td data-label="Decision">${esc(job.latest_decision||"—")}</td><td data-label="Materials">${job.cv_path?"CV + drafts":"Not prepared"}</td><td data-label="Status">${statusHtml(job.status)}</td><td data-label="Updated">${esc(job.date_applied||job.date_reviewed||job.date_prepared||job.date_found)}</td><td data-label="Action">${jobLink(job,"Open →")}</td></tr>`).join("")}</tbody></table></div>`:empty("No applications yet.","Use Today to decide which roles deserve a full preparation workspace.",`<button class="button" data-route="today">Review today</button>`));
}

function parseAnswers(value){
  return value.split(/\n## /).slice(1).map(part=>{const line=part.indexOf("\n");return {title:part.slice(0,line).trim(),body:part.slice(line+1).trim()}}).filter(item=>item.title);
}

async function renderWorkspace(id){
  const job=await api(`/api/jobs/${id}`);state.detail=job;
  const [letter,answers,cvSource]=await Promise.all([
    job.cover_letter_path?textFile(job.cover_letter_path):Promise.resolve(""),
    job.answers_path?textFile(job.answers_path):Promise.resolve(""),
    job.cv_path?api(`/api/jobs/${id}/cv`).catch(()=>null):Promise.resolve(null)
  ]);
  state.letter=letter;state.answers=answers;state.answerSections=parseAnswers(answers);
  const analysis=job.parsed.analysis||{};const reasons=analysis.why_this_fits||[];const gaps=analysis.gaps||[];
  const folder=job.cv_path?job.cv_path.replace(/^.*\/output\//,"").replace(/\/[^/]+$/,""):"";
  const files=job.cv_path?`<a class="button" href="${fileUrl(job.cv_path)}" target="_blank" rel="noopener">Download CV</a><button class="button secondary" data-route="cv/${id}">${staticMode?"View CV":"Edit CV"}</button>${staticMode?"":`<button class="link-button" data-action="reveal" data-area="output" data-path="${esc(job.cv_path.replace(/^.*\/output\//,""))}">Reveal CV in Finder</button><button class="link-button" data-action="reveal" data-area="output" data-path="${esc(folder)}">Open folder in Finder</button>`}`:`${staticMode?"<p class=micro>Prepare materials from the Mac workspace.</p>":`<button class="button" data-action="prepare" data-id="${id}">Prepare materials</button>`}`;
  const checkLabels={cv:"CV reviewed",cover:"Cover letter reviewed",questions:"Answers completed",work_rights:"Work rights verified",salary:"Salary checked",portfolio:"Portfolio checked"};
  const checklist=Object.entries(checkLabels).map(([key,label])=>`<label class="check-row"><input type="checkbox" data-action="check" data-id="${id}" data-item="${key}" ${job.checks?.[key]?"checked":""}><span>${label}</span></label>`).join("");
  const answerHtml=state.answerSections.map((item,index)=>`<div class="answer-row"><h3>${esc(item.title)}</h3><pre class="md-preview">${esc(item.body)}</pre><button class="button small secondary" data-action="copy-answer" data-index="${index}" ${item.body.includes("[NEEDS USER INPUT]")?"disabled title=\"Complete this answer before copying\"":""}>Copy answer</button></div>`).join("");
  const description=job.parsed.description_text||"Description not available from this source.";
  const metadata=[job.location||"Location not stated",job.parsed.work_mode||"Work mode not stated",job.salary||"Salary not stated",job.match_category||"Not scored",job.ats_provider||"Source unknown"].map(item=>`<span>${esc(short(item))}</span>`).join("");
  const followup=["APPLIED","INTERVIEW","REJECTED","WITHDRAWN","OFFER"].includes(job.status)?`<div class="followup"><label for="application-status">Application status</label><select id="application-status">${["APPLIED","INTERVIEW","REJECTED","WITHDRAWN","OFFER","ARCHIVED"].map(value=>`<option ${job.status===value?"selected":""}>${value}</option>`).join("")}</select><button class="button small secondary" data-action="save-status" data-id="${id}">Update</button></div>`:"";
  return pageHead(esc(job.role),`${esc(job.company)} · ${esc(job.location||"Location not stated")}`,`<a class="button lime" href="${safeUrl(job.job_url)}" target="_blank" rel="noopener">Open application ↗</a>`)+`<div class="workspace-meta">${metadata}</div><div class="workspace"><div class="workspace-main"><section class="workspace-section"><h2>Role brief</h2><div class="job-description">${esc(description)}</div><p class="micro">Published: ${esc(job.parsed.publication_date||"Not supplied")} · <a href="${safeUrl(job.job_url)}" target="_blank" rel="noopener">Original posting</a></p></section><section class="workspace-section"><h2>Application kit</h2><p>Review the drafts against the live posting before you submit.</p><div class="inline-actions">${files}</div>${cvSource?`<div class="workspace-cv">${liveCV(cvSource.cv)}</div>`:""}${job.cover_letter_path?`<div class="inline-actions"><a class="link-button" href="${fileUrl(job.cover_letter_path)}" target="_blank" rel="noopener">Open cover letter</a><button class="link-button" data-action="reveal" data-area="output" data-path="${esc(job.cover_letter_path.replace(/^.*\/output\//,""))}">Reveal in Finder</button></div>`:""}${job.answers_path?`<a class="link-button" href="${fileUrl(job.answers_path)}" target="_blank" rel="noopener">Open answers file</a>`:""}${job.cv_path?`<div class="quality-note">${esc(job.validation_status||"REVIEW REQUIRED")}: confirm the live posting, visa conditions and every claim before use.</div>`:""}</section>${letter?`<section class="workspace-section"><h2>Cover letter draft</h2><pre class="md-preview">${esc(letter)}</pre><button class="button small secondary" data-action="copy-letter">Copy letter</button></section>`:""}${answerHtml?`<section class="workspace-section"><h2>Application answers</h2>${answerHtml}</section>`:""}</div><aside class="workspace-side"><section class="workspace-section"><h2>Why it fits</h2>${reasons.map(reason=>`<div class="reason"><strong>${esc(reason.dimension)}</strong><span>${esc(reason.cv_evidence)}</span></div>`).join("")||"<p>No sourced match reasons yet.</p>"}</section><section class="workspace-section"><h2>Check before applying</h2><ul class="issue-list">${gaps.map(gap=>`<li>${esc(gap)}</li>`).join("")||"<li>Check the live role and employer requirements.</li>"}</ul></section><section class="workspace-section"><h2>Review checklist</h2><p class="micro">Mark each item after your own check. Work rights must first be verified in Profile.</p>${checklist}</section><section class="workspace-section"><h2>Progress</h2><p>Fit score: ${Math.round(job.match_score||0)} / 100 <span class="micro">preliminary</span></p><p>Status: ${esc(short(job.status))}</p>${job.status!=="APPLIED"?`<button class="button lime" data-action="mark-applied" data-id="${id}">I applied</button>`:"<p class=success>Application recorded.</p>"}${followup}</section><section class="workspace-section"><h2>Feedback</h2><div class="field"><label for="feedback-match">Match quality</label><select id="feedback-match"><option value="">Choose a rating</option><option value="GREAT_MATCH">Great match</option><option value="GOOD_MATCH">Good match</option><option value="BAD_MATCH">Bad match</option></select></div><div class="field"><label for="feedback-material">Materials</label><select id="feedback-material"><option value="">Choose a rating</option><option value="CV_GOOD">CV good</option><option value="CV_BAD">CV needs work</option><option value="COVER_GOOD">Letter good</option><option value="COVER_BAD">Letter needs work</option><option value="ANSWERS_GOOD">Answers good</option><option value="ANSWERS_BAD">Answers need work</option></select></div><div class="field"><label for="feedback-note">Note</label><textarea id="feedback-note" placeholder="What should the system learn from this role?"></textarea></div><button class="button small secondary" data-action="save-feedback" data-id="${id}">Save feedback</button></section></aside></div>`;
}

function cvField(label,value,key,group="",index="",role=""){return `<div class="field"><label>${esc(label)}</label><textarea aria-label="${esc(label)}" data-cv-key="${key}" data-cv-group="${group}" data-cv-index="${index}" data-cv-role="${role}">${esc(value)}</textarea></div>`}
function liveCV(cv=state.compare&&state.masterCV?state.masterCV:state.cvDraft){
  if(!cv)return "";
  return `<div class="cv-sheet"><div class="cv-head"><svg class="cv-star" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 0 23 12 32 4 28 15 40 16 29 21 38 29 26 27 25 40 20 29 13 39 14 26 2 30 11 21 0 16 12 15 7 4 17 12Z" fill="currentColor"/></svg><div><strong>${esc(cv.name)}</strong><span>${esc(cv.title)}</span></div><div class="cv-contact">${cv.contact.map(item=>`<div>${esc(item)}</div>`).join("")}</div></div><div class="cv-columns"><div><h3>— About me</h3><p>${esc(cv.about)}</p><h3>— Languages</h3><p>${cv.languages.map(esc).join("<br>")}</p><h3>— University</h3>${cv.university.map(lines=>`<p>${lines.map(esc).join("<br>")}</p>`).join("")}<h3>— Postgraduate courses</h3>${cv.courses.map(lines=>`<p>${lines.map(esc).join("<br>")}</p>`).join("")}<h3>— Core skills</h3><p>${cv.skills.map(esc).join("<br>")}</p></div><div><h3>— Professional experience</h3>${cv.experience.map(section=>`<div class="cv-exp"><h4>${esc(section.company)}</h4>${section.roles.map(role=>`<div class="cv-role"><em>${esc(role.title)}</em><p>${esc(role.body)}</p></div>`).join("")}</div>`).join("")}<h3>— Teaching experience</h3>${cv.teaching.map(section=>`<div class="cv-exp"><h4>${esc(section.company)}</h4>${section.roles.map(role=>`<div class="cv-role"><em>${esc(role.title)}</em><p>${esc(role.body)}</p></div>`).join("")}</div>`).join("")}</div></div></div>`;
}
async function renderCV(id){
  const available=state.summary.jobs.filter(job=>job.cv_path);
  if(!id)id=state.cvId||available[0]?.id;
  if(!id)return pageHead("CV Builder","Edit the content of your fixed master template.")+empty("No CV draft yet.","Choose APPLY in Today or prepare materials from a job workspace to create the first editable CV.",`<button class="button" data-route="today">Review today</button>`);
  if(state.cvId!==id||!state.cvSource){state.cvSource=await api(`/api/jobs/${id}/cv`);state.cvDraft=structuredClone(state.cvSource.cv);state.cvId=id;state.cvDirty=false}
  const cv=state.cvDraft;const company=state.cvSource.company;const job=state.summary.jobs.find(item=>item.id===id);
  const selected=`<select id="cv-select" aria-label="Choose CV draft">${available.map(item=>`<option value="${item.id}" ${item.id===id?"selected":""}>${esc(item.company)} — ${esc(item.role)}</option>`).join("")}</select>`;
  if(staticMode)return pageHead("CV archive",`Published draft for ${esc(company)}. Edit and regenerate PDFs in the Mac workspace.`, `<a class="button secondary" href="${fileUrl(job.cv_path)}" target="_blank" rel="noopener">Open saved PDF</a>`)+`<div class="toolbar">${selected}</div><section class="preview-pane"><div class="preview-header"><span class="small-label">Saved content</span></div><div id="cv-live">${liveCV(cv)}</div></section>`;
  const changes=state.cvSource.tailoring?.selections||[];
  let editor=`<div class="editor-toolbar">${selected}<button class="button small" data-action="save-cv" data-id="${id}" ${state.cvDirty?"":"disabled"}>Save & export PDF</button><button class="button small secondary" data-action="restore-cv" data-id="${id}">Restore generated</button></div><p class="micro" id="cv-change-note">${state.cvDirty?"Unsaved changes":"Saved version"} · Fixed A4 template</p><div class="keyword-line">${(state.cvSource.tailoring?.targeted_keywords||[]).map(word=>`<span class="keyword">${esc(word)}</span>`).join("")}</div><div class="cv-change-list"><strong>Changes from master</strong><p>Skills reordered for this role. ${changes.length} experience section${changes.length===1?"":"s"} shortened using verified CV sentences.</p>${changes.length?`<details><summary>Show selected changes</summary><ul>${changes.map(change=>`<li>${esc(change.role)}: ${change.omitted_sentences.length} sentence${change.omitted_sentences.length===1?"":"s"} omitted.</li>`).join("")}</ul></details>`:""}</div>`;
  editor+=cvField("Professional summary",cv.about,"about");
  editor+=`<h3>Experience</h3>`;
  cv.experience.forEach((section,index)=>section.roles.forEach((role,roleIndex)=>{editor+=cvField(`${section.company} · ${role.title}`,role.body,"body","experience",index,roleIndex)+`<button class="link-button micro" data-action="regenerate-section" data-group="experience" data-index="${index}" data-role="${roleIndex}">Regenerate from verified source</button>`}));
  editor+=`<h3>Teaching</h3>`;
  cv.teaching.forEach((section,index)=>section.roles.forEach((role,roleIndex)=>{editor+=cvField(`${section.company} · ${role.title}`,role.body,"teaching",index,roleIndex)}));
  editor+=`<h3>Core skills</h3>${cvField("One skill per line",cv.skills.join("\n"),"skills")}`;
  return pageHead("CV Builder",`Editing for ${esc(company)}. Changes stay in a source JSON file and export to one A4 PDF.`, `<a class="button secondary" href="${fileUrl(job.cv_path)}" target="_blank">Open saved PDF</a>`)+`<div class="cv-layout ${state.previewFocus?"preview-focus":""}"><section class="editor"><h2>Content editor</h2>${editor}</section><section class="preview-pane"><div class="preview-header"><span class="small-label">${state.compare?"Master CV":"Live content preview"}</span><div class="inline-actions"><button class="button small secondary" data-action="compare-master">${state.compare?"Show edited":"Compare with master"}</button><button class="button small quiet" data-action="focus-preview">${state.previewFocus?"Back to editing":"Enlarge"}</button></div></div><div id="cv-live">${liveCV()}</div><p class="micro">The exported PDF follows the same fixed grid; check it after saving.</p></section></div>`;
}

async function renderFiles(){
  state.fileList=await api("/api/files?area="+encodeURIComponent(state.fileArea)+"&path="+encodeURIComponent(state.filePath));
  const path=state.fileList.path;const crumbs=[{label:state.fileArea[0].toUpperCase()+state.fileArea.slice(1),path:""}];let built="";for(const part of path.split("/").filter(Boolean)){built+=(built?"/":"")+part;crumbs.push({label:part,path:built})}
  const areas=["output","input","reports"].map(area=>`<button class="file-area ${state.fileArea===area?"active":""}" data-action="file-area" data-area="${area}" ${state.fileArea===area?"aria-current=page":""}>${area[0].toUpperCase()+area.slice(1)}</button>`).join("");
  const entries=state.fileList.entries.map(entry=>`<div class="file-entry"><div>${entry.is_dir?`<button data-action="file-folder" data-path="${esc(entry.path)}">${esc(entry.name)} /</button>`:`<a href="${downloadUrl(state.fileArea,entry.path)}" target="_blank" rel="noopener">${esc(entry.name)}</a>`}</div><div class="file-actions"><span>${entry.is_dir?"Folder":Math.round(entry.size/1024)+" KB"}</span>${staticMode?"":`<button class="link-button" data-action="reveal" data-area="${state.fileArea}" data-path="${esc(entry.path)}">Finder</button>`}</div></div>`).join("");
  return pageHead("Files","Browse generated materials, your source documents and reports without losing the file-based workflow.")+`<div class="file-areas">${areas}</div><div class="file-breadcrumb">${crumbs.map((item,index)=>`${index?" / ":""}<button class="link-button" data-action="file-folder" data-path="${esc(item.path)}">${esc(item.label)}</button>`).join("")}</div>${entries?`<div class="file-list">${entries}</div>`:empty("This folder is empty.","Prepared materials and reports will appear here automatically.")}`;
}

async function renderInsights(){
  const report=await api("/api/insights");
  const jobs=state.summary.jobs;const analysed=jobs.filter(job=>job.match_score!=null);const strong=analysed.filter(job=>job.match_score>=45&&job.filter_decision!=="REJECT");const applied=jobs.filter(job=>job.date_applied);
  const skills=report.recurring_skills.map(item=>`<div class="plain-row"><div><h3>${esc(short(item.name))}</h3><p>${item.jobs} relevant job descriptions</p></div></div>`).join("");
  const recommendations=report.recommendations.map(item=>`<div class="plain-row"><div><h3>${esc(item.title)}</h3><p>${esc(item.reason)}</p><p class="micro">${esc(item.evidence)}</p></div></div>`).join("");
  const ideas=report.linkedin_ideas.map(item=>`<div class="plain-row"><div><h3>${esc(item.title)}</h3><p>${esc(item.prompt)}</p><p class="micro">${esc(item.evidence)}</p></div></div>`).join("");
  return pageHead("Insights",`Weekly evidence from your collected roles · ${esc(report.week)}. This view uses no AI credits.`)+`<div class="metric-strip"><div class="metric"><strong>${jobs.length}</strong><span>Jobs collected</span></div><div class="metric"><strong>${analysed.length}</strong><span>Analysed locally</span></div><div class="metric"><strong>${strong.length}</strong><span>Passed shortlist bar</span></div><div class="metric"><strong>${applied.length}</strong><span>Applications sent</span></div></div><div class="two-col"><section><h2 class="section-title">Recurring requirements</h2><div class="plain-list">${skills||"<p class=muted>Not enough relevant descriptions this week to identify a pattern.</p>"}</div></section><section><h2 class="section-title">Profile priorities</h2><div class="plain-list">${recommendations||"<p class=muted>No evidence-backed recommendation yet.</p>"}</div></section></div><section class="insight-extra"><h2 class="section-title">LinkedIn content ideas</h2><div class="plain-list">${ideas||"<p class=muted>Ideas appear when a requirement recurs across roles.</p>"}</div></section><p class="micro">${esc(report.note)} Salary disclosed in ${report.salary_disclosed_jobs} relevant role${report.salary_disclosed_jobs===1?"":"s"}.</p>`;
}

function renderProfile(){const p=state.config.profile;return pageHead("Profile","Explicit details here outrank CV, portfolio and LinkedIn data. Save only facts you can verify.")+`<div class="settings-grid"><section class="settings-panel"><h2>Contact and portfolio</h2><div class="field"><label>Name</label><input value="${esc(p.name)}" disabled></div><div class="field"><label for="profile-portfolio">Portfolio URL</label><input id="profile-portfolio" value="${esc(p.portfolio_url||"")}"></div><div class="field"><label for="profile-linkedin">LinkedIn URL</label><input id="profile-linkedin" placeholder="Add your LinkedIn URL" value="${esc(p.linkedin_url||"")}"></div><div class="field"><label for="profile-phone">Australian phone</label><input id="profile-phone" placeholder="Add when available" value="${esc(p.contact?.phone||"")}"></div><button class="button" data-action="save-profile">Save profile</button></section><section class="settings-panel"><h2>Work and availability</h2><div class="field"><label>Visa type (label only)</label><input value="${esc(p.visa_type||"")}" disabled></div><p class="muted">A visa label does not establish current work rights. Confirm the grant and conditions before recording valid rights. <a href="https://immi.homeaffairs.gov.au/visas/already-have-a-visa/check-visa-details-and-conditions/overview" target="_blank" rel="noopener">Check your visa in VEVO ↗</a> If condition 8547 applies, <a href="https://immi.homeaffairs.gov.au/supporting/Pages/Work/6-month-work-limitation.aspx" target="_blank" rel="noopener">review the official employer limit ↗</a>.</p><div class="field"><label for="profile-rights">Current work rights</label><select id="profile-rights"><option value=unknown ${p.current_work_rights?.valid_now==null?"selected":""}>Not verified</option><option value=yes ${p.current_work_rights?.valid_now===true?"selected":""}>Verified valid now</option><option value=no ${p.current_work_rights?.valid_now===false?"selected":""}>Not valid now</option></select></div><div class="field"><label for="profile-rights-note">Visa condition details / verification note</label><textarea id="profile-rights-note" placeholder="Enter the grant conditions you have verified">${esc(p.current_work_rights?.details==="[NEEDS USER INPUT]"?"":p.current_work_rights?.details||"")}</textarea></div><div class="field"><label for="profile-availability">Availability date</label><input id="profile-availability" type=date value="${esc(p.availability_date||"")}"></div><div class="field"><label for="profile-relocation">Relocation date</label><input id="profile-relocation" type=date value="${esc(p.relocation_date||"")}"></div><div class="field"><label for="profile-salary">Salary expectation (AUD)</label><input id="profile-salary" inputmode=numeric value="${esc(p.salary_expectations_aud||"")}"></div><button class="button" data-action="save-profile">Save profile</button></section></div>`}

function renderSettings(){
  const pref=state.config.preferences;
  const sync=staticMode?`<section class="settings-panel sync-panel"><h2>Sync across devices</h2><p class="muted">${window.staticSync.connected()?"Connected. Decisions, statuses, checklist items and feedback are shared through your GitHub repository.":"Connect each browser once to save and share changes between mobile and desktop."}</p>${window.staticSync.connected()?`<div class="sync-state"><span class="live-dot"></span><strong>Connected to GitHub</strong></div><button class="button secondary" data-action="disconnect-sync">Disconnect this device</button>`:`<div class="field"><label for="sync-token">Fine-grained GitHub token</label><input id="sync-token" type="password" autocomplete="off" placeholder="github_pat_…"></div><label class="check-row"><input id="sync-remember" type="checkbox" checked><span>Remember on this device</span></label><p class="micro">Create a token limited to <strong>personal-job-os-pages</strong>, with repository permission <strong>Contents: Read and write</strong>. The token stays in this browser.</p><div class="inline-actions"><a class="button secondary" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create token ↗</a><button class="button" data-action="connect-sync">Connect</button></div>`}</section>`:"";
  return pageHead("Settings","Search runs on weekdays. Job OS records AI usage without an app limit.")+`<div class="settings-grid"><section class="settings-panel"><h2>Search schedule</h2><div class="field"><label for="settings-timezone">Timezone</label><input id="settings-timezone" value="${esc(pref.timezone)}"></div><div class="field"><label for="settings-discovery">Discovery time</label><input id="settings-discovery" type=time value="${esc(pref.discovery_time)}"></div><div class="field"><label for="settings-notification">Notification time</label><input id="settings-notification" type=time value="${esc(pref.notification_time)}"></div><div class="field"><label for="settings-locations">Priority locations (one per line)</label><textarea id="settings-locations">${esc(pref.location_priority.join("\n"))}</textarea></div><p class="micro">Runs Monday–Friday only. Application submission is always manual. After changing a scheduled time, run <code>npm run jobs:schedule -- install</code> once in Terminal.</p><button class="button" data-action="save-settings">Save settings</button></section>${sync}<section class="settings-panel"><h2>AI usage</h2><div class="plain-list"><div class="plain-row"><div><h3>Job OS limit</h3><p>None. Daily, weekly and monthly usage caps have been removed.</p></div></div><div class="plain-row"><div><h3>External provider</h3><p>Not connected. Scheduled discovery and matching currently run locally.</p></div></div><div class="plain-row"><div><h3>ChatGPT Plus</h3><p>Your plan limits are managed by OpenAI and are separate from this local app.</p></div></div></div></section></div>`;
}

async function render(){
  shellMeta();const app=$("#app");app.innerHTML=`<div class="content"><p class="muted">Loading workspace…</p></div>`;
  let html="";
  try{
    if(state.route==="today")html=renderToday();else if(state.route==="dashboard")html=renderDashboard();else if(state.route==="jobs")html=renderJobs();else if(state.route==="applications")html=renderApplications();else if(state.route==="insights")html=await renderInsights();else if(state.route==="profile")html=renderProfile();else if(state.route==="settings")html=renderSettings();else if(state.route==="files")html=await renderFiles();else if(state.route==="cv")html=await renderCV();else if(state.route.startsWith("cv/"))html=await renderCV(state.route.split("/")[1]);else if(state.route.startsWith("workspace/"))html=await renderWorkspace(state.route.split("/")[1]);else html=renderToday();
    app.innerHTML=`<div class="content">${staticMode?`<div class="snapshot-note">Public snapshot · Personal data is visible to anyone with this URL. ${window.staticSync.connected()?"Changes sync through your GitHub repository.":"Connect GitHub in Settings to save changes across devices."}</div>`:""}${html}</div>`;
    if(staticMode && ["profile","settings"].includes(state.route)){
      app.querySelectorAll("input,textarea,select").forEach(control=>{if(!control.closest(".sync-panel"))control.disabled=true});
      app.querySelectorAll('[data-action="save-profile"],[data-action="save-settings"]').forEach(control=>control.remove());
    }
  }catch(error){app.innerHTML=`<div class="content">${pageHead("Something needs attention")}${empty("This view could not load.",esc(error.message),`<button class="button" data-action="retry">Try again</button>`)}</div>`;notice(error.message,true)}
}
async function navigate(route){state.route=route;location.hash=route;await render();window.scrollTo(0,0)}
async function refreshAndRender(){await refresh();await render()}

document.addEventListener("click",async event=>{
  const routeButton=event.target.closest("[data-route]");if(routeButton){await navigate(routeButton.dataset.route);return}
  const button=event.target.closest("[data-action]");if(!button)return;
  const action=button.dataset.action,id=button.dataset.id;
  try{
    button.disabled=true;
    if(action==="prev"||action==="next"){state.todayIndex+=action==="next"?1:-1;await render();return}
    if(action==="retry"){await render();return}
    if(action==="connect-sync"){
      await window.staticSync.connect($("#sync-token").value,$("#sync-remember").checked);await refresh();notice("GitHub sync connected.");await render();return;
    }
    if(action==="disconnect-sync"){window.staticSync.disconnect();notice("Sync disconnected on this device.");await render();return}
    if(action==="decision"){
      const decision=button.dataset.decision;await api(`/api/jobs/${id}/decision`,{method:"POST",body:JSON.stringify({decision})});
      if(decision==="APPLY"){try{await api(`/api/jobs/${id}/prepare`,{method:"POST",body:"{}"})}catch(error){notice("Decision saved; preparation needs attention: "+error.message,true)}await refresh();await navigate(`workspace/${id}`)}else{notice(decision==="MAYBE"?"Saved to Maybe.":"Job skipped.");await refreshAndRender()}return;
    }
    if(action==="prepare"){await api(`/api/jobs/${id}/prepare`,{method:"POST",body:"{}"});notice("Draft materials prepared for review.");await refreshAndRender();return}
    if(action==="mark-applied"){await api(`/api/jobs/${id}/applied`,{method:"POST",body:"{}"});notice("Application recorded.");await refreshAndRender();return}
    if(action==="quick-feedback"){
      await api(`/api/jobs/${id}/feedback`,{method:"POST",body:JSON.stringify({match_rating:button.dataset.rating})});notice("Match feedback saved.");return;
    }
    if(action==="save-feedback"){
      const body={match_rating:$("#feedback-match").value||null,material_rating:$("#feedback-material").value||null,note:$("#feedback-note").value.trim()};
      await api(`/api/jobs/${id}/feedback`,{method:"POST",body:JSON.stringify(body)});$("#feedback-match").value="";$("#feedback-material").value="";$("#feedback-note").value="";notice("Feedback saved.");return;
    }
    if(action==="save-status"){
      await api(`/api/jobs/${id}/status`,{method:"POST",body:JSON.stringify({status:$("#application-status").value})});await refreshAndRender();notice("Application status updated.");return;
    }
    if(action==="check"){
      const checked=button.checked;try{const result=await api(`/api/jobs/${id}/check`,{method:"POST",body:JSON.stringify({item:button.dataset.item,checked})});state.detail.checks=result.checks;notice("Checklist saved.")}catch(error){button.checked=!checked;throw error}return;
    }
    if(action==="reveal"){
      await api("/api/reveal",{method:"POST",body:JSON.stringify({area:button.dataset.area,path:button.dataset.path})});notice("Opened in Finder.");return;
    }
    if(action==="copy-letter"||action==="copy-answer"){
      const value=action==="copy-letter"?state.letter:state.answerSections[Number(button.dataset.index)]?.body;
      if(!value)throw new Error("Nothing to copy");await navigator.clipboard.writeText(value);notice("Copied to clipboard.");return;
    }
    if(action==="file-area"){state.fileArea=button.dataset.area;state.filePath="";await render();return}
    if(action==="file-folder"){state.filePath=button.dataset.path;await render();return}
    if(action==="save-cv"){
      const result=await api(`/api/jobs/${id}/cv`,{method:"POST",body:JSON.stringify({cv:state.cvDraft})});state.cvSource.cv=structuredClone(state.cvDraft);state.cvDirty=false;notice(result.validation.status==="READY"?"CV saved.":"CV saved. Factual review is still required.");await render();return;
    }
    if(action==="restore-cv"){await api(`/api/jobs/${id}/restore`,{method:"POST",body:"{}"});state.cvSource=null;state.cvId=null;notice("Generated version restored.");await render();return}
    if(action==="regenerate-section"){
      const group=button.dataset.group,index=Number(button.dataset.index),role=Number(button.dataset.role);state.cvDraft[group][index].roles[role].body=state.cvSource.generated_cv[group][index].roles[role].body;state.cvDirty=true;notice("Section regenerated from verified source; save to export.");await render();return;
    }
    if(action==="compare-master"){if(!state.masterCV)state.masterCV=await api("/api/cv-master");state.compare=!state.compare;await render();return}
    if(action==="focus-preview"){state.previewFocus=!state.previewFocus;await render();return}
    if(action==="save-profile"){
      const rights=$("#profile-rights").value;const body={portfolio_url:$("#profile-portfolio").value.trim(),linkedin_url:$("#profile-linkedin").value.trim(),phone:$("#profile-phone").value.trim(),availability_date:$("#profile-availability").value,relocation_date:$("#profile-relocation").value,salary_expectations_aud:$("#profile-salary").value.trim(),work_rights_valid_now:rights==="yes"?true:rights==="no"?false:null,work_rights_note:$("#profile-rights-note").value.trim()};
      const saved=await api("/api/config/profile",{method:"POST",body:JSON.stringify(body)});state.config={profile:saved.profile,preferences:saved.preferences,usage:saved.usage};notice("Profile saved locally.");await render();return;
    }
    if(action==="save-settings"){
      const body={timezone:$("#settings-timezone").value.trim(),discovery_time:$("#settings-discovery").value,notification_time:$("#settings-notification").value,location_priority:$("#settings-locations").value.split("\n").map(line=>line.trim()).filter(Boolean)};
      const saved=await api("/api/config/settings",{method:"POST",body:JSON.stringify(body)});state.config={profile:saved.profile,preferences:saved.preferences,usage:saved.usage};await refresh();notice("Settings saved locally.");await render();return;
    }
  }catch(error){notice(error.message,true)}finally{button.disabled=false}
});
document.addEventListener("input",event=>{
  if(event.target.id==="job-search"){state.search=event.target.value;const cursor=event.target.selectionStart;const active=document.activeElement;const wrap=$(".table-wrap");const result=renderJobs();$("#app").innerHTML=`<div class="content">${result}</div>`;const input=$("#job-search");input.focus();input.setSelectionRange(cursor,cursor);return}
  const target=event.target;if(target.dataset.cvKey&&state.cvDraft){const key=target.dataset.cvKey;if(key==="about")state.cvDraft.about=target.value;else if(key==="skills")state.cvDraft.skills=target.value.split("\n").map(line=>line.trim()).filter(Boolean);else state.cvDraft[target.dataset.cvGroup][Number(target.dataset.cvIndex)].roles[Number(target.dataset.cvRole)].body=target.value;state.cvDirty=true;$("#cv-change-note").textContent="Unsaved changes · Fixed A4 template";const save=$("[data-action=save-cv]");if(save)save.disabled=false;$("#cv-live").innerHTML=liveCV()}
});
document.addEventListener("change",async event=>{if(event.target.id==="job-status"){state.statusFilter=event.target.value;await render()}if(event.target.id==="cv-select"){state.cvSource=null;state.cvId=null;await navigate(`cv/${event.target.value}`)}});
window.addEventListener("hashchange",()=>{const route=location.hash.slice(1)||"today";if(route!==state.route){state.route=route;render()}});
(async()=>{try{[state.summary,state.config]=await Promise.all([api("/api/summary"),api("/api/config")]);state.route=location.hash.slice(1)||"today";await render()}catch(error){$("#app").innerHTML=`<div class="content">${empty("The local workspace is unavailable.",esc(error.message))}</div>`}})();

document.addEventListener("keydown",event=>{
  if(state.route!=="today"||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
  const target=event.target;if(target instanceof Element && target.closest("input,textarea,select,[contenteditable=true]"))return;
  const decision={"1":"SKIP","2":"MAYBE","3":"APPLY"}[event.key];if(!decision)return;
  const button=document.querySelector(`[data-action="decision"][data-decision="${decision}"]`);
  if(button&&!button.disabled){event.preventDefault();button.click()}
});
