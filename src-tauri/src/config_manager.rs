use serde::{Deserialize, Serialize};
use std::fs;

const CONFIG_PATH: &str = "/etc/dnscrypt-proxy/dnscrypt-proxy.toml";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DnsConfig {
    pub server_names: Vec<String>,
    pub listen_addresses: Vec<String>,
    pub cache: Option<bool>,
    pub require_dnssec: Option<bool>,
}

/// Read the current dnscrypt-proxy configuration from TOML file
pub fn read_config() -> Result<DnsConfig, String> {
    let content = fs::read_to_string(CONFIG_PATH)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let table: toml::Value = content
        .parse()
        .map_err(|e| format!("Failed to parse TOML: {}", e))?;

    let server_names = table
        .get("server_names")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let listen_addresses = table
        .get("listen_addresses")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_else(|| vec!["127.0.0.1:53".to_string()]);

    let cache = table.get("cache").and_then(|v| v.as_bool());
    let require_dnssec = table.get("require_dnssec").and_then(|v| v.as_bool());

    Ok(DnsConfig {
        server_names,
        listen_addresses,
        cache,
        require_dnssec,
    })
}
