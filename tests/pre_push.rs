use std::{
    fs,
    path::Path,
    process::{Command, Output},
};
use tempfile::{TempDir, tempdir};

fn git_output(root: &Path, args: &[&str]) -> Output {
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .output()
        .unwrap()
}
fn git(root: &Path, args: &[&str]) -> String {
    let result = git_output(root, args);
    assert!(
        result.status.success(),
        "git {args:?}: {}",
        String::from_utf8_lossy(&result.stderr)
    );
    String::from_utf8(result.stdout).unwrap().trim().to_owned()
}
fn invoke(root: &Path, args: &[&str], code: i32) -> Output {
    let result = Command::new(env!("CARGO_BIN_EXE_mdtheme"))
        .args(args)
        .current_dir(root)
        .output()
        .unwrap();
    assert_eq!(
        result.status.code(),
        Some(code),
        "mdtheme {args:?}: {}",
        String::from_utf8_lossy(&result.stderr)
    );
    result
}
fn commit(root: &Path) {
    git(root, &["add", "."]);
    git(root, &["commit", "-m", "fixture"]);
}
fn fixture() -> TempDir {
    let directory = tempdir().unwrap();
    let root = directory.path();
    git(root, &["init", "--initial-branch=main"]);
    git(root, &["config", "user.name", "Test"]);
    git(root, &["config", "user.email", "test@example.com"]);
    git(root, &["config", "commit.gpgsign", "false"]);
    git(root, &["config", "core.autocrlf", "false"]);
    git(
        root,
        &[
            "config",
            "core.hooksPath",
            root.join("no-hooks").to_str().unwrap(),
        ],
    );
    fs::write(root.join("README.md.src"), "# Initial\n").unwrap();
    invoke(root, &["--write"], 0);
    commit(root);
    directory
}

#[test]
fn clean_committed_readme_passes_without_mutation() {
    let directory = fixture();
    let root = directory.path();
    let before = fs::metadata(root.join("README.md"))
        .unwrap()
        .modified()
        .unwrap();
    let head = git(root, &["rev-parse", "HEAD"]);
    invoke(root, &["pre-push"], 0);
    assert_eq!(
        before,
        fs::metadata(root.join("README.md"))
            .unwrap()
            .modified()
            .unwrap()
    );
    assert_eq!(git(root, &["rev-parse", "HEAD"]), head);
    assert_eq!(git(root, &["status", "--porcelain"]), "");
}

#[test]
fn stale_readme_is_regenerated_but_never_staged_or_committed() {
    let directory = fixture();
    let root = directory.path();
    fs::write(root.join("README.md.src"), "# Updated\n").unwrap();
    commit(root);
    let head = git(root, &["rev-parse", "HEAD"]);
    invoke(root, &["pre-push"], 1);
    assert!(
        fs::read_to_string(root.join("README.md"))
            .unwrap()
            .contains("# Updated")
    );
    assert_eq!(git(root, &["diff", "--cached", "--name-only"]), "");
    assert_eq!(git(root, &["rev-parse", "HEAD"]), head);
    commit(root);
    invoke(root, &["pre-push"], 0);
}

#[test]
fn dirty_worktree_blocks_before_parsing_config() {
    let directory = fixture();
    let root = directory.path();
    fs::write(root.join("mdtheme.yaml"), "themes: [\n").unwrap();
    commit(root);
    let before = fs::read(root.join("README.md")).unwrap();
    git(root, &["config", "status.showUntrackedFiles", "no"]);
    for mode in ["unstaged", "staged", "untracked"] {
        let name = if mode == "untracked" {
            "scratch.txt"
        } else {
            "README.md.src"
        };
        fs::write(root.join(name), "changed\n").unwrap();
        if mode == "staged" {
            git(root, &["add", name]);
        }
        invoke(root, &["pre-push"], 1);
        assert_eq!(fs::read(root.join("README.md")).unwrap(), before);
        if mode == "untracked" {
            fs::remove_file(root.join(name)).unwrap();
        } else {
            git(root, &["restore", "--staged", "--worktree", name]);
        }
    }
    invoke(root, &["pre-push"], 2);
}

#[test]
fn ignored_output_and_config_do_not_count_as_committed() {
    let directory = fixture();
    let root = directory.path();
    git(root, &["rm", "README.md"]);
    fs::write(root.join(".gitignore"), "README.md\nignored.yaml\n").unwrap();
    commit(root);
    invoke(root, &["pre-push"], 1);
    assert_eq!(git(root, &["status", "--porcelain"]), "");
    invoke(root, &["pre-push"], 1);
    fs::write(root.join("ignored.yaml"), "{}\n").unwrap();
    invoke(root, &["pre-push", "--config", "ignored.yaml"], 1);
}

#[test]
fn nested_config_still_checks_the_whole_worktree() {
    let directory = fixture();
    let root = directory.path();
    let docs = root.join("docs");
    fs::create_dir(&docs).unwrap();
    fs::write(docs.join("README.md.src"), "# Nested\n").unwrap();
    fs::write(docs.join("config.yaml"), "{}\n").unwrap();
    commit(root);
    invoke(root, &["pre-push", "--config", "docs/config.yaml"], 1);
    commit(root);
    invoke(root, &["pre-push", "--config", "docs/config.yaml"], 0);
    fs::write(root.join("unrelated.txt"), "untracked\n").unwrap();
    invoke(&docs, &["pre-push", "--config", "config.yaml"], 1);
}

#[test]
fn non_git_and_foreign_config_fail_without_mutation() {
    let directory = fixture();
    let other = fixture();
    let plain = tempdir().unwrap();
    invoke(plain.path(), &["pre-push"], 2);
    fs::write(other.path().join("config.yaml"), "{}\n").unwrap();
    commit(other.path());
    let before = fs::read(other.path().join("README.md")).unwrap();
    invoke(
        directory.path(),
        &[
            "pre-push",
            "--config",
            other.path().join("config.yaml").to_str().unwrap(),
        ],
        2,
    );
    assert_eq!(fs::read(other.path().join("README.md")).unwrap(), before);
}

#[test]
fn linked_worktree_is_independent_of_the_main_checkout() {
    let directory = fixture();
    let root = directory.path();
    let parent = tempdir().unwrap();
    let linked = parent.path().join("checkout");
    git(
        root,
        &["worktree", "add", "-b", "linked", linked.to_str().unwrap()],
    );
    invoke(&linked, &["pre-push"], 0);
    fs::write(linked.join("README.md.src"), "# Linked\n").unwrap();
    commit(&linked);
    invoke(&linked, &["pre-push"], 1);
    assert!(
        !fs::read_to_string(root.join("README.md"))
            .unwrap()
            .contains("# Linked")
    );
    git(
        root,
        &["worktree", "remove", "--force", linked.to_str().unwrap()],
    );
}

#[test]
fn actual_git_hook_blocks_push_until_generated_readme_is_committed() {
    let directory = fixture();
    let root = directory.path();
    let remote = tempdir().unwrap();
    git(remote.path(), &["init", "--bare"]);
    git(
        root,
        &["remote", "add", "origin", remote.path().to_str().unwrap()],
    );
    let hooks = root.join(".githooks");
    fs::create_dir(&hooks).unwrap();
    let binary = env!("CARGO_BIN_EXE_mdtheme")
        .replace('\\', "/")
        .replace('\'', "'\\''");
    let hook = hooks.join("pre-push");
    fs::write(&hook, format!("#!/bin/sh\nexec '{binary}' pre-push\n")).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
    }
    git(root, &["config", "core.hooksPath", ".githooks"]);
    commit(root);
    git(root, &["push", "origin", "main"]);
    let remote_before = git(remote.path(), &["rev-parse", "refs/heads/main"]);
    fs::write(root.join("README.md.src"), "# Hook update\n").unwrap();
    commit(root);
    let blocked = git_output(root, &["push", "origin", "main"]);
    assert!(!blocked.status.success(), "push unexpectedly succeeded");
    assert_eq!(
        git(remote.path(), &["rev-parse", "refs/heads/main"]),
        remote_before
    );
    assert!(
        fs::read_to_string(root.join("README.md"))
            .unwrap()
            .contains("# Hook update")
    );
    assert_eq!(git(root, &["diff", "--cached", "--name-only"]), "");
    commit(root);
    git(root, &["push", "origin", "main"]);
    assert_eq!(
        git(remote.path(), &["rev-parse", "refs/heads/main"]),
        git(root, &["rev-parse", "HEAD"])
    );
}

#[test]
fn nested_independent_repository_cannot_supply_the_config() {
    let directory = fixture();
    let root = directory.path();
    let nested = root.join("nested");
    fs::create_dir(&nested).unwrap();
    git(&nested, &["init", "--initial-branch=main"]);
    fs::write(nested.join("config.yaml"), "{}\n").unwrap();
    fs::write(nested.join("README.md.src"), "# Foreign\n").unwrap();
    fs::write(nested.join("README.md"), "unchanged\n").unwrap();
    fs::write(root.join(".gitignore"), "nested/\n").unwrap();
    commit(root);
    invoke(root, &["pre-push", "--config", "nested/config.yaml"], 2);
    assert_eq!(
        fs::read_to_string(nested.join("README.md")).unwrap(),
        "unchanged\n"
    );
}
