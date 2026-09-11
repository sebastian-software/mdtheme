use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result, bail, ensure};
use serde::Deserialize;

use crate::Frame;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Theme {
    pub directory: Option<PathBuf>,
    pub git: Option<String>,
    #[serde(rename = "ref")]
    pub revision: Option<String>,
    pub path: Option<PathBuf>,
}

fn git(root: &Path, args: &[&str]) -> Result<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .arg("-c")
        .arg(format!(
            "core.hooksPath={}",
            root.join(".git/mdtheme-disabled-hooks").display()
        ))
        .args(["-c", "core.fsmonitor=false"])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        // A caller can be running in a Git hook. Its repository must not leak
        // into the independent theme checkout.
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env_remove("GIT_COMMON_DIR")
        .env_remove("GIT_OBJECT_DIRECTORY")
        .env_remove("GIT_ALTERNATE_OBJECT_DIRECTORIES")
        .output()
        .context("Cannot run Git for the remote theme")?;
    ensure!(
        output.status.success(),
        "Git theme operation failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    Ok(String::from_utf8(output.stdout)?.trim().to_owned())
}

fn checkout(root: &Path, url: &str, revision: &str) -> Result<()> {
    ensure!(
        !url.is_empty() && !revision.is_empty(),
        "git and ref must not be empty"
    );
    git(root, &["init", "--quiet"])?;
    git(root, &["remote", "add", "--", "origin", url])?;
    let fetched = git(
        root,
        &[
            "fetch",
            "--quiet",
            "--no-recurse-submodules",
            "--depth=1",
            "--",
            "origin",
            revision,
        ],
    );
    let commit = if fetched.is_ok() {
        git(
            root,
            &[
                "rev-parse",
                "--verify",
                "--end-of-options",
                "FETCH_HEAD^{commit}",
            ],
        )?
    } else {
        // Some servers cannot shallow-fetch an old object or revision expression.
        // Fetch ordinary refs/history and let Git resolve it, without a shell.
        let shallow = root.join(".git/shallow").exists();
        let mut args = vec!["fetch", "--quiet", "--no-recurse-submodules", "--tags"];
        if shallow {
            args.push("--unshallow");
        }
        args.extend(["--", "origin", "+refs/heads/*:refs/remotes/origin/*"]);
        git(root, &args)?;
        let remote_revision = revision.strip_prefix("refs/heads/").map_or_else(
            || format!("refs/remotes/origin/{revision}"),
            |branch| format!("refs/remotes/origin/{branch}"),
        );
        let local = format!("{revision}^{{commit}}");
        let remote = format!("{remote_revision}^{{commit}}");
        git(root, &["rev-parse", "--verify", "--end-of-options", &local])
            .or_else(|_| {
                git(
                    root,
                    &["rev-parse", "--verify", "--end-of-options", &remote],
                )
            })
            .with_context(|| format!("Cannot resolve theme ref {revision}"))?
    };
    git(root, &["checkout", "--quiet", "--detach", &commit])?;
    Ok(())
}

fn within(root: &Path, path: &Path) -> Result<PathBuf> {
    ensure!(
        !path.is_absolute()
            && !path.components().any(|part| matches!(
                part,
                Component::ParentDir | Component::Prefix(_) | Component::RootDir
            )),
        "Theme path must stay inside its directory"
    );
    let resolved = root
        .join(path)
        .canonicalize()
        .with_context(|| format!("Cannot read theme path {}", path.display()))?;
    ensure!(
        resolved.starts_with(root),
        "Theme path escapes its directory"
    );
    Ok(resolved)
}

fn fragment(root: &Path, name: &str) -> Result<Option<String>> {
    match fs::symlink_metadata(root.join(name)) {
        Ok(_) => {
            let path = within(root, Path::new(name))?;
            ensure!(
                path.is_file(),
                "Theme fragment must be a regular file: {name}"
            );
            Ok(Some(fs::read_to_string(path)?))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

fn read_frame(root: &Path) -> Result<Frame> {
    ensure!(root.is_dir(), "Theme must be a directory");
    let header = fragment(root, "header.md")?;
    let footer = fragment(root, "footer.md")?;
    ensure!(
        header.is_some() || footer.is_some(),
        "Theme must contain header.md or footer.md"
    );
    Ok(Frame {
        opening: header.unwrap_or_default(),
        closing: footer.unwrap_or_default(),
    })
}

pub fn load(theme: &Theme, config_dir: &Path) -> Result<Frame> {
    match (&theme.directory, &theme.git) {
        (Some(directory), None) => {
            ensure!(
                theme.revision.is_none() && theme.path.is_none(),
                "ref and path require a git theme"
            );
            let root = config_dir
                .join(directory)
                .canonicalize()
                .context("Cannot find local theme directory")?;
            read_frame(&root)
        }
        (None, Some(url)) => {
            let temporary =
                tempfile::tempdir().context("Cannot create temporary theme checkout")?;
            let root = temporary.path().canonicalize()?;
            // Resolve local Git paths against the config, not the temporary checkout.
            let local_url = config_dir.join(url);
            let source = if local_url.exists() {
                crate::paths::external_path(&local_url.canonicalize()?)
            } else {
                url.clone()
            };
            checkout(&root, &source, theme.revision.as_deref().unwrap_or("main"))?;
            let selected = within(&root, theme.path.as_deref().unwrap_or(Path::new(".")))?;
            read_frame(&selected)
        }
        _ => bail!("Each theme requires exactly one of directory or git"),
    }
}
