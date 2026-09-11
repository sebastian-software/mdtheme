use anyhow::{Result, bail, ensure};
use mdtheme::{config::Config, files, pre_push};
use std::{path::PathBuf, process::ExitCode};

const HELP: &str = "Usage: mdtheme <operation> [--config PATH]

Operations:
  --write    Generate README.md from Markdown and YAML configuration
  --check    Check for README drift without writing (exit 1 for drift)
  pre-push   Regenerate from a clean worktree and require a committed result
  --help     Show this help
  --version  Show the installed version

Configuration: mdtheme.yaml or mdtheme.yml in the current directory.
Remote themes accept Git branches, tags, and commits; the default ref is main.
Errors exit with status 2.";

fn run() -> Result<u8> {
    let mut args = std::env::args().skip(1);
    let mut operation = None;
    let mut config = None;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--write" | "--check" | "pre-push" | "--help" | "-h" | "--version" | "-v" => {
                ensure!(
                    operation.is_none(),
                    "Exactly one operation must be specified"
                );
                operation = Some(arg);
            }
            "--config" => {
                ensure!(config.is_none(), "--config may only be specified once");
                config = Some(
                    args.next()
                        .ok_or_else(|| anyhow::anyhow!("--config requires a path"))?,
                );
            }
            _ if arg.starts_with("--config=") => {
                ensure!(config.is_none(), "--config may only be specified once");
                config = Some(arg[9..].to_owned());
            }
            _ => bail!("Unknown argument: {arg}"),
        }
    }
    if let Some(path) = &config {
        ensure!(
            !path.is_empty() && !path.starts_with('-'),
            "--config requires a path"
        );
    }
    let operation =
        operation.ok_or_else(|| anyhow::anyhow!("Exactly one operation must be specified"))?;
    if operation == "--help" || operation == "-h" {
        println!("{HELP}");
        return Ok(0);
    }
    if operation == "--version" || operation == "-v" {
        println!("{}", env!("CARGO_PKG_VERSION"));
        return Ok(0);
    }
    let cwd = std::env::current_dir()?.canonicalize()?;
    let explicit = config.map(PathBuf::from);
    if operation == "pre-push" {
        return pre_push::run(&cwd, explicit.as_deref());
    }
    let config = Config::load(&cwd, explicit.as_deref())?;
    let changed = files::generate(&config, operation == "--write")?;
    if operation == "--check" && changed {
        eprintln!(
            "{} is out of date. Run mdtheme --write with the same config.",
            config.output.display()
        );
        return Ok(1);
    }
    println!(
        "{} {}.",
        config.output.display(),
        if changed { "updated" } else { "is up to date" }
    );
    Ok(0)
}

fn main() -> ExitCode {
    match run() {
        Ok(code) => ExitCode::from(code),
        Err(error) => {
            eprintln!("mdtheme: {error:#}");
            ExitCode::from(2)
        }
    }
}
