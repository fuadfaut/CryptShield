use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Start streaming journalctl logs for dnscrypt-proxy and emit them to the frontend
pub async fn start_log_stream(app: AppHandle) {
    let app_clone = app.clone();
    
    // Task 1: Journalctl system logs
    tauri::async_runtime::spawn(async move {
        let child = Command::new("journalctl")
            .args(["-u", "dnscrypt-proxy", "-f", "--no-pager", "-n", "50"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn();

        if let Ok(mut child) = child {
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app_clone.emit("log-stream", line);
                }
            }
        }
    });

    // Task 2: Live DNS Traffic Log
    tauri::async_runtime::spawn(async move {
        // Wait briefly for the daemon to start and create the file if needed
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        let child = Command::new("tail")
            .args(["-F", "/var/log/dnscrypt-query.log"])
            .stdout(Stdio::piped())
            .kill_on_drop(true)
            .spawn();

        if let Ok(mut child) = child {
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app.emit("traffic-stream", line);
                }
            }
        }
    });
}
