use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

pub const MAX_DOCUMENT_BYTES: usize = 10 * 1024 * 1024;
const MAX_ID_BYTES: usize = 512;
const MAX_GEOMETRY: f64 = 1.0e15;
const LAST_SCENE_FILE: &str = "last-scene.excalidraw";
const SCENE_EXTENSIONS: [&str; 2] = ["excalidraw", "json"];
const ELEMENT_TYPES: [&str; 12] = [
    "rectangle",
    "diamond",
    "ellipse",
    "line",
    "arrow",
    "freedraw",
    "text",
    "image",
    "iframe",
    "embeddable",
    "frame",
    "magicframe",
];
const IMAGE_MIME_TYPES: [&str; 9] = [
    "image/svg+xml",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/x-icon",
    "image/avif",
    "image/jfif",
];

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SaveDocumentRequest {
    pub contents: String,
    pub extension: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PersistDocumentRequest {
    pub contents: String,
}

#[derive(Debug, Serialize)]
pub struct OpenedDocument {
    pub name: String,
    pub contents: String,
}

pub fn validate_document_contents(contents: &str) -> Result<(), String> {
    if contents.len() > MAX_DOCUMENT_BYTES {
        return Err("Document exceeds the 10 MiB desktop limit.".to_owned());
    }

    let value: Value = serde_json::from_str(contents)
        .map_err(|error| format!("Invalid JSON document: {error}"))?;
    validate_scene(&value)
}

fn validate_scene(value: &Value) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| "The document root must be an object.".to_owned())?;

    if object.get("type").and_then(Value::as_str) != Some("excalidraw") {
        return Err("The document is not an Excalidraw scene.".to_owned());
    }

    let version = object
        .get("version")
        .and_then(Value::as_u64)
        .ok_or_else(|| "The document version must be an integer.".to_owned())?;
    if !(1..=2).contains(&version) {
        return Err("The document version is unsupported.".to_owned());
    }

    let elements = object
        .get("elements")
        .and_then(Value::as_array)
        .ok_or_else(|| "The document elements must be an array.".to_owned())?;
    for (index, element) in elements.iter().enumerate() {
        validate_element(element)
            .map_err(|error| format!("Invalid element at index {index}: {error}"))?;
    }

    if let Some(app_state) = object.get("appState") {
        if !app_state.is_object() {
            return Err("The document appState must be an object.".to_owned());
        }
    }

    if let Some(files) = object.get("files") {
        validate_files(files)?;
    }

    Ok(())
}

fn validate_element(value: &Value) -> Result<(), String> {
    let object = value
        .as_object()
        .ok_or_else(|| "an element must be a non-null object".to_owned())?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "an element id is required".to_owned())?;
    if id.is_empty() || id.len() > MAX_ID_BYTES || id.chars().any(char::is_control) {
        return Err("an element id is invalid".to_owned());
    }

    let element_type = object
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| "an element type is required".to_owned())?;
    if !ELEMENT_TYPES.contains(&element_type) {
        return Err(format!("unsupported element type {element_type:?}"));
    }

    for field in ["x", "y", "width", "height"] {
        let number = object
            .get(field)
            .and_then(Value::as_f64)
            .ok_or_else(|| format!("element {field} must be a number"))?;
        if !number.is_finite() || number.abs() > MAX_GEOMETRY {
            return Err(format!("element {field} is outside the supported range"));
        }
    }

    if matches!(element_type, "line" | "arrow" | "freedraw") {
        let points = object
            .get("points")
            .and_then(Value::as_array)
            .ok_or_else(|| "linear elements need a points array".to_owned())?;
        if points.is_empty() {
            return Err("linear elements need at least one point".to_owned());
        }
        for point in points {
            let point = point
                .as_array()
                .ok_or_else(|| "element points must be arrays".to_owned())?;
            if point.len() < 2 {
                return Err("element points need x and y".to_owned());
            }
            for coordinate in point.iter().take(2) {
                let coordinate = coordinate
                    .as_f64()
                    .ok_or_else(|| "element point coordinates must be numbers".to_owned())?;
                if !coordinate.is_finite() || coordinate.abs() > MAX_GEOMETRY {
                    return Err("element point is outside the supported range".to_owned());
                }
            }
        }
    }

    if element_type == "text" && object.get("text").and_then(Value::as_str).is_none() {
        return Err("text elements need text".to_owned());
    }

    // A pending/failed image may legitimately have no fileId yet.
    if element_type == "image" {
        if let Some(file_id) = object.get("fileId").filter(|value| !value.is_null()) {
            if file_id
                .as_str()
                .is_none_or(|id| id.is_empty() || id.len() > MAX_ID_BYTES)
            {
                return Err("image fileId is invalid".to_owned());
            }
        }
    }

    Ok(())
}

fn validate_files(value: &Value) -> Result<(), String> {
    let files = value
        .as_object()
        .ok_or_else(|| "The document files must be an object.".to_owned())?;

    for (file_key, file_value) in files {
        if file_key.is_empty() || file_key.len() > MAX_ID_BYTES {
            return Err("A file id is invalid.".to_owned());
        }
        let file = file_value
            .as_object()
            .ok_or_else(|| "Each file entry must be a non-null object.".to_owned())?;
        let data_url = file
            .get("dataURL")
            .and_then(Value::as_str)
            .ok_or_else(|| "Each file entry needs an embedded dataURL.".to_owned())?;
        validate_image_data_url(data_url)?;

        if let Some(mime_value) = file.get("mimeType") {
            let mime_type = mime_value
                .as_str()
                .ok_or("A file mimeType must be a string.")?;
            let expected = data_url
                .split_once(':')
                .and_then(|(_, rest)| rest.split_once(';'))
                .map(|(mime, _)| mime);
            if expected != Some(mime_type) || !IMAGE_MIME_TYPES.contains(&mime_type) {
                return Err("A file mimeType does not match its embedded image.".to_owned());
            }
        }

        for key in ["url", "src", "href"] {
            if file.contains_key(key) {
                return Err("Remote file references are not allowed.".to_owned());
            }
        }
    }

    Ok(())
}

// Validate the data URL envelope only, not the decoded image. SVG is supported
// for Excalidraw's image consumer; this does not parse or sanitize SVG content.
fn validate_image_data_url(data_url: &str) -> Result<(), String> {
    let (header, payload) = data_url
        .split_once(',')
        .ok_or_else(|| "An image dataURL is malformed.".to_owned())?;
    let mime = header
        .strip_prefix("data:")
        .and_then(|part| part.strip_suffix(";base64"))
        .unwrap_or_default();
    if !IMAGE_MIME_TYPES.contains(&mime) {
        return Err("Only supported embedded image dataURLs are allowed.".to_owned());
    }
    if payload.is_empty() || payload.len() % 4 != 0 {
        return Err("An image dataURL has invalid base64 padding.".to_owned());
    }

    let mut padding_started = false;
    let mut padding = 0;
    for byte in payload.bytes() {
        if byte == b'=' {
            padding_started = true;
            padding += 1;
            if padding > 2 {
                return Err("An image dataURL has invalid base64 padding.".to_owned());
            }
        } else if padding_started || !byte.is_ascii_alphanumeric() && !matches!(byte, b'+' | b'/') {
            return Err("An image dataURL has invalid base64 content.".to_owned());
        }
    }
    Ok(())
}

pub fn validate_extension(extension: &str) -> Result<&str, String> {
    match extension {
        "excalidraw" | "json" => Ok(extension),
        _ => Err("Only .excalidraw and .json documents are supported.".to_owned()),
    }
}

pub fn validate_open_path(path: &Path) -> Result<PathBuf, String> {
    validate_path_shape(path, None)?;
    let canonical = fs::canonicalize(path).map_err(|error| format_path_error("open", error))?;
    validate_path_shape(&canonical, None)?;
    reject_link_ancestors(&canonical)?;
    let metadata = fs::metadata(&canonical).map_err(|error| format_path_error("open", error))?;
    if !metadata.is_file() {
        return Err("The selected document is not a regular file.".to_owned());
    }
    Ok(canonical)
}

pub fn validate_save_path(path: &Path, extension: &str) -> Result<PathBuf, String> {
    let extension = validate_extension(extension)?;
    validate_path_shape(path, Some(extension))?;

    let canonical = if path.exists() {
        let metadata =
            fs::symlink_metadata(path).map_err(|error| format_path_error("save", error))?;
        if !metadata.is_file() {
            return Err("The selected save destination is not a regular file.".to_owned());
        }
        fs::canonicalize(path).map_err(|error| format_path_error("save", error))?
    } else {
        let parent = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .ok_or_else(|| "The selected save destination has no parent.".to_owned())?;
        let canonical_parent =
            fs::canonicalize(parent).map_err(|error| format_path_error("save", error))?;
        canonical_parent.join(
            path.file_name()
                .ok_or_else(|| "The selected save destination has no file name.".to_owned())?,
        )
    };

    validate_path_shape(&canonical, Some(extension))?;
    reject_link_ancestors(&canonical)?;
    if canonical.exists() {
        let metadata =
            fs::symlink_metadata(&canonical).map_err(|error| format_path_error("save", error))?;
        if !metadata.is_file() {
            return Err("The selected save destination is not a regular file.".to_owned());
        }
    }
    Ok(canonical)
}

fn validate_path_shape(path: &Path, expected_extension: Option<&str>) -> Result<(), String> {
    if !path.is_absolute() {
        return Err("Document paths must be absolute.".to_owned());
    }
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("Path traversal is not allowed.".to_owned());
    }

    validate_local_path(path)?;

    if let Some(expected_extension) = expected_extension {
        let actual = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase());
        if actual.as_deref() != Some(expected_extension) {
            return Err("The selected path has an unsupported extension.".to_owned());
        }
    } else if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_none_or(|extension| {
            !SCENE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
        })
    {
        return Err("Only .excalidraw and .json documents are supported.".to_owned());
    }

    reject_link_ancestors(path)
}

fn validate_local_path(path: &Path) -> Result<(), String> {
    if !path.is_absolute()
        || path
            .components()
            .any(|part| matches!(part, Component::ParentDir))
    {
        return Err("Only absolute paths without traversal are allowed.".to_owned());
    }
    for part in path.components() {
        if let Component::Normal(name) = part {
            let name = name.to_str().ok_or("Document paths must be valid UTF-8.")?;
            if name.contains(':') || name.chars().any(char::is_control) {
                return Err("Alternate streams and control characters are not allowed.".to_owned());
            }
            #[cfg(windows)]
            {
                let stem = name
                    .split('.')
                    .next()
                    .unwrap_or_default()
                    .to_ascii_uppercase();
                let reserved = matches!(
                    stem.as_str(),
                    "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
                ) || ((stem.starts_with("COM") || stem.starts_with("LPT"))
                    && matches!(
                        stem.get(3..),
                        Some("1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³")
                    ));
                if reserved
                    || name.ends_with(['.', ' '])
                    || name.contains(['<', '>', '"', '|', '?', '*'])
                {
                    return Err(
                        "Windows device and ambiguous file names are not allowed.".to_owned()
                    );
                }
            }
        }
    }
    #[cfg(windows)]
    {
        use std::path::Prefix;
        let drive = match path.components().next() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => drive,
                _ => return Err("Network and device paths are not allowed.".to_owned()),
            },
            _ => return Err("A local drive path is required.".to_owned()),
        };
        #[link(name = "kernel32")]
        extern "system" {
            fn GetDriveTypeW(root: *const u16) -> u32;
        }
        let root = [u16::from(drive), b':' as u16, b'\\' as u16, 0];
        // Fixed, removable, optical and RAM disks only (including mapped-drive rejection).
        if !matches!(unsafe { GetDriveTypeW(root.as_ptr()) }, 2 | 3 | 5 | 6) {
            return Err("The selected drive is not local.".to_owned());
        }
    }
    #[cfg(not(windows))]
    if path.as_os_str().to_string_lossy().starts_with("//") {
        return Err("Network paths are not allowed.".to_owned());
    }
    Ok(())
}

fn reject_link_ancestors(path: &Path) -> Result<(), String> {
    let mut current = Some(path);
    while let Some(candidate) = current {
        match fs::symlink_metadata(candidate) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() || is_reparse_point(&metadata) {
                    return Err("Symlink and reparse-point paths are not allowed.".to_owned());
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(format_path_error("inspect", error)),
        }
        let parent = candidate.parent();
        current = parent.filter(|parent| *parent != candidate);
    }
    Ok(())
}

#[cfg(windows)]
fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

fn format_path_error(action: &str, error: io::Error) -> String {
    format!("Unable to {action} the selected document: {error}")
}

pub fn read_and_validate(path: &Path) -> Result<String, String> {
    let metadata = fs::symlink_metadata(path).map_err(|error| format_path_error("read", error))?;
    if metadata.file_type().is_symlink() || is_reparse_point(&metadata) || !metadata.is_file() {
        return Err("The selected document is not a regular file.".to_owned());
    }

    let file = File::open(path).map_err(|error| format_path_error("read", error))?;
    let mut bytes = Vec::new();
    file.take((MAX_DOCUMENT_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format_path_error("read", error))?;
    if bytes.len() > MAX_DOCUMENT_BYTES {
        return Err("Document exceeds the 10 MiB desktop limit.".to_owned());
    }
    let contents = String::from_utf8(bytes)
        .map_err(|_| "The selected document is not valid UTF-8.".to_owned())?;
    validate_document_contents(&contents)?;
    Ok(contents)
}

pub fn persist_to_path(path: &Path, contents: &str) -> Result<(), String> {
    validate_document_contents(contents)?;
    validate_path_shape(path, Some("excalidraw"))?;
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "The persistence path has no parent.".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format_path_error("create persistence directory", error))?;
    reject_link_ancestors(parent)?;
    validate_path_shape(path, Some("excalidraw"))?;
    atomic_write(path, contents.as_bytes())
}

pub fn atomic_write_document(path: &Path, contents: &str) -> Result<(), String> {
    validate_document_contents(contents)?;
    atomic_write(path, contents.as_bytes())
}

pub fn read_persisted(path: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(_) => read_and_validate(path).map(Some),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format_path_error("inspect persistence", error)),
    }
}

pub fn fixed_persistence_path(app_data_dir: &Path) -> Result<PathBuf, String> {
    if !app_data_dir.is_absolute() {
        return Err("The application data directory must be absolute.".to_owned());
    }
    let path = app_data_dir.join(LAST_SCENE_FILE);
    validate_path_shape(&path, Some("excalidraw"))?;
    fs::create_dir_all(app_data_dir)
        .map_err(|error| format_path_error("create application data directory", error))?;
    reject_link_ancestors(app_data_dir)?;
    validate_path_shape(&path, Some("excalidraw"))?;
    Ok(path)
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "The atomic write path has no parent.".to_owned())?;
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The atomic write path has no valid file name.".to_owned())?;
    let pid = std::process::id();
    let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temporary_path = parent.join(format!(".{file_name}.{pid}.{counter}.tmp"));

    atomic_write_with_temp_path(path, &temporary_path, bytes)
}

fn atomic_write_with_temp_path(
    path: &Path,
    temporary_path: &Path,
    bytes: &[u8],
) -> Result<(), String> {
    // Only clean up a temporary file after create_new establishes ownership.
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(temporary_path)
        .map_err(|error| format_path_error("create temporary document", error))?;
    let result = (|| {
        file.write_all(bytes)
            .map_err(|error| format_path_error("write document", error))?;
        file.sync_all()
            .map_err(|error| format_path_error("flush document", error))
    })();
    // Release the handle before replacement or cleanup, including on Windows.
    drop(file);
    let result = result.and_then(|()| replace_file(temporary_path, path));

    if result.is_err() {
        let _ = fs::remove_file(temporary_path);
    }
    result
}

#[cfg(windows)]
fn replace_file(temporary_path: &Path, destination: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
        fn ReplaceFileW(
            replaced: *const u16,
            replacement: *const u16,
            backup: *const u16,
            flags: u32,
            exclude: *mut std::ffi::c_void,
            reserved: *mut std::ffi::c_void,
        ) -> i32;
    }

    let temporary = wide(temporary_path);
    let destination = wide(destination);
    let replaced = unsafe {
        ReplaceFileW(
            destination.as_ptr(),
            temporary.as_ptr(),
            std::ptr::null(),
            0,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if replaced != 0 {
        return Ok(());
    }

    let error = io::Error::last_os_error();
    if error.kind() != io::ErrorKind::NotFound {
        return Err(format_path_error("atomically replace document", error));
    }

    const MOVEFILE_WRITE_THROUGH: u32 = 0x00000008;
    let moved = unsafe {
        MoveFileExW(
            temporary.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        Err(format_path_error(
            "atomically save document",
            io::Error::last_os_error(),
        ))
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(temporary_path: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(temporary_path, destination)
        .map_err(|error| format_path_error("atomically save document", error))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join("document-tests");
            fs::create_dir_all(&root).expect("test target directory should be available");
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock should be after epoch")
                .as_nanos();
            let path = root.join(format!("{}-{unique}", std::process::id()));
            fs::create_dir(&path).expect("test directory should be unique");
            Self(path)
        }

        fn path(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn scene() -> String {
        r#"{"type":"excalidraw","version":2,"elements":[{"id":"box","type":"rectangle","x":0,"y":0,"width":120,"height":80}],"appState":{},"files":{}}"#.to_owned()
    }

    #[test]
    fn validates_scene_shape_and_rejects_library_or_bad_elements() {
        assert!(validate_document_contents(&scene()).is_ok());
        assert!(validate_document_contents(
            r#"{"type":"excalidrawlib","version":2,"elements":[]}"#
        )
        .is_err());
        assert!(validate_document_contents(
            r#"{"type":"excalidraw","version":2,"elements":[null]}"#
        )
        .is_err());
        assert!(validate_document_contents(r#"{"type":"excalidraw","version":2,"elements":[{"id":"x","type":"unknown","x":0,"y":0,"width":1,"height":1}]}"#).is_err());
    }

    #[test]
    fn validates_embedded_files_and_rejects_remote_references() {
        let valid = r#"{"type":"excalidraw","version":2,"elements":[],"files":{"image":{"mimeType":"image/png","dataURL":"data:image/png;base64,AAAA"}}}"#;
        assert!(validate_document_contents(valid).is_ok());
        let remote = r#"{"type":"excalidraw","version":2,"elements":[],"files":{"image":{"dataURL":"https://example.test/image.png"}}}"#;
        assert!(validate_document_contents(remote).is_err());
        let svg = r#"{"type":"excalidraw","version":2,"elements":[],"files":{"image":{"mimeType":"image/svg+xml","dataURL":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4="}}}"#;
        assert!(validate_document_contents(svg).is_ok());

        let mut mismatched: Value = serde_json::from_str(svg).unwrap();
        mismatched["files"]["image"]["mimeType"] = Value::String("image/png".to_owned());
        assert!(validate_document_contents(&mismatched.to_string()).is_err());

        for key in ["url", "src", "href"] {
            let mut remote: Value = serde_json::from_str(svg).unwrap();
            remote["files"]["image"][key] =
                Value::String("https://example.test/image.svg".to_owned());
            assert!(validate_document_contents(&remote.to_string()).is_err());
        }
    }

    #[test]
    fn rejects_unsupported_or_malformed_image_data_urls() {
        for data_url in [
            "data:text/html;base64,AAAA",
            "data:image/svg+xml,<svg/>",
            "data:image/svg+xml;base64,",
            "data:image/svg+xml;base64,AAA",
            "data:image/svg+xml;base64,AA=A",
            "data:image/svg+xml;base64,A===",
            "data:image/svg+xml;base64,AA?A",
        ] {
            assert!(validate_image_data_url(data_url).is_err(), "{data_url}");
        }
    }

    #[test]
    fn rejects_unknown_command_request_fields() {
        assert!(serde_json::from_str::<SaveDocumentRequest>(
            r#"{"contents":"scene","extension":"json","path":"ignored"}"#
        )
        .is_err());
        assert!(serde_json::from_str::<PersistDocumentRequest>(
            r#"{"contents":"scene","destination":"ignored"}"#
        )
        .is_err());
    }

    #[test]
    fn validates_extensions_and_path_traversal() {
        assert_eq!(validate_extension("json"), Ok("json"));
        assert!(validate_extension("excalidrawlib").is_err());

        let directory = TestDirectory::new();
        let valid = directory.path("drawing.json");
        assert!(
            validate_save_path(&valid, "json").is_ok(),
            "save path validation: {:?}",
            validate_save_path(&valid, "json")
        );
        assert!(validate_save_path(&directory.path("drawing.excalidrawlib"), "json").is_err());
        let traversal = directory.path("..").join("drawing.json");
        assert_eq!(
            validate_save_path(&traversal, "json"),
            Err("Path traversal is not allowed.".to_owned())
        );

        #[cfg(windows)]
        assert!(validate_save_path(&directory.path("drawing.json:secret"), "json").is_err());
    }

    #[test]
    fn rejects_oversized_multibyte_documents() {
        let contents = "😀".repeat(MAX_DOCUMENT_BYTES / "😀".len() + 1);
        assert!(contents.len() > MAX_DOCUMENT_BYTES);
        assert!(validate_document_contents(&contents).is_err());
    }

    #[test]
    fn bounded_read_rejects_oversized_file() {
        let directory = TestDirectory::new();
        let path = directory.path("oversized.json");
        let bytes = vec![b' '; MAX_DOCUMENT_BYTES + 1];
        fs::write(&path, bytes).expect("test document should be writable");
        assert!(read_and_validate(&path).is_err());
    }

    #[test]
    fn persistence_roundtrip_and_corrupt_input() {
        let directory = TestDirectory::new();
        let path = directory.path(LAST_SCENE_FILE);
        persist_to_path(&path, &scene()).expect("valid persistence should succeed");
        assert_eq!(
            read_persisted(&path).expect("read should succeed"),
            Some(scene())
        );

        let updated = scene().replace("\"x\":0", "\"x\":42");
        persist_to_path(&path, &updated).expect("existing persistence should be replaced");
        assert_eq!(read_persisted(&path).unwrap(), Some(updated));

        fs::write(&path, b"not json").expect("test should corrupt persisted file");
        assert!(read_persisted(&path).is_err());
    }

    #[test]
    fn rejected_persistence_paths_do_not_create_directories() {
        let directory = TestDirectory::new();
        let invalid_extension = directory.path("invalid-extension").join("drawing.json");
        assert!(persist_to_path(&invalid_extension, &scene()).is_err());
        assert!(!directory.path("invalid-extension").exists());

        let traversal = directory.path("traversal").join("..").join("app-data");
        assert!(persist_to_path(&traversal.join(LAST_SCENE_FILE), &scene()).is_err());
        assert!(fixed_persistence_path(&traversal).is_err());
        assert!(!directory.path("traversal").exists());
        assert!(!directory.path("app-data").exists());
    }

    #[cfg(unix)]
    #[test]
    fn rejected_persistence_symlinks_do_not_create_directories() {
        use std::os::unix::fs::symlink;

        let directory = TestDirectory::new();
        let target = directory.path("target");
        fs::create_dir(&target).unwrap();
        let link = directory.path("link");
        symlink(&target, &link).unwrap();
        let app_data_dir = link.join("app-data");

        assert!(persist_to_path(&app_data_dir.join(LAST_SCENE_FILE), &scene()).is_err());
        assert!(!target.join("app-data").exists());
        assert!(fixed_persistence_path(&app_data_dir).is_err());
        assert!(!target.join("app-data").exists());
    }

    #[test]
    fn atomic_write_preserves_preexisting_temporary_file_on_collision() {
        let directory = TestDirectory::new();
        let path = directory.path("drawing.json");
        let temporary_path = directory.path(".drawing.json.collision.tmp");
        fs::write(&path, b"original document").unwrap();
        fs::write(&temporary_path, b"preexisting temporary file").unwrap();

        let error =
            atomic_write_with_temp_path(&path, &temporary_path, b"replacement").unwrap_err();
        assert!(error.contains("create temporary document"), "{error}");
        assert_eq!(fs::read(&path).unwrap(), b"original document");
        assert_eq!(
            fs::read(&temporary_path).expect("a collision must not delete someone else's file"),
            b"preexisting temporary file"
        );
    }

    #[test]
    fn failed_atomic_replace_removes_its_temporary_file() {
        let directory = TestDirectory::new();
        let path = directory.path("drawing.json");
        fs::create_dir(&path).unwrap();
        fs::write(path.join("keep"), b"keep").unwrap();
        let temporary_path = directory.path(".drawing.json.failed.tmp");

        let error =
            atomic_write_with_temp_path(&path, &temporary_path, b"replacement").unwrap_err();
        assert!(error.contains("atomically"), "{error}");
        assert_eq!(fs::read(path.join("keep")).unwrap(), b"keep");
        assert!(!temporary_path.exists());
    }

    #[test]
    fn rejected_persistence_does_not_change_original() {
        let directory = TestDirectory::new();
        let path = directory.path(LAST_SCENE_FILE);
        persist_to_path(&path, &scene()).expect("valid persistence should succeed");
        let original = fs::read(&path).expect("original should be readable");
        assert!(persist_to_path(&path, "{}").is_err());
        assert_eq!(
            fs::read(&path).expect("original should remain readable"),
            original
        );
    }
}
