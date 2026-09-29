/* GitHub Pages adapter. Published data is a snapshot; edits stay in this browser. */
window.PERSONAL_JOB_OS_STATIC = true;
const publishedSnapshot = fetch("./data.json?v=" + Date.now(), {cache:"no-store"}).then(async response => {
  if (!response.ok) throw new Error("The published snapshot is unavailable.");
  return response.json();
});
const editStorageKey = "personal-job-os-pages-edits-v1";
function readEdits() {
  try { return JSON.parse(localStorage.getItem(editStorageKey) || "{}"); }
  catch { return {}; }
}
function saveEdits(edits) { localStorage.setItem(editStorageKey, JSON.stringify(edits)); }
function copy(value) { return structuredClone(value); }
function publicJob(job, edits) {
  const changed = edits[job.id] || {};
  return {...job, ...changed, checks:changed.checks || job.checks || {}};
}
function listFiles(files, area, folder) {
  const prefix = folder ? folder.replace(/\/+$/, "") + "/" : "";
  const seen = new Map();
  for (const entry of files.filter(item => item.area === area && item.path.startsWith(prefix))) {
    const rest = entry.path.slice(prefix.length);
    if (!rest) continue;
    const part = rest.split("/")[0];
    const path = prefix + part;
    if (!seen.has(path)) seen.set(path, {name:part,path,is_dir:rest.includes("/"),size:rest.includes("/")?null:entry.size});
  }
  return {area,path:folder,entries:[...seen.values()].sort((a,b)=>Number(b.is_dir)-Number(a.is_dir)||a.name.localeCompare(b.name))};
}
window.staticApi = async function staticApi(route, options={}) {
  const data = await publishedSnapshot;
  const edits = readEdits();
  const url = new URL(route, location.href);
  const path = url.pathname;
  const method = (options.method || "GET").toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  if (method === "GET") {
    if (path === "/api/summary") {
      const jobs = data.summary.jobs.map(job => publicJob(job, edits));
      const byId = new Map(jobs.map(job => [job.id,job]));
      const counts = {};
      for (const job of jobs) counts[job.status] = (counts[job.status] || 0) + 1;
      return {...copy(data.summary),jobs,today:data.summary.today.map(job => byId.get(job.id)),counts};
    }
    if (path === "/api/config") return copy(data.config);
    if (path === "/api/cv-master") return copy(data.master_cv);
    if (path === "/api/insights") return copy(data.insights);
    if (path === "/api/files") return listFiles(data.files,url.searchParams.get("area")||"output",url.searchParams.get("path")||"");
    const cv = path.match(/^\/api\/jobs\/([0-9a-f-]{36})\/cv$/);
    if (cv) { if (!data.cv_sources[cv[1]]) throw new Error("CV not prepared"); return copy(data.cv_sources[cv[1]]); }
    const job = path.match(/^\/api\/jobs\/([0-9a-f-]{36})$/);
    if (job) { if (!data.details[job[1]]) throw new Error("Job not found"); return publicJob(copy(data.details[job[1]]),edits); }
    throw new Error("Published route unavailable: " + path);
  }
  const action = path.match(/^\/api\/jobs\/([0-9a-f-]{36})\/(decision|prepare|applied|feedback|status|check)$/);
  if (!action || !data.details[action[1]]) throw new Error("This action is available in the Mac workspace.");
  const [_, id, kind] = action;
  const changed = edits[id] || {};
  const today = new Date().toISOString().slice(0,10);
  if (kind === "decision") {
    if (!["SKIP","MAYBE","APPLY"].includes(body.decision)) throw new Error("Unknown decision");
    changed.latest_decision = body.decision;
    changed.date_reviewed = today;
    if (body.decision === "SKIP") changed.status = "SKIPPED";
    if (body.decision === "MAYBE") changed.status = "MAYBE";
  } else if (kind === "prepare") {
    if (!data.details[id].cv_path) throw new Error("Prepare materials in the Mac workspace.");
    return {cached:true};
  } else if (kind === "applied") {
    changed.status = "APPLIED"; changed.date_applied = today;
  } else if (kind === "status") {
    if (!["APPLIED","INTERVIEW","REJECTED","WITHDRAWN","OFFER","ARCHIVED"].includes(body.status)) throw new Error("Unknown status");
    changed.status = body.status;
  } else if (kind === "check") {
    changed.checks = {...(changed.checks || data.details[id].checks || {}),[body.item]:Boolean(body.checked)};
  } else if (kind === "feedback") {
    changed.feedback = [...(changed.feedback || []),{...body,created_at:new Date().toISOString()}];
  }
  edits[id] = changed;
  saveEdits(edits);
  return kind === "check" ? {ok:true,checks:changed.checks} : {ok:true,status:changed.status,decision:changed.latest_decision};
};
