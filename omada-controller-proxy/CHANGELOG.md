# Changelog

## 1.2.2

- Use the Omada 6.x `/api/v2/login` browser-session endpoint first.
- Fall back to the controller-ID login endpoint for older Omada releases.

## 1.2.1

- Follow controller-origin HTTPS port redirects before starting the Ingress proxy.
- Prevent redirect loops when Omada 6.x redirects the legacy `8043` UI entry point to port `443`.

## 1.2.0

- Automatically establish an Omada browser session from credentials stored in the add-on configuration.
- Keep controller credentials server-side and restrict the Home Assistant sidebar panel to administrators.

## 1.1.2

- Rewrite dynamically created link, script, image, form, and poster paths through Home Assistant Ingress.
- Restore Omada microfrontend layouts, styles, icons, and fonts that previously escaped to the Home Assistant root.

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
