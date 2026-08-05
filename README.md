# Omada controller proxy

A Home Assistant Add-on that proxies the complete local TP-Link Omada Software Controller interface through Home Assistant Ingress.

The Add-on keeps the controller address and credentials in Home Assistant Add-on options. Credentials are used server-side to establish and refresh the Omada browser session and are never returned to the browser.

## Features

- Complete Omada management interface inside the Home Assistant Ingress sidebar
- Configurable controller IP and HTTPS port
- Configurable local Omada username and password
- Automatic Omada login with a short-lived session token delivered only through authenticated Ingress
- Home Assistant administrator-only sidebar panel
- Optional TLS certificate verification
- HTTP, static asset, API, redirect, cookie, and WebSocket proxying
- Ingress-aware path rewriting for Omada resources
- No host networking or privileged container access

## Installation

1. In Home Assistant, open **Settings → Apps → App store**.
2. Open the repository menu and add this GitHub repository URL.
3. Install **Omada controller proxy**.
4. Configure the controller IP, port, username, password, and TLS verification setting.
5. Start the Add-on and enable **Show in sidebar**.

## Configuration

```yaml
controller_ip: ""
controller_port: 8043
username: admin
password: change_me
verify_ssl: false
```

Use a dedicated, least-privilege local Omada account where possible. Enable `verify_ssl` only when the controller certificate is trusted by the Add-on container.

## Omada management interface

The Add-on removes Omada's frame-blocking response headers only after the request has entered Home Assistant's authenticated Ingress boundary. It also rewrites root-relative resources to the unique Ingress path, so the original management interface can operate in the Home Assistant sidebar.

## Supported architecture

- `amd64`

## License

MIT
