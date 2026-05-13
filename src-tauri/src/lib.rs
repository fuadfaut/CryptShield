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

// --- Tauri Command: Get Service Status ---
#[tauri::command]
fn get_service_status() -> Result<String, String> {
    system_ctl::get_status()
}

// --- Tauri Command: Toggle Service ---
#[tauri::command]
fn toggle_service(state: bool) -> Result<String, String> {
    if state {
        system_ctl::start_service()
    } else {
        system_ctl::stop_service()
    }
}

// --- Tauri Command: Restart Service ---
#[tauri::command]
fn restart_service() -> Result<String, String> {
    system_ctl::restart_service()
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
fn get_config() -> Result<ConfigResponse, String> {
    let config = config_manager::read_config()?;
    Ok(ConfigResponse {
        server_names: config.server_names,
        listen_addresses: config.listen_addresses,
        cache: config.cache,
        require_dnssec: config.require_dnssec,
    })
}

// --- Tauri Command: Update Resolver ---
#[tauri::command]
fn update_resolver(name: String) -> Result<String, String> {
    config_manager::update_resolver(&name)?;
    // Restart service to apply changes
    system_ctl::restart_service()?;
    Ok(format!("Resolver updated to: {}", name))
}

// --- Tauri Command: Update Config Option ---
#[tauri::command]
fn update_option(key: String, value: bool) -> Result<String, String> {
    config_manager::update_option(&key, value)?;
    Ok(format!("Option '{}' set to {}", key, value))
}

// --- Application Entry Point ---
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            update_resolver,
            update_option,
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

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
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
