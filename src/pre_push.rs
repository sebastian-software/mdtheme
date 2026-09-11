use crate::{config::Config, files};
use anyhow::{Context, Result, ensure};
use std::{
    path::{Path, PathBuf},
    process::Command,
};

fn git(root: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .context("Git is required for pre-push")?;
    ensure!(
        output.status.success(),
        "Cannot inspect Git worktree: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    Ok(output.stdout)
}

fn repository_root(cwd: &Path) -> Result<PathBuf> {
    let path = String::from_utf8(git(cwd, &["rev-parse", "--show-toplevel"])?)?;
    Ok(PathBuf::from(path.trim_end_matches(['\r', '\n'])).canonicalize()?)
}

fn dirty(root: &Path) -> Result<bool> {
    Ok(!git(
        root,
        &[
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
            "--ignore-submodules=none",
        ],
    )?
    .is_empty())
}

fn tracked(root: &Path, path: &Path) -> Result<bool> {
    let relative = path
        .strip_prefix(root)
        .context("Config, source, and output must belong to the current worktree")?;
    let name = relative
        .to_str()
        .context("Git path must be UTF-8")?
        .replace('\\', "/");
    Ok(!git(
        root,
        &["--literal-pathspecs", "ls-files", "-z", "--", &name],
    )?
    .is_empty())
}

pub fn run(cwd: &Path, explicit: Option<&Path>) -> Result<u8> {
    let root = repository_root(cwd)?;
    let head = git(&root, &["rev-parse", "--verify", "HEAD"])?;
    if dirty(&root)? {
        eprintln!(
            "Push blocked: commit or stash staged, unstaged, and untracked changes, then push again. README generation was skipped."
        );
        return Ok(1);
    }
    let config = Config::load(cwd, explicit)?;
    ensure!(
        repository_root(&config.directory)? == root,
        "Config must belong to the current worktree"
    );
    for input in std::iter::once(&config.source).chain(config.path.iter()) {
        if !tracked(&root, input)? {
            eprintln!(
                "Push blocked: commit {} before running pre-push.",
                input.display()
            );
            return Ok(1);
        }
    }
    let changed = files::generate(&config, true)?;
    if changed {
        println!("Updated {}.", config.output.display());
    }
    let committed = tracked(&root, &config.output)?;
    let current_head = git(&root, &["rev-parse", "--verify", "HEAD"])?;
    let pending = dirty(&root)?;
    if changed || !committed || current_head != head || pending {
        eprintln!(
            "Push blocked: review the generated README and Git changes, commit them, then push again. mdtheme did not stage or commit anything."
        );
        return Ok(1);
    }
    println!("README is up to date and the worktree is clean. Push may continue.");
    Ok(0)
}
