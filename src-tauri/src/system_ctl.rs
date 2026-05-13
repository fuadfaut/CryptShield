use std::process::Command;

/// Check if dnscrypt-proxy service is active
pub fn get_status() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["is-active", "dnscrypt-proxy"])
        .output()
        .map_err(|e| format!("Failed to execute systemctl: {}", e))?;

    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(status)
}

fn get_active_connection() -> Result<String, String> {
    let output = Command::new("nmcli")
        .args(["-t", "-f", "NAME,DEVICE", "connection", "show", "--active"])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    
    for line in output_str.lines() {
        if !line.ends_with(":lo") && !line.is_empty() {
            if let Some(name) = line.split(':').next() {
                return Ok(name.to_string());
            }
        }
    }
    Err("No active network connection found via nmcli".to_string())
}

/// Start the dnscrypt-proxy service and route system DNS, using a single pkexec prompt
pub fn start_service(resolver: String, caching: bool, dnssec: bool) -> Result<String, String> {
    let conn_name = get_active_connection()?;
    let config_path = "/etc/dnscrypt-proxy/dnscrypt-proxy.toml";
    
    let cache_val = if caching { "true" } else { "false" };
    let dnssec_val = if dnssec { "true" } else { "false" };

    // Prepare config update commands
    let config_script = if resolver.is_empty() {
        format!(
            "sed -i -E \"s/^[# ]*server_names[ ]*=.*/# server_names = ['cloudflare']/g\" {0} && sed -i -E \"s/^[# ]*cache[ ]*=.*/cache = {1}/g\" {0} && sed -i -E \"s/^[# ]*require_dnssec[ ]*=.*/require_dnssec = {2}/g\" {0} && sed -i -E \"s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g\" {0}",
            config_path, cache_val, dnssec_val
        )
    } else {
        format!(
            "sed -i -E \"s/^[# ]*server_names[ ]*=.*/server_names = ['{1}']/g\" {0} && sed -i -E \"s/^[# ]*cache[ ]*=.*/cache = {2}/g\" {0} && sed -i -E \"s/^[# ]*require_dnssec[ ]*=.*/require_dnssec = {3}/g\" {0} && sed -i -E \"s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g\" {0}",
            config_path, resolver, cache_val, dnssec_val
        )
    };

    // Combine all commands: Config -> Service -> NetworkManager
    let script = format!(
        "{} && systemctl start dnscrypt-proxy && nmcli connection modify '{}' ipv4.dns 127.0.0.1 ipv4.ignore-auto-dns yes && nmcli connection up '{}'",
        config_script, conn_name, conn_name
    );

    let output = Command::new("pkexec")
        .args(["bash", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to start service: {}", e))?;

    if output.status.success() {
        Ok("Service started successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to start service: {}", stderr))
    }
}

/// Stop the dnscrypt-proxy service and revert system DNS, using a single pkexec prompt
pub fn stop_service() -> Result<String, String> {
    let conn_name = get_active_connection().unwrap_or_default();
    
    let script = if conn_name.is_empty() {
        "systemctl stop dnscrypt-proxy".to_string()
    } else {
        format!(
            "systemctl stop dnscrypt-proxy && nmcli connection modify '{}' ipv4.ignore-auto-dns no && nmcli connection modify '{}' ipv4.dns '' && nmcli connection up '{}'",
            conn_name, conn_name, conn_name
        )
    };

    let output = Command::new("pkexec")
        .args(["bash", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to stop service: {}", e))?;

    if output.status.success() {
        Ok("Service stopped successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to stop service: {}", stderr))
    }
}

/// Restart the dnscrypt-proxy service using a single pkexec prompt
pub fn restart_service(resolver: String, caching: bool, dnssec: bool) -> Result<String, String> {
    let conn_name = get_active_connection().unwrap_or_default();
    let config_path = "/etc/dnscrypt-proxy/dnscrypt-proxy.toml";

    let cache_val = if caching { "true" } else { "false" };
    let dnssec_val = if dnssec { "true" } else { "false" };

    let config_script = if resolver.is_empty() {
        format!(
            "sed -i -E \"s/^[# ]*server_names[ ]*=.*/# server_names = ['cloudflare']/g\" {0} && sed -i -E \"s/^[# ]*cache[ ]*=.*/cache = {1}/g\" {0} && sed -i -E \"s/^[# ]*require_dnssec[ ]*=.*/require_dnssec = {2}/g\" {0} && sed -i -E \"s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g\" {0}",
            config_path, cache_val, dnssec_val
        )
    } else {
        format!(
            "sed -i -E \"s/^[# ]*server_names[ ]*=.*/server_names = ['{1}']/g\" {0} && sed -i -E \"s/^[# ]*cache[ ]*=.*/cache = {2}/g\" {0} && sed -i -E \"s/^[# ]*require_dnssec[ ]*=.*/require_dnssec = {3}/g\" {0} && sed -i -E \"s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g\" {0}",
            config_path, resolver, cache_val, dnssec_val
        )
    };

    let script = if conn_name.is_empty() {
        format!("{} && systemctl restart dnscrypt-proxy", config_script)
    } else {
        format!(
            "{} && systemctl restart dnscrypt-proxy && nmcli connection modify '{}' ipv4.dns 127.0.0.1 ipv4.ignore-auto-dns yes && nmcli connection up '{}'",
            config_script, conn_name, conn_name
        )
    };

    let output = Command::new("pkexec")
        .args(["bash", "-c", &script])
        .output()
        .map_err(|e| format!("Failed to restart service: {}", e))?;

    if output.status.success() {
        Ok("Service restarted successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to restart service: {}", stderr))
    }
}
