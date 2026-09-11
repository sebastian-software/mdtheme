use std::path::Path;

// Windows canonical paths have a verbatim prefix. Glob parsers interpret its
// question mark as a wildcard, and Git remote URLs can interpret it as an SSH
// host. Use ordinary paths at these external string interfaces.
pub(crate) fn external_path(root: &Path) -> String {
    let path = root.to_string_lossy().into_owned();
    #[cfg(windows)]
    {
        let ordinary = if let Some(share) = path.strip_prefix(r"\\?\UNC\") {
            format!(r"\\{share}")
        } else {
            path.strip_prefix(r"\\?\").unwrap_or(&path).to_owned()
        };
        ordinary.replace('\\', "/")
    }
    #[cfg(not(windows))]
    path
}
