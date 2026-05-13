# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-05-13

### Added
- **Live Traffic Monitoring**: Enabled `query.log` in `dnscrypt-proxy.toml` and implemented real-time log streaming via Tauri. The frontend now parses TSV logs to accurately track total DNS queries and blocked domains (ads/malware) dynamically.

## [0.1.1] - 2026-05-13

### Added
- **NetworkManager Integration**: The Rust backend now uses `nmcli` to automatically route the active connection's DNS to `127.0.0.1` upon starting the service, and restores the default DHCP behavior when stopped.
- **System Tray Support**: The app now minimizes to a native desktop tray icon when closed, allowing it to run silently in the background. Added right-click context menu to restore or quit.
- **Autostart (Run on Startup)**: Added a toggle in Advanced Options utilizing `@tauri-apps/plugin-autostart` to automatically launch the application in the system tray when logging into the desktop environment.
- **Load Balanced Resolver**: Added "Load Balanced (All Servers)" option in the UI, restoring the default behavior of `dnscrypt-proxy` when no specific resolver is chosen.

### Changed
- **Optimized Privilege Escalation**: Consolidated multiple systemctl and nmcli executions into a single bash script, reducing Polkit (`pkexec`) password prompts from 3 down to 1 when changing application state.

### Fixed
- **Configuration Writer (Permission Denied)**: Fixed a silent failure where the UI could not write to the root-owned `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`. Rewrote `update_resolver` to use `pkexec sed` instead of the `toml` crate, ensuring atomic elevated writes while perfectly preserving all original file comments.
- **Resolver Matching**: The UI now accurately passes exact resolver names (e.g. `quad9-dnscrypt-ip4-filter-pri`) to the backend, fixing an issue where `dnscrypt-proxy` would ignore invalid names and silently fall back to querying all servers.
- **Tauri v2 API Compliance**: Updated `get_window` deprecations to `get_webview_window` under the `Manager` trait to resolve Rust compilation warnings/errors.
- **Security Capabilities**: Added `"autostart:default"` to Tauri capabilities list to prevent permission errors when using the autostart plugin.

## [0.1.0] - 2026-05-13

### Added
- **Core App**: Initial release of CryptShield MVP (Minimum Viable Product).
- **Backend (Rust/Tauri)**:
  - `system_ctl.rs` module to handle systemd operations (`start`, `stop`, `restart`, `status`) wrapped in `pkexec` for secure Polkit authentication.
  - `config_manager.rs` module using the `toml` crate to parse and mutate `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`.
  - `log_streamer.rs` module utilizing `tokio` to stream asynchronous output directly from `journalctl -u dnscrypt-proxy -f`.
  - IPC Command registry in `lib.rs` linking the Rust backend to the JavaScript frontend.
- **Frontend (React)**:
  - Implemented Catppuccin Mocha dark theme design system via Tailwind CSS v4.
  - Centralized application state management using `Zustand` (`appStore.ts`), directly mapped to Tauri invoke/listen endpoints.
  - **Dashboard Tab**:
    - Interactive power toggle with animated glow states reflecting systemd daemon activity.
    - Live Traffic visualization for total queries and blocked requests.
    - Metric cards for Active Resolver, Average Latency, and Uptime tracking.
  - **Configuration Tab**:
    - Dropdown to securely update the `server_names` configuration array (Cloudflare, Quad9, AdGuard, NextDNS).
    - Advanced toggles for enabling/disabling DNS Caching and DNSSEC.
  - **System Logs Tab**:
    - Custom log viewer terminal directly injecting real-time output from the Rust logger.
    - Added color-coded log parsing (Info, Error, Success, Warning, System).
    - Utility buttons to clear UI logs or copy them to the clipboard.
  - Global floating toast notification system for system events.
