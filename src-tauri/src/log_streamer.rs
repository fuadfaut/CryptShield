use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Start streaming journalctl logs for dnscrypt-proxy and emit them to the frontend
pub async fn start_log_stream(app: AppHandle) {
    let child = Command::new("journalctl")
        .args(["-u", "dnscrypt-proxy", "-f", "--no-pager", "-n", "50"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match child {
        Ok(mut child) => {
            if let Some(stdout) = child.stdout.take() {
                let reader = BufReader::new(stdout);
                let mut lines = reader.lines();

                while let Ok(Some(line)) = lines.next_line().await {
                    let _ = app.emit("log-stream", line);
                }
            }
        }
        Err(e) => {
            let _ = app.emit(
                "log-stream",
                format!("[ERROR] Failed to start journalctl: {}", e),
            );
        }
    }
}
