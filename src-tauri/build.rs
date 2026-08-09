fn main() {
    // Ensure resource directory exists for the Tauri build.
    // Gitignored and populated by bundle-mcp-server.mjs.
    // Without a placeholder, `tauri build` / `cargo test` fails if the script hasn't run.
    let path = std::path::Path::new("resources/mcp-server");
    if !path.exists() {
        std::fs::create_dir_all(path).ok();
        std::fs::write(path.join(".placeholder"), "").ok();
    }
    tauri_build::build()
}
