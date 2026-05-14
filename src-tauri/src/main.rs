// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) == Some("--system-helper") {
        match cryptshield_lib::run_system_helper(&args[2..]) {
            Ok(message) => {
                println!("{}", message);
                return;
            }
            Err(error) => {
                eprintln!("{}", error);
                std::process::exit(1);
            }
        }
    }

    cryptshield_lib::run()
}
