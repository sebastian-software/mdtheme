use mdtheme::{
    badges::{BadgeOptions, project_badges},
    metadata::discover_project,
};
use serde_json::json;
use std::{fs, path::Path};

fn put(root: &Path, path: &str, contents: impl AsRef<[u8]>) {
    let target = root.join(path);
    fs::create_dir_all(target.parent().unwrap()).unwrap();
    fs::write(target, contents).unwrap();
}
fn names(root: &Path) -> Vec<String> {
    discover_project(root, None)
        .unwrap()
        .packages
        .into_iter()
        .map(|p| p.name)
        .collect()
}
fn selection(paths: &[&str]) -> Vec<String> {
    paths.iter().map(|p| (*p).to_owned()).collect()
}

#[test]
fn prefers_public_npm_root_and_normalizes_repository() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(root, "package.json", json!({"name":"root-tool","repository":{"url":"git+https://github.com/acme/root-tool.git"},"workspaces":["packages/*"]}).to_string());
    put(
        root,
        "packages/child/package.json",
        r#"{"name":"child-tool"}"#,
    );
    put(root, ".github/workflows/ci.yaml", "name: CI\n");
    put(root, ".github/workflows/release.yml", "name: Release\n");
    let project = discover_project(root, None).unwrap();
    assert_eq!(project.packages.len(), 1);
    assert_eq!(project.packages[0].name, "root-tool");
    assert_eq!(project.repository.as_deref(), Some("acme/root-tool"));
    assert_eq!(project.workflow.as_deref(), Some("ci.yaml"));
}
#[test]
fn pnpm_filters_private_platform_optional_and_ignored_directories() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(root, "pnpm-workspace.yaml", "packages:\n  - packages/**\n");
    put(
        root,
        "package.json",
        r#"{"private":true,"optionalDependencies":{"native-tool":"1"}}"#,
    );
    for (path, value) in [
        (
            "public",
            json!({"name":"public-tool","engines":{"node":">=24"}}),
        ),
        ("private", json!({"name":"private-tool","private":true})),
        ("platform", json!({"name":"platform-tool","os":["darwin"]})),
        ("native", json!({"name":"native-tool"})),
        ("node_modules/hidden", json!({"name":"hidden-tool"})),
        (".git/hidden", json!({"name":"git-tool"})),
    ] {
        put(
            root,
            &format!("packages/{path}/package.json"),
            value.to_string(),
        );
    }
    let project = discover_project(root, None).unwrap();
    assert_eq!(project.packages.len(), 1);
    assert_eq!(project.packages[0].name, "public-tool");
    assert_eq!(project.packages[0].runtime.as_deref(), Some(">=24"));
}
#[test]
fn workspace_exclusions_and_object_form_are_respected() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "package.json",
        r#"{"private":true,"workspaces":{"packages":["packages/*","!packages/excluded"]}}"#,
    );
    for name in ["included", "excluded"] {
        put(
            root,
            &format!("packages/{name}/package.json"),
            json!({"name":name}).to_string(),
        );
    }
    assert_eq!(names(root), ["included"]);
}
#[test]
fn cargo_defaults_inherit_workspace_metadata() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "Cargo.toml",
        "[workspace]\nmembers = ['crates/*']\ndefault-members = ['crates/app', 'crates/excluded']\nexclude = ['crates/excluded']\n[workspace.package]\nrust-version = '1.80'\nrepository = 'https://github.com/acme/rust-tools.git'\n",
    );
    put(
        root,
        "crates/app/Cargo.toml",
        "[package]\nname = 'app'\nrust-version.workspace = true\n",
    );
    for name in ["other", "excluded"] {
        put(
            root,
            &format!("crates/{name}/Cargo.toml"),
            format!("[package]\nname = '{name}'\n"),
        );
    }
    let project = discover_project(root, None).unwrap();
    assert_eq!(project.packages.len(), 1);
    assert_eq!(project.packages[0].name, "app");
    assert_eq!(project.packages[0].runtime.as_deref(), Some("1.80"));
    assert_eq!(project.repository.as_deref(), Some("acme/rust-tools"));
}
#[test]
fn explicit_packages_preserve_order_dedupe_and_filter_unpublished() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "Cargo.toml",
        "[workspace.package]\nrust-version='1.80'\n",
    );
    put(
        root,
        "crate/Cargo.toml",
        "[package]\nname='crate-tool'\npublish=true\nrust-version.workspace=true\n",
    );
    for (path, value) in [
        (
            "npm",
            json!({"name":"npm-tool","optionalDependencies":{"optional-plugin":"1"}}),
        ),
        ("plugin", json!({"name":"optional-plugin"})),
        ("private", json!({"name":"private-tool","private":true})),
        ("platform", json!({"name":"platform-tool","cpu":["x64"]})),
    ] {
        put(root, &format!("{path}/package.json"), value.to_string());
    }
    let paths = selection(&[
        "crate/Cargo.toml",
        "npm/package.json",
        "plugin/package.json",
        "private/package.json",
        "platform/package.json",
        "npm/package.json",
    ]);
    let project = discover_project(root, Some(&paths)).unwrap();
    assert_eq!(
        project
            .packages
            .iter()
            .map(|p| p.name.as_str())
            .collect::<Vec<_>>(),
        ["crate-tool", "npm-tool", "optional-plugin"]
    );
    for path in ["missing/package.json", "README.md", "../package.json", "."] {
        assert!(discover_project(root, Some(&selection(&[path]))).is_err());
    }
    assert!(
        discover_project(
            root,
            Some(&[root.join("npm/package.json").to_string_lossy().into_owned()])
        )
        .is_err()
    );
    put(root, "unnamed/package.json", "{}");
    assert!(discover_project(root, Some(&selection(&["unnamed/package.json"]))).is_err());
}
#[test]
fn workflow_ambiguity_and_invalid_manifests() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(root, ".github/workflows/build.yml", "name: Build\n");
    assert_eq!(
        discover_project(root, None).unwrap().workflow.as_deref(),
        Some("build.yml")
    );
    put(root, ".github/workflows/test.yml", "name: Test\n");
    assert!(discover_project(root, None).unwrap().workflow.is_none());
    put(root, "package.json", "{broken");
    assert!(
        discover_project(root, None)
            .unwrap_err()
            .to_string()
            .contains("Unable to read")
    );
    put(root, "package.json", "[]");
    assert!(discover_project(root, None).is_err());
    put(
        root,
        "package.json",
        r#"{"private":true,"workspaces":[42]}"#,
    );
    assert!(discover_project(root, None).is_err());
}
#[test]
fn cargo_publication_restrictions_include_inheritance() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "Cargo.toml",
        "[workspace]\nmembers=['crates/*']\n[workspace.package]\npublish=false\n",
    );
    for (name, publish) in [
        ("internal", "false"),
        ("inherited", "{workspace=true}"),
        ("disabled", "[]"),
        ("custom", "['company']"),
        ("public", "['crates-io']"),
    ] {
        put(
            root,
            &format!("crates/{name}/Cargo.toml"),
            format!("[package]\nname='{name}'\npublish={publish}\n"),
        );
    }
    assert_eq!(names(root), ["public"]);
}
#[test]
fn cargo_licenses_and_documented_library_targets() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "Cargo.toml",
        "[workspace]\nmembers=['crates/*']\n[workspace.package]\nlicense='MIT OR Apache-2.0'\n",
    );
    put(
        root,
        "crates/lib/Cargo.toml",
        "[package]\nname='library'\nlicense.workspace=true\n[lib]\npath='library.rs'\n",
    );
    put(root, "crates/lib/library.rs", "pub fn example() {}\n");
    put(root, "crates/bin/Cargo.toml", "[package]\nname='binary'\n");
    put(root, "crates/bin/src/main.rs", "fn main() {}\n");
    put(
        root,
        "crates/hidden/Cargo.toml",
        "[package]\nname='hidden-docs'\n[lib]\ndoc=false\n",
    );
    put(root, "crates/hidden/src/lib.rs", "");
    put(
        root,
        "crates/disabled/Cargo.toml",
        "[package]\nname='disabled-lib'\nautolib=false\n",
    );
    put(root, "crates/disabled/src/lib.rs", "");
    let project = discover_project(root, None).unwrap();
    for package in project.packages {
        if package.name == "library" {
            assert!(package.docs);
            let license = package.license.unwrap();
            assert_eq!(license.expression, "MIT OR Apache-2.0");
            assert_eq!(license.manifest, "crates/lib/Cargo.toml");
        } else {
            assert!(!package.docs);
            assert!(package.license.is_none());
        }
    }
}
#[test]
fn workspace_licenses_remain_distinct() {
    let root = tempfile::tempdir().unwrap();
    let root = root.path();
    put(
        root,
        "package.json",
        r#"{"private":true,"license":"MIT","workspaces":["packages/*"]}"#,
    );
    for (name, license) in [
        ("first", Some("Apache-2.0")),
        ("second", None),
        ("blank", Some("  ")),
    ] {
        put(
            root,
            &format!("packages/{name}/package.json"),
            json!({"name":name,"license":license}).to_string(),
        );
    }
    for package in discover_project(root, None).unwrap().packages {
        if package.name == "first" {
            assert_eq!(
                package.license.unwrap().manifest,
                "packages/first/package.json"
            );
        } else {
            assert!(package.license.is_none());
        }
    }
}
fn badge_fixture() -> tempfile::TempDir {
    let root = tempfile::tempdir().unwrap();
    put(root.path(),"package.json",json!({"name":"@scope/tool-bar","license":"MIT","engines":{"node":">=20 <22"},"repository":{"url":"https://github.com/acme/project).git"}}).to_string());
    put(
        root.path(),
        "Cargo.toml",
        "[package]\nname='crate-tool'\nrust-version='1.80-beta'\nlicense='MIT OR Apache-2.0'\n",
    );
    put(root.path(), "src/lib.rs", "");
    put(root.path(), ".github/workflows/ci.yml", "name: CI\n");
    root
}
#[test]
fn badges_preserve_order_links_and_escaping() {
    let root = badge_fixture();
    let frame = project_badges(root.path(), &BadgeOptions::default()).unwrap();
    assert!(frame.closing.is_empty());
    let row = frame.opening;
    let needles = [
        "/npm/v/%40scope%2Ftool-bar.svg",
        "/npm/dm/%40scope%2Ftool-bar.svg",
        "/crates/v/crate-tool.svg",
        "/crates/dr/crate-tool.svg",
        "/docsrs/crate-tool?",
        "/github/actions/workflow/status/acme/project%29/ci.yml",
        "/badge/Node.js-%3E%3D20%20%3C22-005164",
        "/badge/Rust%20MSRV-1.80--beta-005164",
        "License",
    ];
    let positions = needles.map(|n| {
        row.find(n)
            .unwrap_or_else(|| panic!("Missing {n} in {row}"))
    });
    assert!(positions.windows(2).all(|w| w[0] < w[1]));
    for needle in [
        "https://www.npmjs.com/package/%40scope%2Ftool-bar",
        "https://crates.io/crates/crate-tool",
        "https://docs.rs/crate-tool",
        "https://github.com/acme/project%29/actions/workflows/ci.yml",
        "MIT%20OR%20Apache--2.0",
        "](package.json)",
        "](Cargo.toml)",
    ] {
        assert!(row.contains(needle), "{needle}");
    }
    assert!(!row.contains("codecov"));
    assert!(!row.contains("coverage"));
    assert!(!row.contains("github/v/release"));
}
#[test]
fn publication_toggle_retains_ci_runtime_license_and_workflow_override() {
    let root = badge_fixture();
    let options = BadgeOptions {
        published: false,
        workflow: Some(".github/workflows/release.yml".into()),
        ..BadgeOptions::default()
    };
    let row = project_badges(root.path(), &options).unwrap().opening;
    for needle in [
        "npm/v/",
        "crates/v/",
        "npm/dm/",
        "crates/dr/",
        "docsrs",
        "docs.rs",
    ] {
        assert!(!row.contains(needle));
    }
    for needle in [
        "License",
        "/badge/Node.js-",
        "/badge/Rust%20MSRV-",
        "/workflow/status/acme/project%29/release.yml",
    ] {
        assert!(row.contains(needle));
    }
}
#[test]
fn distinct_runtimes_are_labeled_and_equal_runtimes_deduplicated() {
    let root = badge_fixture();
    let root = root.path();
    put(
        root,
        "packages/other/package.json",
        r#"{"name":"other-tool","engines":{"node":">=22"}}"#,
    );
    let options = BadgeOptions {
        packages: Some(selection(&[
            "package.json",
            "packages/other/package.json",
            "Cargo.toml",
        ])),
        published: false,
        ..BadgeOptions::default()
    };
    let row = project_badges(root, &options).unwrap().opening;
    assert!(row.contains("Node.js-%3E%3D20%20%3C22%20%28%40scope%2Ftool--bar%29"));
    assert!(row.contains("Node.js-%3E%3D22%20%28other--tool%29"));
    put(
        root,
        "packages/other/package.json",
        r#"{"name":"other-tool","engines":{"node":">=20 <22"}}"#,
    );
    put(
        root,
        "Cargo.toml",
        "[package]\nname='crate-tool'\nrust-version='1.80_beta'\n",
    );
    let row = project_badges(root, &options).unwrap().opening;
    assert_eq!(row.matches("/badge/Node.js-").count(), 1);
    assert_eq!(row.matches("/badge/Rust%20MSRV-").count(), 1);
    assert!(row.contains("Node.js-%3E%3D20%20%3C22-005164"));
    assert!(row.contains("Rust%20MSRV-1.80__beta-005164"));
}
#[test]
fn unusual_package_labels_and_license_paths_are_escaped() {
    let root = badge_fixture();
    let root = root.path();
    put(
        root,
        "packages/other (tool)/package.json",
        r#"{"name":"@scope/other]tool","license":"BSD-2-Clause"}"#,
    );
    let options = BadgeOptions {
        packages: Some(selection(&[
            "package.json",
            "packages/other (tool)/package.json",
        ])),
        ..BadgeOptions::default()
    };
    let row = project_badges(root, &options).unwrap().opening;
    for needle in [
        "npm @scope/other\\]tool",
        "%40scope%2Fother%5Dtool",
        "BSD--2--Clause",
        "](packages/other%20%28tool%29/package.json)",
    ] {
        assert!(row.contains(needle), "{needle}");
    }
}
#[test]
fn badge_schema_is_explicit_and_strict() {
    let options: BadgeOptions = serde_yaml_ng::from_str("{}").unwrap();
    assert!(!options.enabled);
    assert!(options.published);
    assert!(serde_yaml_ng::from_str::<BadgeOptions>("unknown: true").is_err());
}

#[test]
fn repository_forms_and_git_fallback_are_normalized() {
    let root = tempfile::tempdir().unwrap();
    for remote in [
        "github:acme/tool",
        "git@github.com:acme/tool.git",
        "ssh://git@github.com/acme/tool.git",
        "acme/tool",
        "https://github.com/acme/tool.git/",
    ] {
        put(
            root.path(),
            "package.json",
            json!({"repository":remote}).to_string(),
        );
        assert_eq!(
            discover_project(root.path(), None)
                .unwrap()
                .repository
                .as_deref(),
            Some("acme/tool"),
            "{remote}"
        );
    }
    let git = |args: &[&str]| {
        assert!(
            std::process::Command::new("git")
                .arg("-C")
                .arg(root.path())
                .args(args)
                .output()
                .unwrap()
                .status
                .success()
        );
    };
    git(&["init"]);
    git(&[
        "config",
        "remote.origin.url",
        "git@github.com:acme/fallback.git",
    ]);
    put(
        root.path(),
        "package.json",
        r#"{"repository":"https://gitlab.com/acme/tool"}"#,
    );
    assert_eq!(
        discover_project(root.path(), None)
            .unwrap()
            .repository
            .as_deref(),
        Some("acme/fallback")
    );
}

#[test]
fn malformed_workspace_and_optional_dependency_shapes_fail() {
    let root = tempfile::tempdir().unwrap();
    for contents in [
        r#"{"private":true,"workspaces":null}"#,
        r#"{"private":true,"workspaces":[5]}"#,
        r#"{"private":true,"optionalDependencies":null}"#,
    ] {
        put(root.path(), "package.json", contents);
        assert!(discover_project(root.path(), None).is_err(), "{contents}");
    }
    put(root.path(), "package.json", r#"{"private":true}"#);
    put(root.path(), "pnpm-workspace.yaml", "packages: null\n");
    assert!(discover_project(root.path(), None).is_err());
}

#[test]
fn unsupported_workspace_patterns_fail_instead_of_silently_hiding_packages() {
    let root = tempfile::tempdir().unwrap();
    put(root.path(), "packages/a/package.json", r#"{"name":"a"}"#);
    for pattern in [
        "packages/{a,b}",
        "packages/{1..3}",
        "packages/@(a|b)",
        "packages/+(a|b)",
        "packages/?(a|b)",
        "packages/*(a|b)",
        "packages/!(a|b)",
        "!(packages/a)",
        "!packages/{a,b}",
    ] {
        put(
            root.path(),
            "package.json",
            json!({"private":true,"workspaces":[pattern]}).to_string(),
        );
        let error = discover_project(root.path(), None).unwrap_err().to_string();
        assert!(
            error.contains("Unsupported workspace pattern"),
            "{pattern}: {error}"
        );
        assert!(error.contains("badges.packages"), "{pattern}: {error}");
        let selected =
            discover_project(root.path(), Some(&selection(&["packages/a/package.json"]))).unwrap();
        assert_eq!(selected.packages[0].name, "a");
    }
}

#[test]
fn unsupported_patterns_are_rejected_in_pnpm_and_cargo_workspace_fields() {
    let root = tempfile::tempdir().unwrap();
    put(
        root.path(),
        "pnpm-workspace.yaml",
        "packages: ['packages/{a,b}']\n",
    );
    assert!(
        discover_project(root.path(), None)
            .unwrap_err()
            .to_string()
            .contains("Unsupported workspace pattern")
    );
    fs::remove_file(root.path().join("pnpm-workspace.yaml")).unwrap();
    for field in ["members", "default-members", "exclude"] {
        put(
            root.path(),
            "Cargo.toml",
            format!("[workspace]\n{field} = ['crates/@(a|b)']\n"),
        );
        assert!(
            discover_project(root.path(), None)
                .unwrap_err()
                .to_string()
                .contains("Unsupported workspace pattern"),
            "{field}"
        );
    }
}

#[test]
fn supported_workspace_character_classes_and_literal_brackets_match() {
    let root = tempfile::tempdir().unwrap();
    for name in ["a1", "b2", "c3", "{", "@", "]"] {
        put(
            root.path(),
            &format!("packages/{name}/package.json"),
            json!({"name":name}).to_string(),
        );
    }
    for (pattern, expected) in [
        ("packages/?[1-2]", vec!["a1", "b2"]),
        ("packages/[!a]2", vec!["b2"]),
        ("packages/[{@]", vec!["@", "{"]),
        ("packages/[]]", vec!["]"]),
    ] {
        put(
            root.path(),
            "package.json",
            json!({"private":true,"workspaces":[pattern]}).to_string(),
        );
        assert_eq!(names(root.path()), expected, "{pattern}");
    }
}
