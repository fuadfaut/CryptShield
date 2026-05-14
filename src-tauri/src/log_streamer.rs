use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct LogStreamState {
    journal: Mutex<Option<Child>>,
    traffic: Mutex<Option<Child>>,
}

pub async fn start_journal_stream(app: AppHandle, state: &LogStreamState) -> Result<(), String> {
    let mut active_child = state.journal.lock().await;
    if active_child.is_some() {
        return Ok(());
    }

    let mut child = Command::new("journalctl")
        .args(["-u", "dnscrypt-proxy", "-f", "--no-pager", "-n", "50"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start journal stream: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture journal stream stdout".to_string())?;

    *active_child = Some(child);
    drop(active_child);

    tauri::async_runtime::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app.emit("log-stream", line);
        }
    });

    Ok(())
}

pub async fn stop_journal_stream(state: &LogStreamState) -> Result<(), String> {
    stop_child(&state.journal).await
}

pub async fn start_traffic_stream(app: AppHandle, state: &LogStreamState) -> Result<(), String> {
    let mut active_child = state.traffic.lock().await;
    if active_child.is_some() {
        return Ok(());
    }

    let mut child = Command::new("tail")
        .args(["-n", "0", "-F", "/var/log/dnscrypt-query.log"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start traffic stream: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture traffic stream stdout".to_string())?;

    *active_child = Some(child);
    drop(active_child);

    tauri::async_runtime::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            let _ = app.emit("traffic-stream", line);
        }
    });

    Ok(())
}

pub async fn stop_traffic_stream(state: &LogStreamState) -> Result<(), String> {
    stop_child(&state.traffic).await
}

async fn stop_child(slot: &Mutex<Option<Child>>) -> Result<(), String> {
    let mut active_child = slot.lock().await;
    if let Some(mut child) = active_child.take() {
        let _ = child.kill().await;
        let _ = child.wait().await;
    }

    Ok(())
}
