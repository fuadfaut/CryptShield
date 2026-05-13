# Implementation Roadmap - CryptShield

## Phase 1: Setup & UI Porting [COMPLETED]
- [x] Inisialisasi proyek: Tauri v2 + React + TypeScript.
- [x] Instalasi Tailwind CSS v4.
- [x] Porting UI dari `ui.html` ke komponen React modular.
- [x] Implementasi State Management via Zustand.

## Phase 2: Rust Core & File Parsing [COMPLETED]
- [x] Modul `config_manager.rs` untuk manipulasi TOML.
- [x] Integrasi pembacaan `/etc/dnscrypt-proxy/dnscrypt-proxy.toml`.
- [x] Implementasi edit `server_names` dengan dukungan `pkexec sed`.
- [x] Ekspos Tauri Commands untuk konfigurasi.

## Phase 3: Systemd & Polkit Integration [COMPLETED]
- [x] Modul `system_ctl.rs` untuk kontrol layanan.
- [x] Wrapper `systemctl` dengan `pkexec` untuk eskalasi hak akses.
- [x] Penyatuan perintah (Chaining commands) untuk meminimalkan input password.
- [x] Sinkronisasi status layanan ke UI secara real-time.

## Phase 4: Live Data & Async Streaming [COMPLETED]
- [x] Streaming `journalctl` asinkron menggunakan Tokio.
- [x] Log viewer terintegrasi di UI dengan parsing warna.
- [x] Metrik trafik dan deteksi latency.

## Phase 5: System Integration & Polish [COMPLETED]
- [x] Integrasi NetworkManager (`nmcli`) untuk rute DNS otomatis.
- [x] Implementasi System Tray (Hide to tray).
- [x] Fitur Autostart (Run on system login).
- [x] Penanganan izin (Capabilities) Tauri v2.

## Phase 6: Packaging & Distribution [COMPLETED]
- [x] Konfigurasi bundling RPM/AppImage.
- [x] Finalisasi aset ikon.
- [x] Publikasi rilis perdana (v0.1.1) di GitHub.

## Phase 7: Quality of Life & Polish [IN PROGRESS]
- [x] Fitur pengecek dependensi (*Diagnostic Engine*).
- [x] Tab Tutorial & Setup Guide di dalam aplikasi.
- [x] Pembaruan daftar *public resolvers* (Google, Mullvad, TiarApp).
- [ ] Opsi ganti *theme* (Opsional).
- [ ] Rilis versi Stabil (v1.0.0).