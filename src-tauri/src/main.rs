#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{collections::HashSet, path::{Path, PathBuf}, sync::Mutex};
use tauri::{Emitter, Manager, State};

const MAX_DOCUMENT: u64 = 20 * 1024 * 1024;
const MAX_IMAGE: u64 = 30 * 1024 * 1024;
#[derive(Default)]
struct ReaderState { opened: Mutex<HashSet<PathBuf>> }
#[derive(Serialize)]
struct Document { path: String, name: String, content: String, modified: u64 }
#[derive(Serialize)]
struct Link { kind: &'static str, target: String }
fn ext(path: &Path) -> String { path.extension().unwrap_or_default().to_string_lossy().to_lowercase() }
fn supported(path: &Path) -> bool { matches!(ext(path).as_str(), "md" | "markdown" | "mdown" | "mkd" | "txt") }
fn error(e: impl std::fmt::Display) -> String { e.to_string() }
fn prefs_path() -> Result<PathBuf, String> {
    Ok(std::env::current_exe().map_err(error)?.parent().ok_or("Cannot locate the portable app folder")?.join("frostmark-settings.json"))
}
fn checked_document(state: &ReaderState, path: &str) -> Result<PathBuf, String> {
    let path = std::fs::canonicalize(path).map_err(error)?;
    if !state.opened.lock().map_err(error)?.contains(&path) { return Err("Open this document first".into()); }
    Ok(path)
}
#[tauri::command]
fn open_document(state: State<'_, ReaderState>, path: String) -> Result<Document, String> {
    let path = std::fs::canonicalize(path).map_err(error)?;
    if !supported(&path) { return Err("Choose a Markdown or plain-text file".into()); }
    let meta = std::fs::metadata(&path).map_err(error)?;
    if !meta.is_file() || meta.len() > MAX_DOCUMENT { return Err("Documents must be regular files smaller than 20 MB".into()); }
    let bytes = std::fs::read(&path).map_err(error)?;
    let content = if bytes.starts_with(&[0xff, 0xfe]) || bytes.starts_with(&[0xfe, 0xff]) {
        let little = bytes[0] == 0xff;
        if (bytes.len() - 2) % 2 != 0 { return Err("Invalid UTF-16 document".into()); }
        let units: Vec<u16> = bytes[2..].chunks_exact(2).map(|b| if little {u16::from_le_bytes([b[0],b[1]])} else {u16::from_be_bytes([b[0],b[1]])}).collect();
        String::from_utf16(&units).map_err(error)?
    } else { String::from_utf8(bytes).map_err(|_| "This file is not UTF-8 or BOM-marked UTF-16. Save it in UTF-8 and try again.".to_string())?.trim_start_matches('\u{feff}').to_string() };
    state.opened.lock().map_err(error)?.insert(path.clone());
    Ok(Document { name: path.file_name().unwrap_or_default().to_string_lossy().into(), path: path.to_string_lossy().into(), content, modified: meta.modified().ok().and_then(|d| d.duration_since(std::time::UNIX_EPOCH).ok()).map(|d|d.as_secs()).unwrap_or(0) })
}
#[tauri::command]
fn startup_files() -> Vec<String> { std::env::args().skip(1).filter(|p| supported(Path::new(p)) && Path::new(p).is_file()).collect() }
#[tauri::command]
fn load_preferences() -> Result<Option<serde_json::Value>, String> {
    let path = prefs_path()?;
    if !path.exists() { return Ok(None); }
    let meta = std::fs::metadata(&path).map_err(error)?;
    if meta.len() > 1024 * 1024 { return Err("Settings file is too large".into()); }
    let text = std::fs::read_to_string(path).map_err(error)?;
    Ok(Some(serde_json::from_str(&text).map_err(error)?))
}
#[tauri::command]
fn save_preferences(preferences: serde_json::Value) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(&preferences).map_err(error)?;
    if bytes.len() > 1024 * 1024 { return Err("Settings are too large".into()); }
    // Keep a complete temporary copy in the same portable folder, then replace.
    let dest = prefs_path()?;
    let temp = dest.with_extension("json.tmp");
    std::fs::write(&temp, bytes).map_err(|e| format!("Cannot save settings beside the app. Move Frostmark to a writable folder. {e}"))?;
    std::fs::rename(&temp, &dest).map_err(error)
}
#[tauri::command]
fn resolve_link(state: State<'_, ReaderState>, document_path: String, href: String) -> Result<Link, String> {
    if let Some(anchor) = href.strip_prefix('#') { return Ok(Link {kind:"anchor", target:anchor.into()}); }
    if let Ok(url) = url::Url::parse(&href) {
        if matches!(url.scheme(), "https"|"http"|"mailto") { return Ok(Link {kind:"external",target:url.to_string()}); }
        // A Windows drive path can be parsed as a scheme, so handle it below.
        if !(href.len() > 2 && href.as_bytes()[1] == b':' && (href.as_bytes()[2] == b'\\' || href.as_bytes()[2] == b'/')) { return Err("This link type is disabled for safety".into()); }
    }
    let doc = checked_document(&state, &document_path)?;
    let base = url::Url::from_file_path(&doc).map_err(|_|"Invalid document path")?;
    let resolved = base.join(&href.replace('\\', "/")).map_err(error)?;
    let path = resolved.to_file_path().map_err(|_|"Only local documents can be opened")?;
    if !supported(&path) { return Err("Only Markdown and text links can be opened inside Frostmark".into()); }
    Ok(Link {kind:"document",target:path.to_string_lossy().into()})
}
#[tauri::command]
fn read_image(state: State<'_, ReaderState>, document_path: String, path: String) -> Result<String,String> {
    let doc = checked_document(&state, &document_path)?;
    let folder = doc.parent().ok_or("Missing document folder")?;
    let base = url::Url::from_file_path(&doc).map_err(|_|"Invalid document path")?;
    let resolved = base.join(&path.replace('\\', "/")).map_err(error)?;
    let image = std::fs::canonicalize(resolved.to_file_path().map_err(|_|"Only local images supported")?).map_err(error)?;
    if !image.starts_with(folder) { return Err("Images outside the document folder are blocked".into()); }
    let mime = match ext(&image).as_str() { "png"=>"image/png", "jpg"|"jpeg"=>"image/jpeg", "gif"=>"image/gif", "webp"=>"image/webp", "bmp"=>"image/bmp", "avif"=>"image/avif", _=>return Err("Unsupported image type (SVG is blocked for safety)".into()) };
    let meta = std::fs::metadata(&image).map_err(error)?;
    if !meta.is_file() || meta.len() > MAX_IMAGE { return Err("Image must be a regular file smaller than 30 MB".into()); }
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(std::fs::read(image).map_err(error)?)))
}
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(error)?;
    if !matches!(parsed.scheme(), "https"|"http"|"mailto") { return Err("Only web and email links are allowed".into()); }
    // explorer.exe receives one URL argument directly: no shell interpolation.
    std::process::Command::new("explorer.exe").arg(parsed.as_str()).spawn().map_err(error)?;
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app,args,_cwd| {
            let files: Vec<String> = args.into_iter().skip(1).filter(|p| supported(Path::new(p)) && Path::new(p).is_file()).collect();
            let _ = app.emit("open-files", files);
            if let Some(window) = app.get_webview_window("main") { let _ = window.unminimize(); let _ = window.set_focus(); }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(ReaderState::default())
        .setup(|app| {
            let directory = std::env::current_exe()?.parent().ok_or("Cannot locate portable folder")?.join("Frostmark.WebView2");
            std::fs::create_dir_all(&directory)?;
            tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Frostmark").inner_size(1200.0, 820.0).min_inner_size(680.0, 480.0)
                .data_directory(directory).build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![open_document,startup_files,load_preferences,save_preferences,read_image,resolve_link,open_external])
        .run(tauri::generate_context!()).expect("Unable to start Frostmark");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn document_extensions_are_restricted() { assert!(supported(Path::new("readme.MD"))); assert!(!supported(Path::new("file.exe"))); assert!(!supported(Path::new("file.html"))); }
    #[test] fn extensionless_files_are_rejected() { assert!(!supported(Path::new("README"))); }
}
