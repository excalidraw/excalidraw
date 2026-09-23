#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod document;

use document::{
    atomic_write_document, fixed_persistence_path, persist_to_path, read_and_validate,
    read_persisted, validate_open_path, validate_save_path, OpenedDocument, PersistDocumentRequest,
    SaveDocumentRequest,
};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::{DialogExt, FilePath};

struct DocumentState {
    io_lock: Mutex<()>,
}

// Native dialogs must not block the UI thread. All document operations share the
// same lock, including recovery reads, so an in-process read never sees a write.
async fn with_documents<T: Send + 'static>(
    app: AppHandle,
    operation: impl FnOnce(&AppHandle) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<DocumentState>();
        let _guard = state
            .io_lock
            .lock()
            .map_err(|_| "Document storage is unavailable after a failed operation.".to_owned())?;
        operation(&app)
    })
    .await
    .map_err(|_| "The document operation could not complete.".to_owned())?
}

fn selected_path(selected: Option<FilePath>) -> Result<Option<PathBuf>, String> {
    match selected {
        None => Ok(None),
        Some(FilePath::Path(path)) => Ok(Some(path)),
        Some(FilePath::Url(_)) => Err("Only local document paths are supported.".to_owned()),
    }
}

fn application_data_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("Unable to locate application data: {error}"))
}

#[tauri::command]
async fn open_document(app: AppHandle) -> Result<Option<OpenedDocument>, String> {
    with_documents(app, |app| {
        let selected = app
            .dialog()
            .file()
            .add_filter("Excalidraw scene", &["excalidraw", "json"])
            .blocking_pick_file();
        let Some(selected) = selected_path(selected)? else {
            return Ok(None);
        };
        let path = validate_open_path(&selected)?;
        let contents = read_and_validate(&path)?;
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "The selected document name is not valid UTF-8.".to_owned())?
            .to_owned();
        Ok(Some(OpenedDocument { name, contents }))
    })
    .await
}

#[tauri::command]
async fn save_document(app: AppHandle, request: SaveDocumentRequest) -> Result<bool, String> {
    with_documents(app, move |app| {
        document::validate_document_contents(&request.contents)?;
        document::validate_extension(&request.extension)?;

        let selected = app
            .dialog()
            .file()
            .add_filter("Excalidraw scene", &[request.extension.as_str()])
            .set_file_name(format!("drawing.{}", request.extension))
            .blocking_save_file();
        let Some(selected) = selected_path(selected)? else {
            return Ok(false);
        };
        let path = validate_save_path(&selected, &request.extension)?;
        atomic_write_document(&path, &request.contents)?;
        Ok(true)
    })
    .await
}

#[tauri::command]
async fn persist_document(app: AppHandle, request: PersistDocumentRequest) -> Result<(), String> {
    with_documents(app, move |app| {
        document::validate_document_contents(&request.contents)?;
        let path = fixed_persistence_path(&application_data_path(app)?)?;
        persist_to_path(&path, &request.contents)
    })
    .await
}

#[tauri::command]
async fn restore_document(app: AppHandle) -> Result<Option<String>, String> {
    with_documents(app, |app| {
        let path = fixed_persistence_path(&application_data_path(app)?)?;
        read_persisted(&path)
    })
    .await
}

fn navigation_allowed(url: &Url, dev_url: Option<&Url>) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    if url.host_str() == Some("localhost") && url.scheme() == "tauri" && url.port().is_none() {
        return true;
    }
    if url.host_str() == Some("tauri.localhost")
        && matches!(url.scheme(), "http" | "https")
        && url.port().is_none()
    {
        return true;
    }
    dev_url.is_some_and(|dev| {
        matches!(dev.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))
            && matches!(dev.scheme(), "http" | "https")
            && url.origin() == dev.origin()
    })
}

fn main() {
    let mut context = tauri::generate_context!();
    let windows = &mut context.config_mut().app.windows;
    assert!(
        windows.len() == 1 && windows[0].label == "main",
        "Expected one main window"
    );
    assert!(
        matches!(windows[0].url, WebviewUrl::App(_)),
        "The main window must load local assets"
    );
    // These hooks cannot be attached after a window is created.
    windows[0].create = false;

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(DocumentState {
            io_lock: Mutex::new(()),
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            persist_document,
            restore_document
        ])
        .setup(|app| {
            let dev_url = if cfg!(dev) {
                app.config().build.dev_url.clone()
            } else {
                None
            };
            if let Some(dev) = &dev_url {
                if !navigation_allowed(dev, Some(dev)) {
                    return Err("The development server must be loopback-local".into());
                }
            }
            WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_navigation(move |url| navigation_allowed(url, dev_url.as_ref()))
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(context)
        .expect("error while running Excalidraw desktop application");
}
