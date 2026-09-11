use std::{
    fs,
    path::Path,
    process::{Command, Output},
};
use tempfile::{TempDir, tempdir};

fn git(root: &Path, args: &[&str]) -> String {
    let result = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    String::from_utf8(result.stdout).unwrap().trim().into()
}
fn repository() -> TempDir {
    let dir = tempdir().unwrap();
    git(dir.path(), &["init", "--initial-branch=main"]);
    git(dir.path(), &["config", "user.name", "Test"]);
    git(dir.path(), &["config", "user.email", "test@example.com"]);
    git(dir.path(), &["config", "commit.gpgsign", "false"]);
    git(dir.path(), &["config", "core.autocrlf", "false"]);
    git(dir.path(), &["config", "core.hooksPath", ".no-hooks"]);
    fs::create_dir(dir.path().join("theme")).unwrap();
    update(dir.path(), "# One");
    dir
}
fn update(root: &Path, value: &str) {
    fs::write(root.join("theme/header.md"), value).unwrap();
    git(root, &["add", "."]);
    git(root, &["commit", "-m", "fixture"]);
}
fn config(root: &Path, remote: &Path, revision: Option<&str>, path: &str) {
    let mut theme = serde_json::json!({"git": remote, "path": path});
    if let Some(revision) = revision {
        theme["ref"] = revision.into();
    }
    fs::write(
        root.join("mdtheme.yaml"),
        serde_json::to_string(&serde_json::json!({"themes": [theme]})).unwrap(),
    )
    .unwrap();
    fs::write(root.join("README.md.src"), "Body\r\n").unwrap();
}
fn invoke(root: &Path, operation: &str) -> Output {
    Command::new(env!("CARGO_BIN_EXE_mdtheme"))
        .current_dir(root)
        .arg(operation)
        .output()
        .unwrap()
}
fn expect(root: &Path, op: &str, status: i32) {
    let result = invoke(root, op);
    assert_eq!(
        result.status.code(),
        Some(status),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
}
fn output(root: &Path) -> String {
    fs::read_to_string(root.join("README.md")).unwrap()
}

#[test]
fn default_main_refreshes_and_check_preserves_readme() {
    let remote = repository();
    let project = tempdir().unwrap();
    config(project.path(), remote.path(), None, "theme");
    expect(project.path(), "--write", 0);
    let before = output(project.path());
    assert!(before.contains("# One"));
    update(remote.path(), "# Two");
    expect(project.path(), "--check", 1);
    assert_eq!(output(project.path()), before);
    expect(project.path(), "--write", 0);
    assert!(output(project.path()).contains("# Two"));
    assert!(!project.path().join(".git").exists());
    assert_eq!(fs::read_dir(project.path()).unwrap().count(), 3);
}

#[test]
fn branches_tags_old_commits_and_revision_expressions() {
    let remote = repository();
    let project = tempdir().unwrap();
    let old = git(remote.path(), &["rev-parse", "HEAD"]);
    git(remote.path(), &["tag", "v1"]);
    git(remote.path(), &["tag", "-a", "annotated", "-m", "tag"]);
    git(remote.path(), &["branch", "feature/theme"]);
    update(remote.path(), "# Two");
    for revision in [
        &old,
        "v1",
        "annotated",
        "feature/theme",
        "main~1",
        "refs/heads/feature/theme",
    ] {
        config(project.path(), remote.path(), Some(revision), "theme");
        expect(project.path(), "--write", 0);
        assert!(output(project.path()).contains("# One"), "{revision}");
    }
}

#[test]
fn failed_remote_or_ref_does_not_use_stale_content_or_write() {
    let remote = repository();
    let project = tempdir().unwrap();
    config(project.path(), remote.path(), None, "theme");
    expect(project.path(), "--write", 0);
    let before = output(project.path());
    config(
        project.path(),
        remote.path(),
        Some("does-not-exist"),
        "theme",
    );
    expect(project.path(), "--write", 2);
    assert_eq!(output(project.path()), before);
    config(project.path(), remote.path(), None, "theme");
    remote.close().unwrap();
    expect(project.path(), "--check", 2);
    assert_eq!(output(project.path()), before);
}

#[test]
fn rejects_git_options_and_directory_escapes() {
    let remote = repository();
    let project = tempdir().unwrap();
    for path in ["../", "/tmp", "theme/../../"] {
        config(project.path(), remote.path(), None, path);
        expect(project.path(), "--write", 2);
    }
    config(
        project.path(),
        remote.path(),
        Some("--upload-pack=bad-command"),
        "theme",
    );
    expect(project.path(), "--write", 2);
    assert!(!project.path().join("README.md").exists());
}

#[cfg(unix)]
#[test]
fn rejects_remote_and_local_fragment_symlink_escapes() {
    use std::os::unix::fs::symlink;
    let remote = repository();
    let project = tempdir().unwrap();
    fs::remove_file(remote.path().join("theme/header.md")).unwrap();
    symlink("../../private.txt", remote.path().join("theme/header.md")).unwrap();
    git(remote.path(), &["add", "."]);
    git(remote.path(), &["commit", "-m", "symlink"]);
    config(project.path(), remote.path(), None, "theme");
    expect(project.path(), "--write", 2);
    fs::create_dir(project.path().join("theme")).unwrap();
    fs::write(project.path().join("secret.txt"), "private").unwrap();
    symlink("../secret.txt", project.path().join("theme/header.md")).unwrap();
    fs::write(
        project.path().join("mdtheme.yaml"),
        "themes:\n  - directory: theme\n",
    )
    .unwrap();
    expect(project.path(), "--write", 2);
}
