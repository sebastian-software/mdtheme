//! Deterministic Markdown badges derived from project manifests.
use crate::{
    Frame,
    metadata::{PackageMetadata, discover_project},
};
use anyhow::Result;
use serde::Deserialize;
use std::path::Path;

const SHIELDS: &str = "https://img.shields.io";
const COLOR: &str = "005164";

#[derive(Debug, Clone, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct BadgeOptions {
    pub enabled: bool,
    pub published: bool,
    pub workflow: Option<String>,
    pub packages: Option<Vec<String>>,
}
impl Default for BadgeOptions {
    fn default() -> Self {
        Self {
            enabled: false,
            published: true,
            workflow: None,
            packages: None,
        }
    }
}
fn encode(value: &str) -> String {
    let mut result = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            result.push(char::from(byte));
        } else {
            use std::fmt::Write;
            write!(result, "%{byte:02X}").expect("writing to a String cannot fail");
        }
    }
    result
}
fn static_part(value: &str) -> String {
    encode(value).replace('-', "--").replace('_', "__")
}
fn image(label: &str, image: &str, target: &str) -> String {
    let label = label
        .replace('\\', "\\\\")
        .replace('[', "\\[")
        .replace(']', "\\]");
    format!("[![{label}]({image})]({target})")
}
fn published_badges(item: &PackageMetadata) -> Vec<String> {
    let name = &item.name;
    let path = encode(name);
    let npm = item.registry == "npm";
    let registry = if npm { "npm" } else { "crates.io" };
    let route = if npm { "npm" } else { "crates" };
    let target = if npm {
        format!("https://www.npmjs.com/package/{path}")
    } else {
        format!("https://crates.io/crates/{path}")
    };
    let version = image(
        &format!("{registry} {name}"),
        &format!(
            "{SHIELDS}/{route}/v/{path}.svg?style=flat&label={}",
            encode(&format!("{registry}: {name}"))
        ),
        &target,
    );
    let period = if npm {
        "npm monthly"
    } else {
        "crates.io recent"
    };
    let metric = if npm { "dm" } else { "dr" };
    let label = format!("{period} downloads: {name}");
    let downloads = image(
        &label,
        &format!(
            "{SHIELDS}/{route}/{metric}/{path}.svg?style=flat&label={}",
            encode(&label)
        ),
        &target,
    );
    let mut badges = vec![version, downloads];
    if !npm && item.docs {
        let label = format!("docs.rs: {name}");
        badges.push(image(
            &label,
            &format!(
                "{SHIELDS}/docsrs/{path}?style=flat&label={}",
                encode(&label)
            ),
            &format!("https://docs.rs/{path}"),
        ));
    }
    badges
}
fn runtime_badges(packages: &[PackageMetadata]) -> Vec<String> {
    let mut groups: Vec<(&str, &str, Vec<&str>)> = vec![];
    for item in packages {
        let Some(runtime) = item.runtime.as_deref().filter(|s| !s.is_empty()) else {
            continue;
        };
        if let Some((_, _, names)) = groups
            .iter_mut()
            .find(|(registry, value, _)| *registry == item.registry && *value == runtime)
        {
            names.push(&item.name);
        } else {
            groups.push((&item.registry, runtime, vec![&item.name]));
        }
    }
    groups
        .iter()
        .map(|(registry, runtime, names)| {
            let ecosystem = if *registry == "npm" {
                "Node.js"
            } else {
                "Rust MSRV"
            };
            let distinct = groups.iter().filter(|(r, _, _)| r == registry).count();
            let message = if distinct == 1 {
                (*runtime).to_owned()
            } else {
                format!("{runtime} ({})", names.join(", "))
            };
            image(
                &format!("{ecosystem} {message}"),
                &format!(
                    "{SHIELDS}/badge/{}-{}-{COLOR}.svg?style=flat",
                    static_part(ecosystem),
                    static_part(&message)
                ),
                if *registry == "npm" {
                    "https://nodejs.org/"
                } else {
                    "https://www.rust-lang.org/"
                },
            )
        })
        .collect()
}
/// Generate the standard badge row. `enabled` controls config integration; callers
/// invoking this function explicitly receive badges regardless of that flag.
pub fn project_badges(root: &Path, options: &BadgeOptions) -> Result<Frame> {
    let project = discover_project(root, options.packages.as_deref())?;
    let mut badges = vec![];
    if options.published {
        for item in &project.packages {
            badges.extend(published_badges(item));
        }
    }
    if let (Some(repository), Some(workflow)) = (
        project.repository.as_deref(),
        options
            .workflow
            .as_deref()
            .or(project.workflow.as_deref())
            .filter(|w| !w.is_empty()),
    ) && let Some((owner, repo)) = repository.split_once('/')
    {
        let (owner, repo) = (encode(owner), encode(repo));
        let workflow = encode(workflow.rsplit(['/', '\\']).next().unwrap_or(workflow));
        badges.push(image(
            "GitHub Actions",
            &format!(
                "{SHIELDS}/github/actions/workflow/status/{owner}/{repo}/{workflow}?style=flat"
            ),
            &format!("https://github.com/{owner}/{repo}/actions/workflows/{workflow}"),
        ));
    }
    badges.extend(runtime_badges(&project.packages));
    for item in &project.packages {
        if let Some(license) = &item.license {
            let label = if project.packages.len() == 1 {
                "License".to_owned()
            } else {
                format!("License ({}: {})", item.registry, item.name)
            };
            let target = license
                .manifest
                .split('/')
                .map(encode)
                .collect::<Vec<_>>()
                .join("/");
            badges.push(image(
                &format!("{label}: {}", license.expression),
                &format!(
                    "{SHIELDS}/badge/{}-{}-{COLOR}.svg?style=flat",
                    static_part(&label),
                    static_part(&license.expression)
                ),
                &target,
            ));
        }
    }
    Ok(Frame {
        opening: badges.join(" "),
        closing: String::new(),
        ..Frame::default()
    })
}
