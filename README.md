# CryptShield (DNSCrypt-GUI)

CryptShield is a modern, lightweight graphical user interface (GUI) for managing the `dnscrypt-proxy` daemon on Linux (specifically tailored for Fedora 44). It allows users to easily encrypt their DNS traffic, switch resolvers, and monitor system logs in real-time without ever touching the terminal or editing configuration files manually.

Built with **Tauri v2**, **React 18**, **TypeScript**, and **Tailwind CSS**.

![CryptShield Dashboard](https://raw.githubusercontent.com/catppuccin/catppuccin/main/assets/palette/mocha.png) <!-- *Placeholder for actual screenshot* -->

## ✨ Features

- **One-Click Protection**: Easily start, stop, or restart the `dnscrypt-proxy` systemd service with automatic `pkexec` (Polkit) privilege escalation.
- **Live Traffic Monitor**: Real-time visualization of total queries and blocked domains directly parsed from the `dnscrypt-proxy` daemon's query logs.
- **System-Wide DNS Routing**: Dynamically updates NetworkManager to route all system traffic through `127.0.0.1` when active.
- **System Tray & Autostart**: Seamlessly runs in the background. Minimize to tray instead of closing, and optionally set it to launch automatically on system login.
- **Live Traffic Monitoring**: Visual display of real-time queries, blocked domains (ad/malware), active resolver, average latency, and uptime.
- **Easy Configuration**: Quickly switch between major resolvers (Cloudflare, Quad9, AdGuard, NextDNS) via a dropdown menu.
- **Advanced Options**: Toggle DNS caching and DNSSEC enforcement with a simple switch.
- **Real-Time Logs**: View `journalctl` logs natively within the application to troubleshoot connections effortlessly.
- **Dark Mode First**: Beautiful, eye-friendly design utilizing the Catppuccin Mocha color palette.

## 🛠 Prerequisites

Before running or building CryptShield, ensure your system has the core daemon installed:

```bash
# Install the dnscrypt-proxy daemon
sudo dnf install -y dnscrypt-proxy
```

If you intend to build the app from source, you will also need the Tauri system dependencies:
```bash
sudo dnf install -y dbus-devel webkit2gtk4.1-devel librsvg2-devel
```

## 🚀 Getting Started (Development)

1. **Clone the repository and install Node dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   This will launch the React frontend locally (ideal for UI testing).
   ```bash
   npm run dev
   ```

3. **Run the full Desktop Application (Tauri Mode)**:
   This compiles the Rust backend and launches the native desktop window.
   ```bash
   npm run tauri dev
   ```

### 4. Build the production RPM package:
   ```bash
   npm run tauri build
   ```

---
**Current Version**: v0.1.2 (Beta)

## 🏗 Architecture

CryptShield is built using a secure, two-tier architecture:
- **Frontend (UI)**: A responsive single-page application built with React and styled with Tailwind CSS v4. State is managed globally via Zustand.
- **Core Backend (Rust)**: Handles secure system operations that cannot be performed in a browser. It utilizes standard `std::process::Command` to invoke `systemctl` and `pkexec`, the `toml` crate for safely mutating `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`, and the `tokio` asynchronous runtime to stream journal logs without blocking the UI thread.

## 📄 License

This project is licensed under the MIT License.
