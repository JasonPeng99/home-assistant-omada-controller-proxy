# Omada controller proxy

A Home Assistant Add-on that monitors a local TP-Link Omada Software Controller through Home Assistant Ingress.

The Add-on keeps the controller address and credentials in Home Assistant Add-on options. Credentials are used server-side to validate the Omada API login and are never returned to the browser.

## Features

- Home Assistant Ingress sidebar panel
- Configurable controller IP and HTTPS port
- Configurable local Omada username and password
- Optional TLS certificate verification
- Controller reachability, latency, version, API version, and authentication status
- No host networking or privileged container access

## Installation

1. In Home Assistant, open **Settings → Apps → App store**.
2. Open the repository menu and add this GitHub repository URL.
3. Install **Omada controller proxy**.
4. Configure the controller IP, port, username, password, and TLS verification setting.
5. Start the Add-on and enable **Show in sidebar**.

## Configuration

```yaml
controller_ip: 192.168.10.245
controller_port: 8043
username: admin
password: change_me
verify_ssl: false
```

Use a dedicated, least-privilege local Omada account where possible. Enable `verify_ssl` only when the controller certificate is trusted by the Add-on container.

## Omada management interface

The Add-on dashboard provides a button that opens the original Omada management interface. Omada sends `X-Frame-Options: SAMEORIGIN`, so its complete management UI cannot safely be embedded inside the Home Assistant Ingress frame.

## Supported architecture

- `amd64`

## License

MIT
