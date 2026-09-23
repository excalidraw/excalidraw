fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_document",
            "save_document",
            "restore_document",
            "persist_document",
        ]),
    ))
    .expect("failed to build Tauri application");
}
