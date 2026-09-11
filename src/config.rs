use crate::{
    Frame,
    badges::{BadgeOptions, project_badges},
    safe_source_name,
    themes::{self, Theme},
};
use anyhow::{Context, Result, ensure};
use serde::Deserialize;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Debug, Default, Deserialize)]
#[serde(default, deny_unknown_fields)]
struct Document {
    source: Option<String>,
    output: Option<String>,
    themes: Vec<Theme>,
    badges: BadgeOptions,
}

pub struct Config {
    pub directory: PathBuf,
    pub path: Option<PathBuf>,
    pub source: PathBuf,
    pub output: PathBuf,
    document: Document,
}

impl Config {
    pub fn load(cwd: &Path, explicit: Option<&Path>) -> Result<Self> {
        let path = if let Some(path) = explicit {
            Some(
                cwd.join(path)
                    .canonicalize()
                    .context("Cannot find config")?,
            )
        } else {
            let found: Vec<_> = ["mdtheme.yaml", "mdtheme.yml"]
                .into_iter()
                .map(|name| cwd.join(name))
                .filter(|p| p.exists())
                .collect();
            ensure!(found.len() <= 1, "Multiple mdtheme configs found");
            if found.is_empty() {
                ensure!(
                    ![
                        "mdtheme.config.ts",
                        "mdtheme.config.mts",
                        "mdtheme.config.js",
                        "mdtheme.config.mjs"
                    ]
                    .iter()
                    .any(|name| cwd.join(name).exists()),
                    "Executable configs are no longer supported. Migrate to mdtheme.yaml."
                );
            }
            found.first().map(|p| p.canonicalize()).transpose()?
        };
        let directory = path
            .as_ref()
            .and_then(|p| p.parent())
            .unwrap_or(cwd)
            .canonicalize()?;
        let document: Document = match &path {
            Some(path) => serde_yaml_ng::from_str(&fs::read_to_string(path)?)
                .context("Invalid YAML config")?,
            None => Document::default(),
        };
        let source_name = document.source.as_deref().unwrap_or("README.md.src");
        ensure!(
            safe_source_name(source_name),
            "source must be a simple basename using letters, numbers, ., _, or -"
        );
        ensure!(
            document.output.as_deref().unwrap_or("README.md") == "README.md",
            "output must be README.md in the config directory"
        );
        Ok(Self {
            source: directory.join(source_name),
            output: directory.join("README.md"),
            directory,
            path,
            document,
        })
    }

    pub fn frames(&self) -> Result<Vec<Frame>> {
        let mut frames = self
            .document
            .themes
            .iter()
            .map(|theme| themes::load(theme, &self.directory))
            .collect::<Result<Vec<_>>>()?;
        if self.document.badges.enabled {
            let mut badges = project_badges(&self.directory, &self.document.badges)?;
            badges.badges_prepend = std::mem::take(&mut badges.opening);
            frames.push(badges);
        }
        Ok(frames)
    }
}
