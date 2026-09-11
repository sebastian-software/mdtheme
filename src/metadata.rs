//! Project discovery reads manifests without executing project code.
use anyhow::{Context, Result, bail};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    fs,
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageLicense {
    pub expression: String,
    pub manifest: String,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PackageMetadata {
    pub registry: String,
    pub name: String,
    pub runtime: Option<String>,
    pub license: Option<PackageLicense>,
    pub docs: bool,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectMetadata {
    pub packages: Vec<PackageMetadata>,
    pub repository: Option<String>,
    pub workflow: Option<String>,
}

fn regular(path: &Path) -> bool {
    fs::symlink_metadata(path).is_ok_and(|m| m.is_file())
}
fn parse(path: &Path) -> Result<Value> {
    let load = || -> Result<Value> {
        let text = fs::read_to_string(path)?;
        let value: Value = match path.extension().and_then(|s| s.to_str()) {
            Some("toml") => serde_json::to_value(toml::from_str::<toml::Value>(&text)?)?,
            Some("yaml" | "yml") => serde_yaml_ng::from_str(&text)?,
            _ => serde_json::from_str(&text)?,
        };
        if !value.is_object() {
            bail!("the manifest must contain a mapping");
        }
        Ok(value)
    };
    load().with_context(|| format!("Unable to read {}", path.display()))
}
fn optional(path: &Path) -> Result<Value> {
    if regular(path) {
        parse(path)
    } else {
        Ok(Value::Null)
    }
}
fn strings(value: Option<&Value>, label: &str) -> Result<Vec<String>> {
    let Some(value) = value else {
        return Ok(vec![]);
    };
    let array = value
        .as_array()
        .with_context(|| format!("{label} must be an array of strings"))?;
    array
        .iter()
        .map(|v| {
            v.as_str()
                .map(str::to_owned)
                .with_context(|| format!("{label} must be an array of strings"))
        })
        .collect()
}
fn inherited<'a>(package: &'a Value, workspace: &'a Value, key: &str) -> &'a Value {
    if package[key]["workspace"] == true {
        &workspace[key]
    } else {
        &package[key]
    }
}
fn metadata(
    root: &Path,
    path: &Path,
    value: &Value,
    workspace: &Value,
    explicit: bool,
) -> Result<Option<PackageMetadata>> {
    let npm = path.file_name().is_some_and(|s| s == "package.json");
    let package = if npm { value } else { &value["package"] };
    if !package.is_object() {
        return Ok(None);
    }
    if !npm {
        let publish = inherited(package, workspace, "publish");
        if publish == false
            || publish
                .as_array()
                .is_some_and(|a| !a.iter().any(|v| v == "crates-io"))
        {
            return Ok(None);
        }
    }
    let name = package["name"].as_str().filter(|n| !n.is_empty());
    if explicit && name.is_none() {
        bail!("{} must define a non-empty package name", path.display());
    }
    let Some(name) = name else {
        return Ok(None);
    };
    if npm
        && (package["private"] == true
            || ["os", "cpu", "libc"]
                .iter()
                .any(|k| package.get(k).is_some()))
    {
        return Ok(None);
    }
    let runtime = if npm {
        &package["engines"]["node"]
    } else {
        inherited(package, workspace, "rust-version")
    };
    let license = if npm {
        &package["license"]
    } else {
        inherited(package, workspace, "license")
    };
    let license = license
        .as_str()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| PackageLicense {
            expression: s.to_owned(),
            manifest: path
                .strip_prefix(root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/"),
        });
    let lib = &value["lib"];
    let docs = !npm
        && lib["doc"] != false
        && (lib.is_object() || package["autolib"] != false)
        && regular(
            &path
                .parent()
                .unwrap_or(root)
                .join(lib["path"].as_str().unwrap_or("src/lib.rs")),
        );
    Ok(Some(PackageMetadata {
        registry: if npm { "npm" } else { "crates" }.to_owned(),
        name: name.to_owned(),
        runtime: runtime.as_str().map(str::to_owned),
        license,
        docs,
    }))
}
// The glob crate supports *, ?, whole-component **, character classes and
// negated character classes. Node's brace expansion and extglob groups must not
// become literal paths here and silently hide packages during discovery.
fn validate_workspace_pattern(pattern: &str) -> Result<()> {
    let mut characters = pattern.chars().peekable();
    while let Some(character) = characters.next() {
        if character == '[' {
            if characters.peek() == Some(&'!') {
                characters.next();
            }
            // A closing bracket in the first position belongs to the class.
            if characters.peek() == Some(&']') {
                characters.next();
            }
            for character in characters.by_ref() {
                if character == ']' {
                    break;
                }
            }
            continue;
        }
        if matches!(character, '{' | '}')
            || (matches!(character, '?' | '*' | '+' | '@' | '!') && characters.peek() == Some(&'('))
        {
            bail!(
                "Unsupported workspace pattern {pattern:?}: brace expansion and extglob groups are not supported; use *, **, ?, [...] or [!...], or set badges.packages to explicit manifest paths"
            );
        }
    }
    Ok(())
}

// std::fs::canonicalize uses verbatim paths on Windows. The glob parser
// treats the question mark in that prefix as a pattern and cannot traverse it.
fn glob_root(root: &Path) -> String {
    let path = root.to_string_lossy().into_owned();
    #[cfg(windows)]
    {
        if let Some(share) = path.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{share}");
        }
        if let Some(disk) = path.strip_prefix(r"\\?\") {
            return disk.to_owned();
        }
    }
    path
}

fn expand(root: &Path, patterns: &[String], filename: &str) -> Result<Vec<PathBuf>> {
    let mut included = BTreeSet::new();
    let mut excluded = BTreeSet::new();
    for pattern in patterns {
        validate_workspace_pattern(pattern)?;
        let (exclude, pattern) = pattern
            .strip_prefix('!')
            .map_or((false, pattern.as_str()), |s| (true, s));
        let pattern = format!(
            "{}/{}/{}",
            glob::Pattern::escape(&glob_root(root)),
            pattern.trim_end_matches('/'),
            filename
        );
        for candidate in
            glob::glob(&pattern).with_context(|| format!("Invalid workspace pattern {pattern}"))?
        {
            let path = candidate?;
            if path
                .components()
                .any(|p| p.as_os_str() == "node_modules" || p.as_os_str() == ".git")
                || !regular(&path)
            {
                continue;
            }
            // Match the canonical root representation used for relative links.
            let path = fs::canonicalize(path)?;
            if exclude {
                excluded.insert(path);
            } else {
                included.insert(path);
            }
        }
    }
    Ok(included.difference(&excluded).cloned().collect())
}
fn npm_packages(root: &Path, npm: &Value) -> Result<Vec<PackageMetadata>> {
    if let Some(package) = metadata(root, &root.join("package.json"), npm, &Value::Null, false)? {
        return Ok(vec![package]);
    }
    let workspaces = npm.get("workspaces");
    let mut patterns = strings(
        if workspaces.is_some_and(Value::is_object) {
            workspaces.and_then(|value| value.get("packages"))
        } else {
            workspaces
        },
        "package.json workspaces",
    )?;
    if patterns.is_empty() {
        patterns = strings(
            optional(&root.join("pnpm-workspace.yaml"))?.get("packages"),
            "pnpm-workspace.yaml packages",
        )?;
    }
    let manifests = expand(root, &patterns, "package.json")?
        .into_iter()
        .map(|p| {
            let v = parse(&p)?;
            Ok((p, v))
        })
        .collect::<Result<Vec<_>>>()?;
    let mut optional_names = BTreeSet::new();
    for manifest in std::iter::once(npm).chain(manifests.iter().map(|(_, v)| v)) {
        if let Some(deps) = manifest.get("optionalDependencies") {
            let deps = deps
                .as_object()
                .context("optionalDependencies must be an object")?;
            optional_names.extend(deps.keys().cloned());
        }
    }
    let mut result = vec![];
    for (path, manifest) in manifests {
        if let Some(item) = metadata(root, &path, &manifest, &Value::Null, false)?
            && !optional_names.contains(&item.name)
        {
            result.push(item);
        }
    }
    Ok(result)
}
fn cargo_packages(root: &Path, cargo: &Value) -> Result<Vec<PackageMetadata>> {
    let workspace = &cargo["workspace"];
    if let Some(item) = metadata(
        root,
        &root.join("Cargo.toml"),
        cargo,
        &workspace["package"],
        false,
    )? {
        return Ok(vec![item]);
    }
    let defaults = strings(
        workspace.get("default-members"),
        "Cargo workspace default-members",
    )?;
    let members = strings(workspace.get("members"), "Cargo workspace members")?;
    let patterns = if defaults.is_empty() {
        members
    } else {
        defaults
    };
    let excluded = expand(
        root,
        &strings(workspace.get("exclude"), "Cargo workspace exclude")?,
        "Cargo.toml",
    )?;
    let mut result = vec![];
    for path in expand(root, &patterns, "Cargo.toml")? {
        if !excluded.contains(&path)
            && let Some(item) = metadata(root, &path, &parse(&path)?, &workspace["package"], false)?
        {
            result.push(item);
        }
    }
    Ok(result)
}
fn explicit_path(root: &Path, value: &str) -> Result<PathBuf> {
    let path = Path::new(value);
    if path.is_absolute() {
        bail!(
            "Package manifest path must be relative to {}: {value}",
            root.display()
        );
    }
    let mut relative = PathBuf::new();
    for part in path.components() {
        match part {
            Component::Normal(p) => relative.push(p),
            Component::CurDir => (),
            Component::ParentDir if relative.pop() => (),
            _ => bail!(
                "Package manifest path must stay inside {}: {value}",
                root.display()
            ),
        }
    }
    if relative.as_os_str().is_empty() {
        bail!(
            "Package manifest path must stay inside {}: {value}",
            root.display()
        );
    }
    let candidate = root.join(relative);
    if !regular(&candidate)
        || !candidate
            .file_name()
            .is_some_and(|n| n == "package.json" || n == "Cargo.toml")
    {
        bail!("Package manifest does not exist: {value}");
    }
    Ok(candidate)
}
fn pair(value: &str) -> Option<String> {
    let value = value.strip_suffix('/').unwrap_or(value);
    let value = value.strip_suffix(".git").unwrap_or(value);
    let parts = value.split('/').collect::<Vec<_>>();
    (parts.len() == 2 && parts.iter().all(|p| !p.is_empty())).then(|| value.to_owned())
}
fn repository(value: &Value) -> Option<String> {
    let value = value.as_str().or_else(|| value["url"].as_str())?.trim();
    let value = value.strip_prefix("git+").unwrap_or(value);
    if let Some(path) = value.strip_prefix("github:") {
        return pair(path);
    }
    if value.to_ascii_lowercase().starts_with("git@github.com:") {
        return pair(&value[15..]);
    }
    if let Some((_, rest)) = value.split_once("://") {
        let (authority, path) = rest.split_once('/')?;
        let host = authority.rsplit('@').next()?.split(':').next()?;
        if !host.eq_ignore_ascii_case("github.com") {
            return None;
        }
        return pair(path.split(['?', '#']).next()?);
    }
    pair(value)
}
fn workflow(root: &Path) -> Option<String> {
    let root = root.join(".github/workflows");
    for name in ["ci.yml", "ci.yaml"] {
        if regular(&root.join(name)) {
            return Some(name.to_owned());
        }
    }
    let names = fs::read_dir(&root)
        .ok()?
        .filter_map(Result::ok)
        .filter(|e| regular(&e.path()))
        .map(|e| e.file_name().to_string_lossy().into_owned())
        .filter(|n| n.ends_with(".yml") || n.ends_with(".yaml"))
        .collect::<Vec<_>>();
    if names.len() == 1 {
        names.into_iter().next()
    } else {
        None
    }
}
// Git is an optional metadata source. Keep this local query bounded so a broken
// Git installation cannot prevent Markdown generation indefinitely.
fn git_repository(root: &Path) -> Option<String> {
    let mut child = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["config", "--get", "remote.origin.url"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if start.elapsed() < Duration::from_secs(1) => {
                std::thread::sleep(Duration::from_millis(10))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
    let output = child.wait_with_output().ok()?;
    if !output.status.success() {
        return None;
    }
    repository(&Value::String(String::from_utf8(output.stdout).ok()?))
}

/// Discover publishable npm and crates.io packages in stable manifest order.
pub fn discover_project(root: &Path, packages: Option<&[String]>) -> Result<ProjectMetadata> {
    let root = fs::canonicalize(root)
        .with_context(|| format!("Unable to read project {}", root.display()))?;
    let npm = optional(&root.join("package.json"))?;
    let cargo = optional(&root.join("Cargo.toml"))?;
    let mut found = vec![];
    if let Some(paths) = packages {
        for value in paths {
            let path = explicit_path(&root, value)?;
            if let Some(item) = metadata(
                &root,
                &path,
                &parse(&path)?,
                &cargo["workspace"]["package"],
                true,
            )? {
                found.push(item);
            }
        }
    } else {
        found.extend(npm_packages(&root, &npm)?);
        found.extend(cargo_packages(&root, &cargo)?);
    }
    let mut seen = BTreeSet::new();
    found.retain(|p| seen.insert((p.registry.clone(), p.name.clone())));
    let repo = repository(&npm["repository"])
        .or_else(|| repository(&cargo["package"]["repository"]))
        .or_else(|| repository(&cargo["workspace"]["package"]["repository"]))
        .or_else(|| git_repository(&root));
    Ok(ProjectMetadata {
        packages: found,
        repository: repo,
        workflow: workflow(&root),
    })
}
