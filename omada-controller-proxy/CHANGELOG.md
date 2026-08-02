# Changelog

## 1.1.1

- Rewrite absolute Omada JavaScript and JSON module asset paths through the Home Assistant Ingress prefix.
- Fix blank or incomplete post-login pages caused by failed `/modules/static/` dynamic imports.
- Inject an import map for native dynamic imports and bypass upstream `304` responses so HTML patches are always applied.

## 1.1.0

- Proxy the complete Omada management interface through Home Assistant Ingress.
- Rewrite the Omada base path for Ingress static resources and API requests.
- Proxy HTTP methods, redirects, cookies, CSS assets, and WebSocket upgrades.
- Remove upstream frame-blocking headers only inside the authenticated Ingress boundary.

## 1.0.0

- Initial release.
- Add configurable Omada controller address and credentials.
- Add Home Assistant Ingress status dashboard.
- Validate controller API connectivity and login without exposing credentials.
