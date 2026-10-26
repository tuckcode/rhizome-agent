use std::io;
use std::path::Path;
use std::process::Output;

pub(super) fn git_output(dir: &Path, args: &[&str]) -> io::Result<Output> {
    let mut command = super::git_command_in(Some(dir)).map_err(io::Error::other)?;
    command.args(with_transport_pins(args)).output()
}

/// `git -c remote.<name>.uploadpack=` does not replace a repo-local value:
/// git keeps the first one and still runs it. The fetch/push flags do.
fn with_transport_pins<'a>(args: &'a [&'a str]) -> Vec<&'a str> {
    let Some(index) = subcommand_index(args) else {
        return args.to_vec();
    };
    let mut pinned = args.to_vec();
    let flag = match args[index] {
        "fetch" | "pull" | "ls-remote" | "clone" => "--upload-pack=git-upload-pack",
        "push" => "--receive-pack=git-receive-pack",
        _ => return pinned,
    };
    pinned.insert(index + 1, flag);
    pinned
}

fn subcommand_index(args: &[&str]) -> Option<usize> {
    let mut index = 0;
    while index < args.len() {
        if args[index] == "-c" {
            index += 2;
            continue;
        }
        return Some(index);
    }
    None
}

pub(super) fn git_output_result(dir: &Path, args: &[&str]) -> Result<Output, String> {
    git_output(dir, args).map_err(|e| format!("Failed to run git {}: {e}", git_command_label(args)))
}

pub(super) fn run_git(dir: &Path, args: &[&str]) -> Result<(), String> {
    let output = git_output_result(dir, args)?;

    if output.status.success() {
        return Ok(());
    }

    Err(stderr_text(&output))
}

pub(super) fn stdout_text(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

pub(super) fn stdout_lines(output: &Output) -> Vec<String> {
    stdout_text(output)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

pub(super) fn stderr_text(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).trim().to_string()
}

pub(super) fn stderr_or_failure(command: &str, output: &Output) -> String {
    let stderr = stderr_text(output);
    if stderr.is_empty() {
        format!("{command} failed")
    } else {
        stderr
    }
}

pub(super) fn git_command_label<'a>(args: &'a [&'a str]) -> &'a str {
    if args.first() == Some(&"-c") {
        return args.get(2).copied().unwrap_or(args[0]);
    }

    args[0]
}
