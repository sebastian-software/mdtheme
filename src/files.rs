use crate::{config::Config, render};
use anyhow::{Context, Result, ensure};
use std::{fs, io::Write};

pub fn generate(config: &Config, write: bool) -> Result<bool> {
    let source_meta = fs::metadata(&config.source).context("Cannot read source file")?;
    ensure!(source_meta.is_file(), "Source must be a regular file");
    let existing = match fs::symlink_metadata(&config.output) {
        Ok(meta) => {
            ensure!(
                !meta.file_type().is_symlink() && meta.is_file(),
                "Output must be a regular file, not a symlink"
            );
            ensure!(
                !same_file::is_same_file(&config.source, &config.output)?,
                "Source and output refer to the same file"
            );
            Some((fs::read(&config.output)?, meta.permissions()))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.into()),
    };
    let source =
        fs::read_to_string(&config.source).context("Source must contain UTF-8 Markdown")?;
    let name = config
        .source
        .file_name()
        .and_then(|name| name.to_str())
        .context("Invalid source name")?;
    let content = render(&source, &config.frames()?, name)?;
    let changed = existing
        .as_ref()
        .is_none_or(|(bytes, _)| bytes != content.as_bytes());
    if changed && write {
        let mut temporary = tempfile::NamedTempFile::new_in(&config.directory)?;
        if let Some((_, permissions)) = existing {
            temporary.as_file().set_permissions(permissions)?;
        }
        #[cfg(unix)]
        if !config.output.exists() {
            use std::os::unix::fs::PermissionsExt;
            temporary
                .as_file()
                .set_permissions(fs::Permissions::from_mode(0o644))?;
        }
        temporary.write_all(content.as_bytes())?;
        temporary.flush()?;
        temporary
            .persist(&config.output)
            .context("Cannot replace README atomically")?;
    }
    Ok(changed)
}
