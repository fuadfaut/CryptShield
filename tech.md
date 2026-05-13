System Architecture & Tech Stack

Project Name: CryptShield

1. Ikhtisar Arsitektur

CryptShield dibangun menggunakan Tauri Framework. Tauri memisahkan aplikasi menjadi dua lapisan utama:

Frontend (UI): Menangani interaksi pengguna dan tampilan.

Core Backend (Rust): Menangani interaksi langsung dengan sistem operasi Linux (Fedora).

Keduanya berkomunikasi melalui sistem IPC (Inter-Process Communication) bawaan Tauri yang sangat aman.

2. Tech Stack Terpilih

Frontend (Antarmuka Pengguna)

Framework: React 18+ dengan TypeScript.

Build Tool: Vite (untuk HMR dan proses build yang cepat).

Styling: Tailwind CSS (untuk styling komponen utility-first).

Icons: Phosphor Icons.

Backend (Sistem Logika)

Bahasa Utama: Rust 🦀.

Framework Desktop: Tauri v2.

Library (Crates) Penting:

toml: Untuk proses parsing dan modifikasi /etc/dnscrypt-proxy/dnscrypt-proxy.toml.

std::process::Command: Untuk mengeksekusi shell commands (systemctl, journalctl).

tokio: Untuk pemrosesan asynchronous (seperti membaca streaming log tanpa memblokir UI).

3. Alur Komunikasi IPC (Tauri Commands)

Berikut adalah daftar commands yang akan diregistrasikan di Rust dan dipanggil dari React:

React Caller

Rust Command (Tauri)

Deskripsi Eksekusi di Linux

invoke('toggle_service', { state: true })

start_dnscrypt()

pkexec systemctl start dnscrypt-proxy

invoke('get_service_status')

check_status()

systemctl is-active dnscrypt-proxy

invoke('update_resolver', { name: 'quad9' })

write_toml_config()

Modifikasi server_names di .toml + restart service

listen('log-stream')

stream_journalctl()

Menggunakan tokio untuk membaca journalctl -f dan memancarkan event ke UI

4. Keamanan & Hak Akses

Aplikasi Tauri berjalan di level user biasa (non-root) demi keamanan. Modifikasi pada file /etc/ atau kontrol systemd membutuhkan hak akses superuser.

Solusi: Rust tidak akan dijalankan sebagai root (jangan gunakan sudo cryptshield). Sebagai gantinya, perintah spesifik yang membutuhkan akses sistem akan dibungkus menggunakan pkexec (Polkit). Ini akan memunculkan pop-up dialog bawaan Fedora untuk meminta kata sandi pengguna secara elegan.