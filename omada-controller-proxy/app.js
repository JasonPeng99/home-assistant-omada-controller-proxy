const fs = require("fs");
const http = require("http");
const https = require("https");
const tls = require("tls");
const { URL } = require("url");

const options = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
const host = String(options.controller_ip || "").trim();
const port = Number(options.controller_port || 8043);
const username = String(options.username || "");
const password = String(options.password || "");
const verifySsl = options.verify_ssl === true;
const baseUrl = `https://${host}:${port}`;
const agent = new https.Agent({ rejectUnauthorized: verifySsl, keepAlive: true });

function ingressPrefix(req) {
  return String(req.headers["x-ingress-path"] || "").replace(/\/$/, "");
}

function upstreamHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["x-ingress-path"];
  delete headers["x-hass-source"];
  delete headers["if-modified-since"];
  delete headers["if-none-match"];
  headers.host = `${host}:${port}`;
  headers["accept-encoding"] = "identity";
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = "https";
  return headers;
}

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
  const login = await request(`/${info.omadacId}/api/v2/login`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
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

function browserPatch(prefix) {
  const encoded = JSON.stringify(prefix);
  return `<script>(function(){const P=${encoded};if(!P)return;const local=u=>{if(typeof u!=="string"||!u.startsWith("/")||u.startsWith(P+"/"))return u;return P+u};const f=window.fetch;window.fetch=function(input,init){if(typeof input==="string")input=local(input);else if(input instanceof Request&&input.url.startsWith(location.origin+"/")){input=new Request(location.origin+local(new URL(input.url).pathname)+new URL(input.url).search,input)}return f.call(this,input,init)};const o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){arguments[1]=local(u);return o.apply(this,arguments)};const W=window.WebSocket;window.WebSocket=function(url,protocols){try{const u=new URL(url,location.href);if(u.hostname===location.hostname&&!u.pathname.startsWith(P+"/")){u.pathname=P+u.pathname;url=u.toString()}}catch{}return protocols===undefined?new W(url):new W(url,protocols)};window.WebSocket.prototype=W.prototype;window.WebSocket.CONNECTING=W.CONNECTING;window.WebSocket.OPEN=W.OPEN;window.WebSocket.CLOSING=W.CLOSING;window.WebSocket.CLOSED=W.CLOSED})();</script>`;
}

function importMap(prefix) {
  const imports = Object.fromEntries(
    ["modules", "static", "assets", "resources"].map((root) => [`/${root}/`, `${prefix}/${root}/`]),
  );
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

function rewriteBody(contentType, body, prefix) {
  if (!prefix) return body;
  if (contentType.includes("text/html")) {
    let text = body.toString("utf8");
    text = text.replace(/<base\s+href=["']\/["']\s*\/?\s*>/i, `<base href="${prefix}/" />`);
    text = text.replace(/<head([^>]*)>/i, `<head$1>${importMap(prefix)}${browserPatch(prefix)}`);
    return Buffer.from(text);
  }
  if (contentType.includes("text/css")) {
    const escaped = prefix.replace(/\$/g, "$$$$");
    return Buffer.from(body.toString("utf8").replace(/url\((['"]?)\//g, `url($1${escaped}/`));
  }
  if (contentType.includes("javascript") || contentType.includes("ecmascript") || contentType.includes("json")) {
    const escaped = prefix.replace(/\$/g, "$$$$");
    return Buffer.from(body.toString("utf8").replace(
      /(["'`])\/(?=(?:modules|static|assets|resources)\/)/g,
      `$1${escaped}/`,
    ));
  }
  return body;
}

function rewriteLocation(value, prefix) {
  if (!value || !prefix) return value;
  try {
    const url = new URL(value, baseUrl);
    if (url.hostname === host) return `${prefix}${url.pathname}${url.search}${url.hash}`;
  } catch {}
  return value.startsWith("/") && !value.startsWith(`${prefix}/`) ? `${prefix}${value}` : value;
}

function rewriteCookies(cookies, prefix) {
  if (!Array.isArray(cookies) || !prefix) return cookies;
  return cookies.map((cookie) => cookie
    .replace(/;\s*Domain=[^;]+/ig, "")
    .replace(/;\s*Path=\/([^;]*)/i, (_match, tail) => `; Path=${prefix}/${tail}`));
}

function proxyHttp(req, res) {
  const prefix = ingressPrefix(req);
  const requestPath = String(req.url || "/").split("?", 1)[0];
  const proxy = https.request({
    host,
    port,
    path: req.url,
    method: req.method,
    agent,
    headers: upstreamHeaders(req),
  }, (upstream) => {
    const chunks = [];
    upstream.on("data", (chunk) => chunks.push(chunk));
    upstream.on("end", () => {
      console.log(`${req.method} ${requestPath} -> ${upstream.statusCode}`);
      const contentType = String(upstream.headers["content-type"] || "").toLowerCase();
      const upstreamBody = Buffer.concat(chunks);
      const body = rewriteBody(contentType, upstreamBody, prefix);
      const headers = { ...upstream.headers };
      delete headers["x-frame-options"];
      delete headers["content-security-policy"];
      delete headers["content-security-policy-report-only"];
      delete headers["strict-transport-security"];
      delete headers["content-length"];
      delete headers["content-encoding"];
      delete headers["transfer-encoding"];
      delete headers.connection;
      delete headers["keep-alive"];
      delete headers.te;
      delete headers.trailer;
      delete headers.upgrade;
      headers["content-length"] = body.length;
      headers["cache-control"] = headers["cache-control"] || "no-cache";
      if (headers.location) headers.location = rewriteLocation(headers.location, prefix);
      if (headers["set-cookie"]) headers["set-cookie"] = rewriteCookies(headers["set-cookie"], prefix);
      res.writeHead(upstream.statusCode || 502, headers);
      res.end(body);
    });
  });
  proxy.on("error", (error) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end(`Omada proxy error: ${error.message}`);
  });
  req.pipe(proxy);
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/_proxy/status") {
    try {
      const status = await getStatus();
      res.writeHead(status.healthy ? 200 : 503, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(503, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ healthy: false, error: error.message }));
    }
    return;
  }
  proxyHttp(req, res);
});

server.on("upgrade", (req, clientSocket, head) => {
  const upstream = tls.connect({ host, port, rejectUnauthorized: verifySsl }, () => {
    const headers = upstreamHeaders(req);
    const headerText = Object.entries(headers)
      .flatMap(([name, value]) => Array.isArray(value) ? value.map((item) => `${name}: ${item}`) : [`${name}: ${value}`])
      .join("\r\n");
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerText}\r\n\r\n`);
    if (head.length) upstream.write(head);
    clientSocket.pipe(upstream).pipe(clientSocket);
  });
  upstream.on("error", () => clientSocket.destroy());
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(8099, "0.0.0.0", () => console.log(`Omada controller reverse proxy listening on :8099 for ${baseUrl}`));
