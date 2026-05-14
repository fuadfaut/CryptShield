mod config_manager;
mod log_streamer;
mod system_ctl;

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

pub fn run_system_helper(args: &[String]) -> Result<String, String> {
    system_ctl::run_system_helper(args)
}

async fn run_blocking<T, F>(operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

// --- Tauri Command: Get Service Status ---
#[tauri::command]
async fn get_service_status() -> Result<String, String> {
    run_blocking(system_ctl::get_status).await
}

// --- Tauri Command: Toggle Service ---
#[tauri::command]
async fn toggle_service(
    state: bool,
    resolver: String,
    caching: bool,
    dnssec: bool,
) -> Result<String, String> {
    run_blocking(move || {
        if state {
            system_ctl::start_service(resolver, caching, dnssec)
        } else {
            system_ctl::stop_service()
        }
    })
    .await
}

// --- Tauri Command: Restart Service ---
#[tauri::command]
async fn restart_service(resolver: String, caching: bool, dnssec: bool) -> Result<String, String> {
    run_blocking(move || system_ctl::restart_service(resolver, caching, dnssec)).await
}

// --- Tauri Command: Get Config ---
#[derive(Serialize, Deserialize)]
struct ConfigResponse {
    server_names: Vec<String>,
    listen_addresses: Vec<String>,
    cache: Option<bool>,
    require_dnssec: Option<bool>,
}

#[tauri::command]
async fn get_config() -> Result<ConfigResponse, String> {
    let config = run_blocking(config_manager::read_config).await?;
    Ok(ConfigResponse {
        server_names: config.server_names,
        listen_addresses: config.listen_addresses,
        cache: config.cache,
        require_dnssec: config.require_dnssec,
    })
}

// --- Tauri Command: Check Dependencies ---
#[derive(Serialize)]
struct DependencyStatus {
    dnscrypt_proxy: bool,
    nmcli: bool,
    systemctl: bool,
    pkexec: bool,
}

#[tauri::command]
fn check_dependencies() -> Result<DependencyStatus, String> {
    let check = |cmd: &str| -> bool {
        std::process::Command::new("sh")
            .arg("-c")
            .arg(format!("command -v {}", cmd))
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    };

    Ok(DependencyStatus {
        dnscrypt_proxy: check("dnscrypt-proxy"),
        nmcli: check("nmcli"),
        systemctl: check("systemctl"),
        pkexec: check("pkexec"),
    })
}

// --- Tauri Command: Set Tray Icon ---
#[tauri::command]
fn set_tray_icon(app: tauri::AppHandle, active: bool) {
    if let Some(tray) = app.tray_by_id("main") {
        let icon_bytes = if active {
            include_bytes!("../icons/tray-on.png").to_vec()
        } else {
            include_bytes!("../icons/tray-off.png").to_vec()
        };

        if let Ok(icon) = tauri::image::Image::from_bytes(&icon_bytes) {
            let _ = tray.set_icon(Some(icon));
        }
    }
}

// --- Application Entry Point ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .invoke_handler(tauri::generate_handler![
            get_service_status,
            toggle_service,
            restart_service,
            get_config,
            check_dependencies,
            set_tray_icon,
        ])
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                // Hide window instead of closing
                window.hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .setup(|app| {
            // Setup System Tray
            let show_i = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let off_icon_bytes = include_bytes!("../icons/tray-off.png").to_vec();
            let initial_icon = tauri::image::Image::from_bytes(&off_icon_bytes).unwrap();

            let _tray = TrayIconBuilder::with_id("main")
                .icon(initial_icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // Start log streaming in background
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                log_streamer::start_log_stream(app_handle).await;
            });

            // Handle start minimized
            let cli_args: Vec<String> = std::env::args().collect();
            if cli_args.contains(&"--minimized".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
