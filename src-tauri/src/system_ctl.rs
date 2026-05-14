use std::process::Command;

const DNSCRYPT_CONFIG_PATH: &str = "/etc/dnscrypt-proxy/dnscrypt-proxy.toml";

const ALLOWED_RESOLVERS: &[&str] = &[
    "",
    "cloudflare",
    "google",
    "quad9",
    "adguard",
    "nextdns",
    "cisco",
    "mullvad-doh",
    "cleanbrowsing-adult",
    "doh.tiar.app",
];

pub fn validate_resolver(resolver: &str) -> Result<(), String> {
    if ALLOWED_RESOLVERS.contains(&resolver) {
        Ok(())
    } else {
        Err(format!("Unsupported resolver: {}", resolver))
    }
}

fn run_command(program: &str, args: &[&str]) -> Result<(), String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", program, e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(format!("{} failed: {}", program, stderr))
    }
}

fn is_root() -> bool {
    Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|uid| uid.trim() == "0")
        .unwrap_or(false)
}

/// Check if dnscrypt-proxy service is active
pub fn get_status() -> Result<String, String> {
    let output = Command::new("systemctl")
        .args(["is-active", "dnscrypt-proxy"])
        .output()
        .map_err(|e| format!("Failed to execute systemctl: {}", e))?;

    let status = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(status)
}

fn get_active_connections() -> Result<Vec<String>, String> {
    let output = Command::new("nmcli")
        .args(["-t", "-f", "UUID,DEVICE", "connection", "show", "--active"])
        .output()
        .map_err(|e| format!("Failed to run nmcli: {}", e))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    let mut connections = Vec::new();

    for line in output_str.lines() {
        if !line.ends_with(":lo") && !line.is_empty() {
            if let Some(name) = line.split(':').next() {
                connections.push(name.to_string());
            }
        }
    }

    if connections.is_empty() {
        Err("No active network connection found via nmcli".to_string())
    } else {
        Ok(connections)
    }
}

fn parse_bool_arg(value: &str, name: &str) -> Result<bool, String> {
    match value {
        "true" => Ok(true),
        "false" => Ok(false),
        _ => Err(format!("Invalid {} value: {}", name, value)),
    }
}

fn update_dnscrypt_config(resolver: &str, caching: bool, dnssec: bool) -> Result<(), String> {
    validate_resolver(resolver)?;

    if resolver.is_empty() {
        run_command(
            "sed",
            &[
                "-i",
                "-E",
                "s/^[# ]*server_names[ ]*=.*/# server_names = ['cloudflare']/g",
                DNSCRYPT_CONFIG_PATH,
            ],
        )?;
    } else {
        let server_names = format!("server_names = ['{}']", resolver);
        let expression = format!("s/^[# ]*server_names[ ]*=.*/{}/g", server_names);
        run_command("sed", &["-i", "-E", &expression, DNSCRYPT_CONFIG_PATH])?;
    }

    let cache_value = if caching { "true" } else { "false" };
    let cache_expression = format!("s/^[# ]*cache[ ]*=.*/cache = {}/g", cache_value);
    run_command(
        "sed",
        &["-i", "-E", &cache_expression, DNSCRYPT_CONFIG_PATH],
    )?;

    let dnssec_value = if dnssec { "true" } else { "false" };
    let dnssec_expression = format!(
        "s/^[# ]*require_dnssec[ ]*=.*/require_dnssec = {}/g",
        dnssec_value
    );
    run_command(
        "sed",
        &["-i", "-E", &dnssec_expression, DNSCRYPT_CONFIG_PATH],
    )?;

    run_command(
        "sed",
        &[
            "-i",
            "-E",
            "s/^[# ]*file[ ]*=[ ]*'query.log'/file = '\\/var\\/log\\/dnscrypt-query.log'/g",
            DNSCRYPT_CONFIG_PATH,
        ],
    )
}

fn set_connections_dns_to_localhost(connections: &[String]) -> Result<(), String> {
    for conn in connections {
        run_command(
            "nmcli",
            &[
                "connection",
                "modify",
                conn,
                "ipv4.dns",
                "127.0.0.1",
                "ipv4.ignore-auto-dns",
                "yes",
                "ipv6.ignore-auto-dns",
                "yes",
            ],
        )?;
        run_command("nmcli", &["--wait", "15", "connection", "up", conn])?;
    }

    Ok(())
}

fn restore_connections_dns(connections: &[String]) -> Result<(), String> {
    for conn in connections {
        run_command(
            "nmcli",
            &[
                "connection",
                "modify",
                conn,
                "ipv4.ignore-auto-dns",
                "no",
                "ipv6.ignore-auto-dns",
                "no",
            ],
        )?;
        run_command("nmcli", &["connection", "modify", conn, "ipv4.dns", ""])?;
        run_command("nmcli", &["--wait", "15", "connection", "up", conn])?;
    }

    Ok(())
}

fn execute_system_action(
    action: &str,
    resolver: &str,
    caching: bool,
    dnssec: bool,
    connections: &[String],
) -> Result<String, String> {
    match action {
        "start" => {
            update_dnscrypt_config(resolver, caching, dnssec)?;
            run_command("systemctl", &["enable", "--now", "dnscrypt-proxy"])?;
            set_connections_dns_to_localhost(connections)?;
            Ok("Service started successfully".to_string())
        }
        "stop" => {
            run_command("systemctl", &["disable", "--now", "dnscrypt-proxy"])?;
            restore_connections_dns(connections)?;
            Ok("Service stopped successfully".to_string())
        }
        "restart" => {
            update_dnscrypt_config(resolver, caching, dnssec)?;
            run_command("systemctl", &["restart", "dnscrypt-proxy"])?;
            set_connections_dns_to_localhost(connections)?;
            Ok("Service restarted successfully".to_string())
        }
        _ => Err(format!("Unsupported helper action: {}", action)),
    }
}

pub fn run_system_helper(args: &[String]) -> Result<String, String> {
    if !is_root() {
        return Err("CryptShield system helper must run as root".to_string());
    }

    let action = args
        .first()
        .ok_or_else(|| "Missing helper action".to_string())?
        .as_str();

    if action == "stop" {
        return execute_system_action("stop", "", true, true, &args[1..]);
    }

    if args.len() < 4 {
        return Err("Missing helper arguments".to_string());
    }

    let resolver = args[1].as_str();
    let caching = parse_bool_arg(&args[2], "caching")?;
    let dnssec = parse_bool_arg(&args[3], "dnssec")?;
    execute_system_action(action, resolver, caching, dnssec, &args[4..])
}

fn pkexec_system_helper_args(
    action: &str,
    resolver: &str,
    caching: bool,
    dnssec: bool,
    connections: &[String],
) -> Result<Vec<String>, String> {
    let helper_path = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve CryptShield helper path: {}", e))?;

    let mut args = vec![
        helper_path
            .to_str()
            .ok_or_else(|| "CryptShield helper path is not valid UTF-8".to_string())?
            .to_string(),
        "--system-helper".to_string(),
        action.to_string(),
    ];

    if action != "stop" {
        args.push(resolver.to_string());
        args.push(if caching { "true" } else { "false" }.to_string());
        args.push(if dnssec { "true" } else { "false" }.to_string());
    }

    args.extend(connections.iter().cloned());
    Ok(args)
}

fn run_privileged_dnscrypt_action(
    action_name: &str,
    service_action: &str,
    resolver: &str,
    caching: bool,
    dnssec: bool,
    connections: &[String],
) -> Result<String, String> {
    validate_resolver(resolver)?;
    let action = match service_action {
        "enable --now" => "start",
        "restart" => "restart",
        _ => return Err(format!("Unsupported service action: {}", service_action)),
    };
    let args = pkexec_system_helper_args(action, resolver, caching, dnssec, connections)?;

    let output = Command::new("pkexec")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to {} service: {}", action_name, e))?;

    if output.status.success() {
        Ok(format!("Service {} successfully", action_name))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to {} service: {}", action_name, stderr))
    }
}

fn run_privileged_stop_action(connections: &[String]) -> Result<String, String> {
    let args = pkexec_system_helper_args("stop", "", true, true, connections)?;

    let output = Command::new("pkexec")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to stop service: {}", e))?;

    if output.status.success() {
        Ok("Service stopped successfully".to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed to stop service: {}", stderr))
    }
}

/// Start the dnscrypt-proxy service and route system DNS, using a single pkexec prompt
pub fn start_service(resolver: String, caching: bool, dnssec: bool) -> Result<String, String> {
    let connections = get_active_connections()?;
    run_privileged_dnscrypt_action(
        "started",
        "enable --now",
        &resolver,
        caching,
        dnssec,
        &connections,
    )
}

/// Stop the dnscrypt-proxy service and revert system DNS, using a single pkexec prompt
pub fn stop_service() -> Result<String, String> {
    let connections = get_active_connections().unwrap_or_default();
    run_privileged_stop_action(&connections)
}

/// Restart the dnscrypt-proxy service using a single pkexec prompt
pub fn restart_service(resolver: String, caching: bool, dnssec: bool) -> Result<String, String> {
    let connections = get_active_connections().unwrap_or_default();
    run_privileged_dnscrypt_action(
        "restarted",
        "restart",
        &resolver,
        caching,
        dnssec,
        &connections,
    )
}
