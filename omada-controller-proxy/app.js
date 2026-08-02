const fs = require("fs");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const options = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
const host = String(options.controller_ip || "").trim();
const port = Number(options.controller_port || 8043);
const username = String(options.username || "");
const password = String(options.password || "");
const verifySsl = options.verify_ssl === true;
const baseUrl = `https://${host}:${port}`;
const agent = new https.Agent({ rejectUnauthorized: verifySsl });

function request(path, init = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const started = Date.now();
    const req = https.request(url, {
      method: init.method || "GET",
      agent,
      timeout: 8000,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
        latency_ms: Date.now() - started,
      }));
    });
    req.on("timeout", () => req.destroy(new Error("connection timeout")));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

async function getStatus() {
  const infoResponse = await request("/api/info");
  let info = {};
  try { info = JSON.parse(infoResponse.body).result || {}; } catch {}
  const result = {
    healthy: infoResponse.status === 200 && Boolean(info.omadacId),
    controller_online: infoResponse.status === 200,
    http_status: infoResponse.status,
    latency_ms: infoResponse.latency_ms,
    controller_ip: host,
    controller_port: port,
    controller_version: info.controllerVer || null,
    api_version: info.apiVer || null,
    configured: info.configured ?? null,
    authenticated: false,
    credentials_configured: Boolean(username && password),
  };
  if (!result.healthy || !result.credentials_configured) return result;

  const loginBody = JSON.stringify({ username, password });
  const login = await request(`/${info.omadacId}/api/v2/login`, {
    method: "POST",
    body: loginBody,
  });
  try {
    const loginData = JSON.parse(login.body);
    result.authenticated = loginData.errorCode === 0 && Boolean(loginData.result?.token);
    if (!result.authenticated) result.auth_error = loginData.msg || `HTTP ${login.status}`;
  } catch {
    result.auth_error = `HTTP ${login.status}`;
  }
  return result;
}

const page = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Omada controller proxy</title><style>
:root{color-scheme:light dark;--bg:#f5f5f7;--card:#fff;--text:#1d1d1f;--muted:#6e6e73;--ok:#168a57;--bad:#d70015;--blue:#007aff}@media(prefers-color-scheme:dark){:root{--bg:#000;--card:#1c1c1e;--text:#f5f5f7;--muted:#a1a1a6;--ok:#30d158;--bad:#ff453a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px system-ui,-apple-system,"Segoe UI",sans-serif}.wrap{max-width:980px;margin:auto;padding:30px 18px}.eyebrow,.muted{color:var(--muted)}h1{font-size:34px;margin:5px 0 6px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-top:22px}.card,.actions{background:var(--card);border-radius:20px;padding:20px;box-shadow:0 8px 30px #0000000d}.label{color:var(--muted);font-size:13px}.value{font-size:24px;font-weight:700;margin-top:8px;word-break:break-word}.ok{color:var(--ok)}.bad{color:var(--bad)}.actions{margin-top:16px}.button{display:inline-block;background:var(--blue);color:#fff;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:650}.note{line-height:1.6;color:var(--muted)}
</style></head><body><main class="wrap"><div class="eyebrow">Home Assistant Add-on</div><h1>Omada controller proxy</h1><div class="muted" id="updated">正在連線…</div><section class="grid" id="stats"></section><section class="actions"><a class="button" id="open" target="_blank" rel="noopener">開啟 Omada 管理介面</a><p class="note">IP、Port 與登入資料由 Add-on 設定頁管理。密碼不會傳送到此頁面。Omada 原廠頁面禁止跨來源 iframe，因此管理介面會在獨立頁籤開啟。</p></section></main><script>
const card=(l,v,c="")=>'<div class="card"><div class="label">'+l+'</div><div class="value '+c+'">'+v+'</div></div>';async function load(){try{const r=await fetch('api/status',{cache:'no-store'}),d=await r.json();document.querySelector('#updated').textContent='最後更新：'+new Date().toLocaleString()+'｜每 10 秒更新';document.querySelector('#stats').innerHTML=card('控制器',d.healthy?'在線':'離線',d.healthy?'ok':'bad')+card('API 登入',d.credentials_configured?(d.authenticated?'成功':'失敗'):'尚未設定',d.authenticated?'ok':'bad')+card('控制器版本',d.controller_version||'—')+card('API 版本',d.api_version||'—')+card('回應時間',d.latency_ms==null?'—':d.latency_ms+' ms')+card('位址',d.controller_ip+':'+d.controller_port);document.querySelector('#open').href='https://'+d.controller_ip+':'+d.controller_port+'/';}catch(e){document.querySelector('#updated').textContent='無法連線 Add-on';document.querySelector('#stats').innerHTML=card('控制器','離線','bad')}}load();setInterval(load,10000);
</script></body></html>`;

const server = http.createServer(async (req, res) => {
  const path = (req.url || "/").replace(/^\/+/, "");
  if (path === "api/status") {
    try {
      const status = await getStatus();
      res.writeHead(status.healthy ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ healthy: false, controller_online: false, error: error.message }));
    }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(page);
});

server.listen(8099, "0.0.0.0", () => console.log(`Omada controller proxy listening on :8099 for ${baseUrl}`));
