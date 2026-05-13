Product Requirements Document (PRD)

Project Name: CryptShield (DNSCrypt-GUI)
Target OS: Fedora Linux 44 (Kompatibel dengan sistem berbasis systemd lainnya)
Version: 1.0.0 (MVP)

1. Pendahuluan

CryptShield adalah antarmuka grafis (GUI) berbasis desktop untuk mengelola layanan dnscrypt-proxy. Aplikasi ini dirancang untuk menjembatani pengguna Linux, khususnya Fedora 44, agar dapat mengenkripsi lalu lintas DNS mereka tanpa harus mengedit file konfigurasi teks atau menggunakan antarmuka baris perintah (CLI).

2. Target Pengguna

Pengguna desktop Linux sehari-hari yang menginginkan privasi ekstra (DNS-over-HTTPS / DNSCrypt).

Power user yang ingin memonitor status dan latensi DNS secara real-time.

Pengguna yang sering berganti profil jaringan dan membutuhkan cara cepat untuk mengubah resolver (misal: pindah dari profil ngebut ke profil blokir iklan).

3. User Stories

US1: Sebagai pengguna, saya ingin menghidupkan/mematikan layanan enkripsi DNS hanya dengan satu klik.

US2: Sebagai pengguna, saya ingin melihat apakah sistem saya saat ini terlindungi secara real-time.

US3: Sebagai pengguna, saya ingin memilih server penyedia DNS (seperti Cloudflare, Quad9, AdGuard) dari dropdown list tanpa mengedit file .toml.

US4: Sebagai sysadmin, saya ingin melihat log sistem dari dnscrypt-proxy di dalam aplikasi untuk troubleshooting.

US5: Sebagai pengguna biasa, saya ingin aplikasi otomatis meminta izin (password root) hanya ketika saya mencoba mengubah sistem jaringan.

4. Kebutuhan Fungsional (Functional Requirements)

Service Controller: Mampu menjalankan perintah systemctl start/stop/restart/status dnscrypt-proxy.service.

Config Parser: Mampu membaca, mengubah, dan menyimpan file /etc/dnscrypt-proxy/dnscrypt-proxy.toml.

Privilege Escalation: Memanggil pkexec (Polkit) saat mengeksekusi aksi yang membutuhkan hak akses root.

Log Reader: Membaca output dari journalctl -u dnscrypt-proxy -f dan menampilkannya di UI.

5. Kebutuhan Non-Fungsional (Non-Functional Requirements)

Performa: Penggunaan memori (RAM) tidak boleh lebih dari 60MB saat idle (dicapai berkat Tauri + Rust).

Ukuran Aplikasi: Binary size di bawah 20MB.

Desain: Menggunakan tema Dark Mode yang senada dengan estetika desktop Linux modern (GNOME/KDE).

6. Out of Scope (Di Luar Cakupan MVP v1.0)

Manajemen Blacklist/Whitelist domain secara manual.

Konfigurasi fallback resolver kustom.

Pembuatan installer Flatpak (MVP akan difokuskan pada format .rpm).