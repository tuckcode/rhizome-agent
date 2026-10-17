//! One shell command in the vault root.
//!
//! The working directory is the current vault from
//! [`super::sandbox::allowed_roots`]. The model cannot choose it.
//! The child starts with an empty environment plus an allowlist.
//! Unix puts the child in its own process group (`process-wrap`).
//! Windows puts it in a Job Object created suspended, assigned, then
//! resumed, with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
//! `process-wrap`'s std `JobObject` calls `make_job_object(..., false)`,
//! so that flag is set here instead of by the stock wrapper.

use std::collections::VecDeque;
use std::io::{ErrorKind, Read};
use std::path::PathBuf;
use std::process::{ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use process_wrap::std::{StdChildWrapper, StdCommandWrap};
use serde::{Deserialize, Serialize};

use super::args;
use super::sandbox;
use super::text;

pub(crate) const SCHEMA: &str = r#"{
  "type": "function",
  "function": {
    "name": "bash",
    "description": "Run one shell command in the active vault. The working directory is the vault root and cannot be set by the caller. Offered in Power User only. Every call asks for approval; there is no session grant. timeout_secs defaults to 60, including when the value is missing or invalid, and is capped at 300. stdin is closed. Each of stdout and stderr keeps the first 15360 bytes and the last 15360 bytes.",
    "parameters": {
      "type": "object",
      "properties": {
        "command": {
          "type": "string",
          "description": "The shell command to run, passed to sh -c on Unix or cmd /S /C on Windows."
        },
        "timeout_secs": {
          "type": "integer",
          "minimum": 1,
          "maximum": 300,
          "description": "Seconds before the process group is killed. Defaults to 60. Values above 300 are capped at 300."
        }
      },
      "required": ["command"],
      "additionalProperties": false
    }
  }
}"#;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(60);
const MAX_TIMEOUT_SECS: u64 = 300;
/// After the leader is gone, how long readers may wait for a detached child to close the pipes.
const READER_GRACE: Duration = Duration::from_millis(750);
/// Timeout and cancel ask the group to exit before SIGKILL.
const TERM_GRACE: Duration = Duration::from_secs(2);
const DETACHED_NOTE: &str = "[background process still holds output; detached]";
/// First bytes kept from each stream. A character that does not fit stays out of this buffer.
const HEAD_BYTES: usize = 15 * 1024;
/// Rolling end of each stream. Bytes that fall out of this ring are the hidden middle.
const TAIL_BYTES: usize = 15 * 1024;
const POLL: Duration = Duration::from_millis(20);
const NO_VAULT: &str = "No active vault is available for bash.";
const NOT_APPROVED: &str = "bash was not approved for this call.";

#[cfg(unix)]
const UNIX_ENV: &[&str] = &["PATH", "HOME", "USER", "LANG", "TERM", "TMPDIR"];

#[cfg(windows)]
const WINDOWS_ENV: &[&str] = &[
    "PATH",
    "HOME",
    "USER",
    "LANG",
    "TERM",
    "TMPDIR",
    "SystemRoot",
    "SYSTEMROOT",
    "COMSPEC",
    "PATHEXT",
    "WINDIR",
    "SYSTEMDRIVE",
    "TEMP",
    "TMP",
    "USERPROFILE",
    "USERNAME",
    "HOMEDRIVE",
    "HOMEPATH",
];

/// Inputs for one approved bash call.
pub(crate) struct ShellInput<'a> {
    pub args: &'a str,
    pub vault_path: Option<&'a str>,
    pub vault_paths: &'a [String],
    pub call_id: &'a str,
    /// Stamp from the approval that just happened. `None` means
    /// this call was not approved.
    pub stamp: Option<&'a str>,
    pub is_cancelled: &'a dyn Fn() -> bool,
    /// Test override. Production passes `None` and uses `timeout_secs`.
    pub timeout: Option<Duration>,
}

/// The command string the approval card shows. Not trimmed.
pub(crate) fn command_from_args(raw_args: &str) -> Result<String, String> {
    let args = args::parse_object(raw_args, "bash")?;
    let command = args::required_string(&args, "command", "bash")?;
    if command.is_empty() {
        return Err("bash requires command.".into());
    }
    Ok(command.to_string())
}

/// Binds an approval to this tool-call id and the exact command.
/// Each part is length-prefixed so a NUL inside either string cannot shift the boundary.
pub(crate) fn approval_stamp(call_id: &str, command: &str) -> String {
    let mut bytes = Vec::with_capacity(16 + call_id.len() + command.len());
    push_prefixed(&mut bytes, call_id.as_bytes());
    push_prefixed(&mut bytes, command.as_bytes());
    text::hash_bytes(&bytes)
}

fn push_prefixed(out: &mut Vec<u8>, part: &[u8]) {
    let len = u64::try_from(part.len()).unwrap_or(u64::MAX);
    out.extend_from_slice(&len.to_le_bytes());
    out.extend_from_slice(part);
}

pub(crate) fn run(input: &ShellInput<'_>) -> Result<String, String> {
    let command = command_from_args(input.args)?;
    let timeout = input
        .timeout
        .unwrap_or_else(|| timeout_from_args(input.args));
    if (input.is_cancelled)() {
        return stopped_result();
    }
    if !approved(input.call_id, &command, input.stamp) {
        return Err(NOT_APPROVED.into());
    }
    let cwd = vault_cwd(input.vault_path, input.vault_paths)?;
    if (input.is_cancelled)() {
        return stopped_result();
    }
    let mut child = spawn_shell(&command, &cwd)?;
    let stdout = child.stdout().take();
    let stderr = child.stderr().take();
    let stdout_reader = spawn_reader(stdout);
    let stderr_reader = spawn_reader(stderr);
    let mut running = Running {
        child,
        reaped: false,
    };
    let outcome = running.wait_for(timeout, input.is_cancelled)?;
    let (stdout, stderr, detached) =
        finish_readers(stdout_reader, stderr_reader, input.is_cancelled);
    // Cancel during the reader grace, after a normal exit, keeps that
    // exit code. Stop only replaces an outcome that did not already exit.
    let outcome = match outcome {
        Outcome::Exit(_) => outcome,
        _ if detached && (input.is_cancelled)() => Outcome::Cancelled,
        _ => outcome,
    };
    render_outcome(outcome, stdout, stderr, detached)
}

/// Missing or unusable `timeout_secs` uses 60s. Values above 300 are clamped.
fn timeout_from_args(raw_args: &str) -> Duration {
    let Ok(args) = args::parse_object(raw_args, "bash") else {
        return DEFAULT_TIMEOUT;
    };
    match args.get("timeout_secs") {
        None | Some(serde_json::Value::Null) => DEFAULT_TIMEOUT,
        Some(serde_json::Value::Number(number)) => match number.as_u64() {
            Some(0) | None => DEFAULT_TIMEOUT,
            Some(secs) => Duration::from_secs(secs.min(MAX_TIMEOUT_SECS)),
        },
        // Strings, including "7", are not whole numbers. The card agrees.
        _ => DEFAULT_TIMEOUT,
    }
}

fn vault_cwd(vault_path: Option<&str>, vault_paths: &[String]) -> Result<PathBuf, String> {
    if vault_path
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .is_none()
    {
        return Err(NO_VAULT.into());
    }
    let roots = sandbox::allowed_roots(vault_path, vault_paths)?;
    roots.current.clone().ok_or_else(|| NO_VAULT.to_string())
}

fn approved(call_id: &str, command: &str, stamp: Option<&str>) -> bool {
    stamp.is_some_and(|stamp| stamp == approval_stamp(call_id, command))
}

fn spawn_shell(command: &str, cwd: &PathBuf) -> Result<Box<dyn StdChildWrapper>, String> {
    #[cfg(unix)]
    {
        spawn_unix(command, cwd)
    }
    #[cfg(windows)]
    {
        spawn_windows(command, cwd)
    }
}

#[cfg(unix)]
fn spawn_unix(command: &str, cwd: &PathBuf) -> Result<Box<dyn StdChildWrapper>, String> {
    use process_wrap::std::ProcessGroup;

    let mut wrapped = StdCommandWrap::with_new("/bin/sh", |cmd| {
        cmd.arg("-c").arg(command);
        cmd.current_dir(cwd);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        apply_env(cmd, UNIX_ENV);
    });
    wrapped.wrap(ProcessGroup::leader());
    wrapped
        .spawn()
        .map_err(|error| format!("Failed to start bash: {error}"))
}

#[cfg(windows)]
fn spawn_windows(command: &str, cwd: &PathBuf) -> Result<Box<dyn StdChildWrapper>, String> {
    let program = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into());
    let mut wrapped = StdCommandWrap::with_new(program, |cmd| {
        use std::os::windows::process::CommandExt;
        cmd.raw_arg("/S");
        cmd.raw_arg("/C");
        cmd.raw_arg(command);
        cmd.current_dir(cwd);
        cmd.stdin(Stdio::null());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        apply_env(cmd, WINDOWS_ENV);
    });
    wrapped.wrap(windows_job::KillOnCloseJob);
    wrapped
        .spawn()
        .map_err(|error| format!("Failed to start bash: {error}"))
}

fn apply_env(command: &mut std::process::Command, names: &[&str]) {
    command.env_clear();
    for name in names {
        if let Some(value) = std::env::var_os(name) {
            if !value.is_empty() {
                command.env(name, value);
            }
        }
    }
}

struct Running {
    child: Box<dyn StdChildWrapper>,
    /// True after `wait` has reaped the leader. A later `killpg` could
    /// hit a recycled pid, so the group is never signalled once this
    /// is set.
    reaped: bool,
}

enum Outcome {
    Exit(ExitStatus),
    TimedOut,
    Cancelled,
}

impl Running {
    fn wait_for(
        &mut self,
        timeout: Duration,
        is_cancelled: &dyn Fn() -> bool,
    ) -> Result<Outcome, String> {
        let deadline = Instant::now() + timeout;
        loop {
            if is_cancelled() {
                self.stop_group(true)?;
                return Ok(Outcome::Cancelled);
            }
            if Instant::now() >= deadline {
                self.stop_group(true)?;
                return Ok(Outcome::TimedOut);
            }
            if self.leader_finished()? {
                let status = self.stop_group(false)?;
                return Ok(Outcome::Exit(status));
            }
            thread::sleep(POLL);
        }
    }

    /// Drain the group, then reap.
    ///
    /// `polite` is the timeout and cancel path: SIGTERM, about 2s, then
    /// SIGKILL. A leader that has already exited skips that wait so
    /// `sleep 600 &` does not sit out the grace. `start_kill` is
    /// `killpg` SIGKILL on Unix and `TerminateJobObject` on Windows.
    fn stop_group(&mut self, polite: bool) -> Result<ExitStatus, String> {
        if self.reaped {
            return Err("bash already reaped".into());
        }
        // Windows has no SIGTERM for a job. TerminateJobObject runs below.
        if polite && cfg!(unix) && !self.leader_finished()? {
            self.signal_term();
            let deadline = Instant::now() + TERM_GRACE;
            while Instant::now() < deadline {
                if self.leader_finished()? {
                    break;
                }
                thread::sleep(POLL);
            }
        }
        // Kill the group before `wait` reaps the leader. A later
        // `killpg` could hit a recycled pid.
        let _ = self.child.start_kill();
        let status = self
            .child
            .wait()
            .map_err(|error| format!("Failed to wait for bash: {error}"))?;
        self.reaped = true;
        Ok(status)
    }

    fn signal_term(&self) {
        #[cfg(unix)]
        {
            use nix::sys::signal::{killpg, Signal};
            use nix::unistd::Pid;
            let Ok(raw) = i32::try_from(self.child.id()) else {
                return;
            };
            if raw <= 0 {
                return;
            }
            let _ = killpg(Pid::from_raw(raw), Signal::SIGTERM);
        }
    }

    fn leader_finished(&mut self) -> Result<bool, String> {
        #[cfg(unix)]
        {
            Ok(leader_exited_unreaped(self.child.id()))
        }
        #[cfg(windows)]
        {
            // `try_wait` reaps. Job termination afterwards is the job
            // handle, not `killpg`, so a recycled pid is not a concern.
            match self.child.try_wait() {
                Ok(Some(_)) => Ok(true),
                Ok(None) => Ok(false),
                Err(error) => Err(format!("Failed to wait for bash: {error}")),
            }
        }
    }
}

impl Drop for Running {
    fn drop(&mut self) {
        if !self.reaped {
            let _ = self.child.start_kill();
            let _ = self.child.wait();
            self.reaped = true;
        }
    }
}

#[cfg(unix)]
fn leader_exited_unreaped(pid: u32) -> bool {
    let Ok(pid) = i32::try_from(pid) else {
        return false;
    };
    if pid <= 0 {
        return false;
    }
    unix_ffi::leader_exited_unreaped(pid)
}

/// libc `waitid` and the non-blocking pipe flag. Callers stay in safe code.
/// nix has no `waitid` on Apple, and macOS `waitpid` ignores `WNOWAIT`.
#[cfg(unix)]
mod unix_ffi {
    pub(super) fn set_nonblocking(pipe: &impl std::os::fd::AsFd) {
        use nix::fcntl::{fcntl, FcntlArg, OFlag};
        let Ok(bits) = fcntl(pipe, FcntlArg::F_GETFL) else {
            return;
        };
        let flags = OFlag::from_bits_truncate(bits) | OFlag::O_NONBLOCK;
        let _ = fcntl(pipe, FcntlArg::F_SETFL(flags));
    }

    /// True when `pid` is a zombie. Does not reap it.
    pub(super) fn leader_exited_unreaped(pid: i32) -> bool {
        let mut info = std::mem::MaybeUninit::<libc::siginfo_t>::zeroed();
        // SAFETY: `info` is a zeroed `siginfo_t` this function owns. `P_PID`
        // plus this pid names the leader. `WNOWAIT` reports the zombie
        // without reaping it on Linux and on xnu. `si_pid` reads the pid
        // `waitid` stored; 0 means `WNOHANG` found no status. The caller
        // reaps exactly once later.
        unsafe {
            let info = info.assume_init_mut();
            let rc = libc::waitid(
                libc::P_PID,
                pid as libc::id_t,
                info,
                libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
            );
            rc == 0 && info.si_pid() == pid
        }
    }
}

struct PipeReader {
    capture: Arc<Mutex<StreamCapture>>,
    stop: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

enum ReadPoll {
    Data(usize),
    Pending,
    Eof,
}

#[cfg(unix)]
fn spawn_reader<R>(pipe: Option<R>) -> PipeReader
where
    R: Read + std::os::fd::AsFd + Send + 'static,
{
    spawn_reader_with(pipe, |pipe| unix_ffi::set_nonblocking(pipe))
}

#[cfg(windows)]
fn spawn_reader<R>(pipe: Option<R>) -> PipeReader
where
    R: Read + std::os::windows::io::AsRawHandle + Send + 'static,
{
    spawn_reader_with(pipe, |_| {})
}

#[cfg(unix)]
trait ReaderPipe: Read {}
#[cfg(unix)]
impl<T: Read> ReaderPipe for T {}

#[cfg(windows)]
trait ReaderPipe: Read + std::os::windows::io::AsRawHandle {}
#[cfg(windows)]
impl<T: Read + std::os::windows::io::AsRawHandle> ReaderPipe for T {}

fn spawn_reader_with<R>(
    pipe: Option<R>,
    prepare: impl FnOnce(&mut R) + Send + 'static,
) -> PipeReader
where
    R: ReaderPipe + Send + 'static,
{
    let capture = Arc::new(Mutex::new(StreamCapture::default()));
    let stop = Arc::new(AtomicBool::new(false));
    let Some(mut pipe) = pipe else {
        return PipeReader {
            capture,
            stop,
            handle: None,
        };
    };
    let slot = Arc::clone(&capture);
    let flag = Arc::clone(&stop);
    let handle = thread::spawn(move || {
        prepare(&mut pipe);
        let mut buf = [0u8; 8192];
        loop {
            match poll_pipe(&mut pipe, &mut buf) {
                ReadPoll::Data(n) => {
                    if let Ok(mut guard) = slot.lock() {
                        guard.push_bytes(&buf[..n]);
                    }
                }
                ReadPoll::Eof => break,
                ReadPoll::Pending => {
                    if flag.load(Ordering::Relaxed) {
                        break;
                    }
                    thread::sleep(POLL);
                }
            }
        }
    });
    PipeReader {
        capture,
        stop,
        handle: Some(handle),
    }
}

#[cfg(not(windows))]
fn poll_pipe<R: Read>(pipe: &mut R, buf: &mut [u8]) -> ReadPoll {
    poll_read(pipe, buf)
}

#[cfg(windows)]
fn poll_pipe<R>(pipe: &mut R, buf: &mut [u8]) -> ReadPoll
where
    R: Read + std::os::windows::io::AsRawHandle,
{
    poll_pipe_windows(pipe, buf)
}

fn poll_read(pipe: &mut impl Read, buf: &mut [u8]) -> ReadPoll {
    match pipe.read(buf) {
        Ok(0) => ReadPoll::Eof,
        Ok(n) => ReadPoll::Data(n),
        Err(error) if error.kind() == ErrorKind::Interrupted => ReadPoll::Pending,
        Err(error) if error.kind() == ErrorKind::WouldBlock => ReadPoll::Pending,
        Err(_) => ReadPoll::Eof,
    }
}

#[cfg(windows)]
fn poll_pipe_windows<R>(pipe: &mut R, buf: &mut [u8]) -> ReadPoll
where
    R: Read + std::os::windows::io::AsRawHandle,
{
    use std::os::windows::io::AsRawHandle;
    use windows::Win32::Foundation::HANDLE;

    let handle = HANDLE(pipe.as_raw_handle() as _);
    let Some(available) = win_ffi::bytes_available(handle) else {
        return match pipe.read(buf) {
            Ok(n) if n > 0 => ReadPoll::Data(n),
            _ => ReadPoll::Eof,
        };
    };
    if available == 0 {
        return ReadPoll::Pending;
    }
    poll_read(pipe, buf)
}

/// One grace for both pipes. Readers poll instead of blocking in `read`,
/// so setting the stop flag lets them exit and be joined. A detached
/// child no longer leaves a thread behind.
fn finish_readers(
    mut stdout: PipeReader,
    mut stderr: PipeReader,
    is_cancelled: &dyn Fn() -> bool,
) -> (StreamCapture, StreamCapture, bool) {
    let started = Instant::now();
    let detached = loop {
        let out_done = stdout.try_join();
        let err_done = stderr.try_join();
        if out_done && err_done {
            break false;
        }
        if is_cancelled() || started.elapsed() >= READER_GRACE {
            stdout.stop_and_join();
            stderr.stop_and_join();
            break true;
        }
        thread::sleep(POLL);
    };
    (stdout.take(), stderr.take(), detached)
}

impl PipeReader {
    fn try_join(&mut self) -> bool {
        let Some(handle) = self.handle.as_ref() else {
            return true;
        };
        if !handle.is_finished() {
            return false;
        }
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        true
    }

    fn stop_and_join(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }

    fn take(&self) -> StreamCapture {
        let mut guard = self
            .capture
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        guard.flush_pending();
        std::mem::take(&mut *guard)
    }
}

fn stopped_result() -> Result<String, String> {
    render_outcome(
        Outcome::Cancelled,
        StreamCapture::default(),
        StreamCapture::default(),
        false,
    )
}

fn render_outcome(
    outcome: Outcome,
    stdout: StreamCapture,
    stderr: StreamCapture,
    detached: bool,
) -> Result<String, String> {
    let stdout = stdout.finish();
    let mut stderr = stderr.finish();
    if detached {
        if !stderr.text.is_empty() && !stderr.text.ends_with('\n') {
            stderr.text.push('\n');
        }
        stderr.text.push_str(DETACHED_NOTE);
        stderr.text.push('\n');
    }
    let (exit_code, timed_out, stopped) = match outcome {
        Outcome::Exit(status) => (Some(exit_code(status)), false, false),
        Outcome::TimedOut => (None, true, false),
        Outcome::Cancelled => (None, false, true),
    };
    encode_result(&BashResult {
        kind: "bash_result".to_string(),
        exit_code,
        timed_out,
        stopped,
        stdout: stdout.text,
        stderr: stderr.text,
        stdout_truncated: stdout.truncated,
        stderr_truncated: stderr.truncated,
        stdout_lines_hidden: stdout.lines_hidden,
        stderr_lines_hidden: stderr.lines_hidden,
    })
}

fn encode_result(result: &BashResult) -> Result<String, String> {
    serde_json::to_string(result).map_err(|error| format!("Failed to encode bash result: {error}"))
}

fn exit_code(status: ExitStatus) -> i32 {
    if let Some(code) = status.code() {
        return code;
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if let Some(signal) = status.signal() {
            return 128 + signal;
        }
    }
    -1
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct BashResult {
    kind: String,
    exit_code: Option<i32>,
    timed_out: bool,
    stopped: bool,
    stdout: String,
    stderr: String,
    stdout_truncated: bool,
    stderr_truncated: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    stdout_lines_hidden: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    stderr_lines_hidden: Option<u64>,
}

struct CapturedText {
    text: String,
    truncated: bool,
    lines_hidden: Option<u64>,
}

#[derive(Default)]
struct StreamCapture {
    head: Vec<u8>,
    tail: VecDeque<u8>,
    /// Incomplete UTF-8 sequence at the end of the last chunk.
    pending: Vec<u8>,
    /// True after the head has stopped accepting characters.
    past_head: bool,
    truncated: bool,
    dropped_newlines: u64,
}

impl StreamCapture {
    fn push_bytes(&mut self, chunk: &[u8]) {
        let mut data = std::mem::take(&mut self.pending);
        data.extend_from_slice(chunk);
        let mut index = 0;
        while index < data.len() {
            let rest = &data[index..];
            match std::str::from_utf8(rest) {
                Ok(text) => {
                    for ch in text.chars() {
                        self.push_char(ch);
                    }
                    break;
                }
                Err(error) => {
                    let valid = error.valid_up_to();
                    if valid > 0 {
                        let text = std::str::from_utf8(&rest[..valid]).expect("valid utf-8 prefix");
                        for ch in text.chars() {
                            self.push_char(ch);
                        }
                        index += valid;
                    }
                    match error.error_len() {
                        None => {
                            self.pending = data[index..].to_vec();
                            return;
                        }
                        Some(len) => {
                            for _ in 0..len {
                                self.push_char('\u{FFFD}');
                            }
                            index += len;
                        }
                    }
                }
            }
        }
    }

    fn push_char(&mut self, ch: char) {
        let mut buf = [0u8; 4];
        let bytes = ch.encode_utf8(&mut buf).as_bytes();
        if !self.past_head && self.head.len() + bytes.len() <= HEAD_BYTES {
            self.head.extend_from_slice(bytes);
            return;
        }
        self.past_head = true;
        self.push_tail(bytes);
    }

    fn push_tail(&mut self, bytes: &[u8]) {
        if bytes.len() > TAIL_BYTES {
            self.truncated = true;
            return;
        }
        while self.tail.len() + bytes.len() > TAIL_BYTES {
            self.dropped_newlines += pop_front_char(&mut self.tail);
            self.truncated = true;
        }
        self.tail.extend(bytes);
    }

    fn flush_pending(&mut self) {
        let pending = std::mem::take(&mut self.pending);
        for _ in pending {
            self.push_char('\u{FFFD}');
        }
    }

    fn finish(mut self) -> CapturedText {
        self.flush_pending();
        let StreamCapture {
            head,
            tail,
            truncated,
            dropped_newlines,
            ..
        } = self;
        if !truncated {
            let mut bytes = head;
            bytes.extend(tail);
            return CapturedText {
                text: String::from_utf8(bytes).expect("capture is utf-8"),
                truncated: false,
                lines_hidden: None,
            };
        }
        let mut text = String::from_utf8(head).expect("head is utf-8");
        text.push_str(&format!("\n… [{dropped_newlines} lines hidden] …\n"));
        text.push_str(&String::from_utf8(Vec::from(tail)).expect("tail is utf-8"));
        CapturedText {
            text,
            truncated: true,
            lines_hidden: Some(dropped_newlines),
        }
    }
}

/// Drops one UTF-8 character from the front of the ring. The ring only
/// contains complete characters. Returns how many `\n` bytes it held.
fn pop_front_char(tail: &mut VecDeque<u8>) -> u64 {
    let first = tail.pop_front().expect("tail character");
    let width = match first {
        byte if byte < 0x80 => 1,
        byte if byte & 0xE0 == 0xC0 => 2,
        byte if byte & 0xF0 == 0xE0 => 3,
        _ => 4,
    };
    let mut newlines = u64::from(first == b'\n');
    for _ in 1..width {
        let byte = tail.pop_front().expect("utf-8 continuation");
        if byte == b'\n' {
            newlines += 1;
        }
    }
    newlines
}

/// One safe wrapper per Win32 call the job and the pipe reader need.
#[cfg(windows)]
mod win_ffi {
    use std::io::{Error, Result};
    use std::os::windows::io::{FromRawHandle, OwnedHandle};

    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Thread32First, Thread32Next, TH32CS_SNAPTHREAD, THREADENTRY32,
    };
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };
    use windows::Win32::System::Pipes::PeekNamedPipe;
    use windows::Win32::System::Threading::{
        GetProcessId, OpenThread, ResumeThread, THREAD_SUSPEND_RESUME,
    };

    /// Bytes waiting on a pipe read end. `None` means the write end is gone.
    pub(super) fn bytes_available(handle: HANDLE) -> Option<u32> {
        let mut available = 0u32;
        // SAFETY: `handle` is the read end the caller owns. PeekNamedPipe
        // does not consume bytes. A zero count means the pipe is empty.
        let peeked = unsafe { PeekNamedPipe(handle, None, 0, None, Some(&mut available), None) };
        peeked.is_ok().then_some(available)
    }

    pub(super) fn terminate_job(job: HANDLE) -> Result<()> {
        // SAFETY: `job` is a Job Object the caller owns. TerminateJobObject
        // ends every process in it and does not close the handle.
        unsafe { TerminateJobObject(job, 1) }.map_err(Error::other)
    }

    pub(super) fn terminate_process(process: HANDLE) {
        use windows::Win32::System::Threading::TerminateProcess;
        // SAFETY: `process` is the suspended child. TerminateProcess ends it
        // if job setup failed before the process was resumed.
        unsafe { TerminateProcess(process, 1) }.ok();
    }

    pub(super) fn create_job() -> Result<HANDLE> {
        // SAFETY: a null name creates a new job this process owns.
        unsafe { CreateJobObjectW(None, None) }.map_err(Error::other)
    }

    pub(super) fn set_kill_on_close(job: HANDLE) -> Result<()> {
        let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        // SAFETY: `job` is the object just created. `info` is a valid
        // extended-limit struct, and the length is its size. This sets
        // kill-on-close and does not free the handle.
        unsafe {
            SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as _,
                std::mem::size_of_val(&info)
                    .try_into()
                    .expect("job info fits in u32"),
            )
        }
        .map_err(Error::other)
    }

    pub(super) fn assign_process(job: HANDLE, process: HANDLE) -> Result<()> {
        // SAFETY: `job` is the new job and `process` is the suspended child.
        // AssignProcessToJobObject puts the child in the job.
        unsafe { AssignProcessToJobObject(job, process) }.map_err(Error::other)
    }

    pub(super) fn close_handle(handle: HANDLE) -> Result<()> {
        // SAFETY: `handle` is an owned kernel object the caller is releasing
        // exactly once.
        unsafe { CloseHandle(handle) }.map_err(Error::other)
    }

    pub(super) fn own_handle(handle: HANDLE) -> OwnedHandle {
        // SAFETY: `handle` is an owned kernel object. `OwnedHandle` closes
        // it exactly once on drop.
        unsafe { OwnedHandle::from_raw_handle(handle.0 as *mut std::ffi::c_void) }
    }

    pub(super) fn process_id(process: HANDLE) -> u32 {
        // SAFETY: `process` is the child. GetProcessId reads its pid and
        // does not close the handle.
        unsafe { GetProcessId(process) }
    }

    pub(super) fn thread_snapshot() -> Result<HANDLE> {
        // SAFETY: CreateToolhelp32Snapshot returns an owned snapshot.
        // The caller closes it.
        unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0) }.map_err(Error::other)
    }

    /// Resume every thread of `pid` in this snapshot.
    pub(super) fn resume_suspended(pid: u32, snapshot: HANDLE) -> Result<()> {
        // SAFETY: `snapshot` is a thread snapshot the caller owns.
        // Thread32First / Thread32Next walk it. OpenThread returns a handle
        // that is closed before the next thread. ResumeThread continues a
        // thread created with CREATE_SUSPENDED.
        unsafe {
            let mut entry = THREADENTRY32 {
                dwSize: std::mem::size_of::<THREADENTRY32>() as u32,
                ..THREADENTRY32::default()
            };
            let mut more = Thread32First(snapshot, &mut entry);
            while more.is_ok() {
                if entry.th32OwnerProcessID == pid {
                    let thread = OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID)?;
                    if ResumeThread(thread) == u32::MAX {
                        let error = Error::last_os_error();
                        CloseHandle(thread).ok();
                        return Err(error);
                    }
                    CloseHandle(thread).ok();
                }
                more = Thread32Next(snapshot, &mut entry);
            }
            Ok(())
        }
    }
}

#[cfg(windows)]
mod windows_job {
    use std::io::{Error, Result};
    use std::os::windows::io::{AsRawHandle, OwnedHandle};
    use std::os::windows::process::CommandExt;
    use std::process::{Child, Command, ExitStatus};

    use process_wrap::std::{StdChildWrapper, StdCommandWrap, StdCommandWrapper};
    use windows::Win32::Foundation::HANDLE;
    use windows::Win32::System::Threading::{CREATE_NO_WINDOW, CREATE_SUSPENDED};

    use super::win_ffi;

    #[derive(Clone, Copy, Debug)]
    pub struct KillOnCloseJob;

    impl StdCommandWrapper for KillOnCloseJob {
        fn pre_spawn(&mut self, command: &mut Command, _core: &StdCommandWrap) -> Result<()> {
            command.creation_flags((CREATE_SUSPENDED | CREATE_NO_WINDOW).0);
            Ok(())
        }

        fn wrap_child(
            &mut self,
            inner: Box<dyn StdChildWrapper>,
            _core: &StdCommandWrap,
        ) -> Result<Box<dyn StdChildWrapper>> {
            let handle = HANDLE(inner.inner().as_raw_handle() as _);
            let job = match make_job(handle) {
                Ok(job) => job,
                Err(error) => {
                    kill_suspended(inner.as_ref());
                    return Err(error);
                }
            };
            if let Err(error) = resume_threads(handle) {
                let raw = sys_handle(&job);
                win_ffi::terminate_job(raw).ok();
                drop(job);
                kill_suspended(inner.as_ref());
                return Err(error);
            }
            Ok(Box::new(JobChild { inner, job }))
        }
    }

    /// `OwnedHandle` is `Send` and `Sync`. A raw `HANDLE` is neither, so
    /// the job cannot live in the child wrapper as a bare pointer.
    struct JobChild {
        inner: Box<dyn StdChildWrapper>,
        job: OwnedHandle,
    }

    impl std::fmt::Debug for JobChild {
        fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            formatter
                .debug_struct("JobChild")
                .field("id", &self.inner.id())
                .finish_non_exhaustive()
        }
    }

    impl StdChildWrapper for JobChild {
        fn inner(&self) -> &Child {
            self.inner.inner()
        }
        fn inner_mut(&mut self) -> &mut Child {
            self.inner.inner_mut()
        }
        fn into_inner(self: Box<Self>) -> Child {
            // The trait requires this. Closing the job would kill the
            // child (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`). The shell
            // never calls this, so the job handle is leaked and the
            // child is left running.
            let JobChild { inner, job } = *self;
            std::mem::forget(job);
            inner.into_inner()
        }
        fn start_kill(&mut self) -> Result<()> {
            win_ffi::terminate_job(sys_handle(&self.job))
        }
        fn try_wait(&mut self) -> Result<Option<ExitStatus>> {
            self.inner.try_wait()
        }
        fn wait(&mut self) -> Result<ExitStatus> {
            self.inner.wait()
        }
    }

    fn sys_handle(job: &OwnedHandle) -> HANDLE {
        HANDLE(job.as_raw_handle() as _)
    }

    fn kill_suspended(inner: &dyn StdChildWrapper) {
        let handle = HANDLE(inner.inner().as_raw_handle() as _);
        win_ffi::terminate_process(handle);
    }

    fn make_job(process: HANDLE) -> Result<OwnedHandle> {
        let job = win_ffi::create_job()?;
        win_ffi::set_kill_on_close(job)?;
        if let Err(error) = win_ffi::assign_process(job, process) {
            win_ffi::close_handle(job).ok();
            return Err(error);
        }
        Ok(win_ffi::own_handle(job))
    }

    fn resume_threads(child_process: HANDLE) -> Result<()> {
        let pid = win_ffi::process_id(child_process);
        let snapshot = win_ffi::thread_snapshot()?;
        let resumed = win_ffi::resume_suspended(pid, snapshot);
        win_ffi::close_handle(snapshot)?;
        resumed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    fn root_dir() -> (tempfile::TempDir, String) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().canonicalize().unwrap();
        (dir, root.to_string_lossy().into_owned())
    }

    fn run_command(
        command: &str,
        vault: Option<&str>,
        call_id: &str,
        stamp: Option<&str>,
        cancel: &dyn Fn() -> bool,
        timeout: Option<Duration>,
    ) -> Result<String, String> {
        let args = serde_json::json!({ "command": command }).to_string();
        run(&ShellInput {
            args: &args,
            vault_path: vault,
            vault_paths: &[],
            call_id,
            stamp,
            is_cancelled: cancel,
            timeout,
        })
    }

    fn run_approved(
        command: &str,
        vault: &str,
        timeout: Option<Duration>,
    ) -> Result<String, String> {
        let stamp = approval_stamp("call-1", command);
        run_command(
            command,
            Some(vault),
            "call-1",
            Some(&stamp),
            &|| false,
            timeout,
        )
    }

    #[test]
    fn timeout_defaults_to_60_and_caps_at_300() {
        assert_eq!(timeout_from_args("{}"), Duration::from_secs(60));
        assert_eq!(
            timeout_from_args(r#"{"timeout_secs":301}"#),
            Duration::from_secs(300)
        );
        assert_eq!(
            timeout_from_args(r#"{"timeout_secs":12}"#),
            Duration::from_secs(12)
        );
        for raw in [
            r#"{"timeout_secs":0}"#,
            r#"{"timeout_secs":-3}"#,
            r#"{"timeout_secs":"7"}"#,
            r#"{"timeout_secs":"abc"}"#,
            r#"{"timeout_secs":"1.5"}"#,
            r#"{"timeout_secs":1.5}"#,
            r#"{"timeout_secs":true}"#,
        ] {
            assert_eq!(timeout_from_args(raw), Duration::from_secs(60), "{raw}");
        }
    }

    #[test]
    fn unset_vault_is_refused_without_spawning() {
        let (_dir, root) = root_dir();
        let marker = std::path::Path::new(&root).join("spawned");
        let command = format!("echo no > {}", marker.display());
        let stamp = approval_stamp("call-1", &command);
        let error = run_command(
            &command,
            None,
            "call-1",
            Some(&stamp),
            &|| false,
            Some(Duration::from_secs(2)),
        )
        .unwrap_err();
        assert!(error.contains("vault"), "{error}");
        assert!(!marker.exists());
    }

    #[test]
    fn missing_approval_never_spawns() {
        let (_dir, root) = root_dir();
        let marker = std::path::Path::new(&root).join("spawned");
        let command = format!("echo no > {}", marker.display());
        let error = run_command(
            &command,
            Some(&root),
            "call-1",
            None,
            &|| false,
            Some(Duration::from_secs(2)),
        )
        .unwrap_err();
        assert!(error.contains("not approved"), "{error}");
        assert!(!marker.exists());
    }

    #[test]
    fn a_different_command_hash_or_call_id_is_rejected() {
        let (_dir, root) = root_dir();
        let marker = std::path::Path::new(&root).join("spawned");
        let command = format!("echo no > {}", marker.display());
        let other = approval_stamp("call-1", "echo something-else");
        let wrong_command = run_command(
            &command,
            Some(&root),
            "call-1",
            Some(&other),
            &|| false,
            Some(Duration::from_secs(2)),
        )
        .unwrap_err();
        assert!(wrong_command.contains("not approved"), "{wrong_command}");
        let wrong_call = approval_stamp("call-other", &command);
        let wrong_id = run_command(
            &command,
            Some(&root),
            "call-1",
            Some(&wrong_call),
            &|| false,
            Some(Duration::from_secs(2)),
        )
        .unwrap_err();
        assert!(wrong_id.contains("not approved"), "{wrong_id}");
        assert!(!marker.exists());
    }

    #[test]
    fn cancel_before_spawn_never_spawns() {
        let (_dir, root) = root_dir();
        let marker = std::path::Path::new(&root).join("spawned");
        let command = format!("echo no > {}", marker.display());
        let stamp = approval_stamp("call-1", &command);
        let output = run_command(
            &command,
            Some(&root),
            "call-1",
            Some(&stamp),
            &|| true,
            Some(Duration::from_secs(2)),
        )
        .unwrap();
        let value = bash_json(&output);
        assert_eq!(value["stopped"], true);
        assert_eq!(value["timed_out"], false);
        assert!(value["exit_code"].is_null());
        assert_eq!(value["stdout"], "");
        assert!(!marker.exists());
    }

    #[test]
    fn command_keeps_escapes_for_the_approval_stamp() {
        let command = "printf '%s' \"a\\b\\\"c\"";
        let raw = serde_json::json!({ "command": command }).to_string();
        assert_eq!(command_from_args(&raw).unwrap(), command);
        let stamp = approval_stamp("call-9", command);
        assert_ne!(stamp, approval_stamp("call-9", "printf"));
        assert_eq!(
            stamp,
            approval_stamp("call-9", &command_from_args(&raw).unwrap())
        );
    }

    #[cfg(unix)]
    #[test]
    fn echo_hi_returns_hi_and_exit_code_0() {
        let (_dir, root) = root_dir();
        let output = run_approved("echo hi", &root, Some(Duration::from_secs(5))).unwrap();
        let value = bash_json(&output);
        assert_eq!(value["kind"], "bash_result");
        assert_eq!(value["stdout"], "hi\n");
        assert_eq!(value["exit_code"], 0);
        assert_eq!(value["timed_out"], false);
        assert_eq!(value["stopped"], false);
        assert_eq!(value["stdout_truncated"], false);
        assert!(value.get("stdout_lines_hidden").is_none());
    }

    #[cfg(unix)]
    #[test]
    fn a_failing_command_returns_its_exit_code() {
        let (_dir, root) = root_dir();
        let output = run_approved("exit 4", &root, Some(Duration::from_secs(5))).unwrap();
        let value = bash_json(&output);
        assert_eq!(value["exit_code"], 4);
        assert_eq!(value["timed_out"], false);
        assert_eq!(value["stopped"], false);
    }

    #[cfg(unix)]
    #[test]
    fn pwd_is_the_vault_root() {
        let (_dir, root) = root_dir();
        let output = run_approved("pwd -P", &root, Some(Duration::from_secs(5))).unwrap();
        let value = bash_json(&output);
        assert_eq!(value["stdout"].as_str().unwrap().trim(), root);
        assert_eq!(value["exit_code"], 0);
    }

    #[cfg(unix)]
    #[test]
    fn env_has_no_api_key() {
        let (_dir, root) = root_dir();
        std::env::set_var("RHIZOME_SHELL_TEST_API_KEY", "super-secret-value");
        std::env::set_var("GITHUB_TOKEN", "ghp-test-token-value");
        std::env::set_var("AWS_SECRET_ACCESS_KEY", "aws-test-secret-value");
        let output = run_approved("env", &root, Some(Duration::from_secs(5))).unwrap();
        let value = bash_json(&output);
        let stdout = value["stdout"].as_str().unwrap();
        assert!(!stdout.contains("RHIZOME_SHELL_TEST_API_KEY"), "{stdout}");
        assert!(!stdout.contains("super-secret-value"), "{stdout}");
        assert!(!stdout.contains("GITHUB_TOKEN"), "{stdout}");
        assert!(!stdout.contains("ghp-test-token-value"), "{stdout}");
        assert!(!stdout.contains("AWS_SECRET_ACCESS_KEY"), "{stdout}");
        assert!(!stdout.contains("aws-test-secret-value"), "{stdout}");
        assert!(stdout.contains("PATH="), "{stdout}");
        assert_eq!(value["exit_code"], 0);
    }

    #[cfg(unix)]
    #[test]
    fn cat_with_stdin_closed_exits_immediately() {
        let (_dir, root) = root_dir();
        let started = Instant::now();
        let output = run_approved("cat", &root, Some(Duration::from_secs(3))).unwrap();
        assert!(started.elapsed() < Duration::from_secs(2), "{output}");
        let value = bash_json(&output);
        assert_eq!(value["exit_code"], 0);
        assert_eq!(value["timed_out"], false);
    }

    #[cfg(unix)]
    #[test]
    fn flooded_output_is_capped() {
        let (_dir, root) = root_dir();
        let output = run_approved(
            "awk 'BEGIN { for (i = 0; i < 100000; i++) printf \"abcdefghij\" }'",
            &root,
            Some(Duration::from_secs(5)),
        )
        .unwrap();
        let value = bash_json(&output);
        let stdout = value["stdout"].as_str().unwrap();
        assert!(stdout.contains("\n… [0 lines hidden] …\n"), "{stdout}");
        assert!(stdout.starts_with("abcdefghij"), "{stdout}");
        assert!(stdout.ends_with("abcdefghij"), "{stdout}");
        assert_eq!(value["stdout_truncated"], true);
        assert_eq!(value["stdout_lines_hidden"], 0);
        assert_eq!(value["exit_code"], 0);
        assert!(stdout.len() < 40_000, "stdout len {}", stdout.len());
    }

    #[cfg(unix)]
    #[test]
    fn sleep_600_stops_at_the_timeout_and_the_group_is_gone() {
        let (_dir, root) = root_dir();
        let child_path = std::path::Path::new(&root).join("child.pid");
        let grand_path = std::path::Path::new(&root).join("grand.pid");
        let command = format!(
            "echo $$ > '{}'; sleep 600 & echo $! > '{}'; wait",
            child_path.display(),
            grand_path.display()
        );
        let started = Instant::now();
        let output = run_approved(&command, &root, Some(Duration::from_millis(700))).unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "{output}");
        let value = bash_json(&output);
        assert_eq!(value["timed_out"], true);
        assert_eq!(value["stopped"], false);
        assert!(value["exit_code"].is_null());
        assert_dead(read_pid(&child_path));
        assert_dead(read_pid(&grand_path));
    }

    #[cfg(unix)]
    #[test]
    fn background_sleep_does_not_hold_the_pipe() {
        let (_dir, root) = root_dir();
        let bg_path = std::path::Path::new(&root).join("bg.pid");
        let command = format!("sleep 600 & echo $! > '{}'; echo done", bg_path.display());
        let started = Instant::now();
        let output = run_approved(&command, &root, Some(Duration::from_secs(5))).unwrap();
        assert!(started.elapsed() < Duration::from_secs(2), "{output}");
        let value = bash_json(&output);
        assert!(
            value["stdout"].as_str().unwrap().contains("done"),
            "{output}"
        );
        assert_eq!(value["exit_code"], 0);
        assert_eq!(value["timed_out"], false);
        assert_dead(read_pid(&bg_path));
    }

    #[cfg(unix)]
    #[test]
    fn cancel_mid_run_kills_the_group_and_records_cancelled() {
        let (_dir, root) = root_dir();
        let started_path = std::path::Path::new(&root).join("started");
        let child_path = std::path::Path::new(&root).join("child.pid");
        let grand_path = std::path::Path::new(&root).join("grand.pid");
        let command = format!(
            "echo $$ > '{}'; sleep 600 & echo $! > '{}'; echo go > '{}'; wait",
            child_path.display(),
            grand_path.display(),
            started_path.display()
        );
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&cancel);
        let watch = started_path.to_path_buf();
        thread::spawn(move || {
            for _ in 0..200 {
                if watch.exists() {
                    flag.store(true, Ordering::SeqCst);
                    return;
                }
                thread::sleep(Duration::from_millis(10));
            }
        });
        let stamp = approval_stamp("call-1", &command);
        let started = Instant::now();
        let output = run_command(
            &command,
            Some(&root),
            "call-1",
            Some(&stamp),
            &|| cancel.load(Ordering::SeqCst),
            Some(Duration::from_secs(5)),
        )
        .unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "{output}");
        let value = bash_json(&output);
        assert_eq!(value["stopped"], true);
        assert_eq!(value["timed_out"], false);
        assert!(value["exit_code"].is_null());
        assert_dead(read_pid(&child_path));
        assert_dead(read_pid(&grand_path));
    }

    #[cfg(unix)]
    fn read_pid(path: &std::path::Path) -> i32 {
        let text = std::fs::read_to_string(path)
            .unwrap_or_else(|error| panic!("missing pid file {}: {error}", path.display()));
        text.trim().parse().expect("pid")
    }

    /// `setsid` is not on the macOS CI image. `python3` `os.setsid` starts
    /// the same new session and keeps the shell's stdout open.
    #[cfg(unix)]
    fn hold_stdout_in_new_session(pid_path: &std::path::Path, sleep_for: &str) -> String {
        let pid = pid_path.display();
        format!(
            "if command -v setsid >/dev/null 2>&1; then setsid sh -c 'echo $$ > {pid}; exec sleep {sleep_for}' & else python3 -c 'import os,sys; os.setsid(); open(sys.argv[1],\"w\").write(str(os.getpid())); os.execvp(\"sleep\",[\"sleep\",sys.argv[2]])' '{pid}' '{sleep_for}' & fi; while ! test -s '{pid}'; do :; done"
        )
    }

    #[cfg(unix)]
    #[test]
    fn setsid_background_returns_without_waiting_for_the_child() {
        let (_dir, root) = root_dir();
        let pid_path = std::path::Path::new(&root).join("sleep.pid");
        let command = format!("{}; echo done", hold_stdout_in_new_session(&pid_path, "20"));
        let started = Instant::now();
        let output = run_approved(&command, &root, Some(Duration::from_secs(3))).unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "{output}");
        let value = bash_json(&output);
        assert!(
            value["stdout"].as_str().unwrap().contains("done"),
            "{output}"
        );
        assert_eq!(value["exit_code"], 0);
        assert_eq!(value["timed_out"], false);
        assert_eq!(value["stopped"], false);
        assert!(
            value["stderr"].as_str().unwrap().contains(DETACHED_NOTE),
            "{output}"
        );
        kill_written_pid(&pid_path);
    }

    #[cfg(unix)]
    #[test]
    fn setsid_sleep_infinity_does_not_hang() {
        let (_dir, root) = root_dir();
        let pid_path = std::path::Path::new(&root).join("sleep.pid");
        // GNU `sleep infinity` is Linux. A long sleep is the same hold on macOS.
        let sleep_for = if cfg!(target_os = "linux") {
            "infinity"
        } else {
            "600"
        };
        let command = hold_stdout_in_new_session(&pid_path, sleep_for);
        let started = Instant::now();
        let output = run_approved(&command, &root, Some(Duration::from_secs(3))).unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "{output}");
        let value = bash_json(&output);
        assert_eq!(value["timed_out"], false);
        assert!(
            value["stderr"].as_str().unwrap().contains(DETACHED_NOTE),
            "{output}"
        );
        kill_written_pid(&pid_path);
    }

    #[cfg(unix)]
    #[test]
    fn cancel_during_reader_grace_keeps_the_exit_code() {
        let (_dir, root) = root_dir();
        let pid_path = std::path::Path::new(&root).join("sleep.pid");
        let command = format!("{}; echo done", hold_stdout_in_new_session(&pid_path, "30"));
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&cancel);
        let watch = pid_path.to_path_buf();
        thread::spawn(move || {
            for _ in 0..200 {
                if watch.is_file() {
                    if let Ok(text) = std::fs::read_to_string(&watch) {
                        if !text.trim().is_empty() {
                            thread::sleep(Duration::from_millis(200));
                            flag.store(true, Ordering::SeqCst);
                            return;
                        }
                    }
                }
                thread::sleep(Duration::from_millis(10));
            }
        });
        let stamp = approval_stamp("call-1", &command);
        let output = run_command(
            &command,
            Some(&root),
            "call-1",
            Some(&stamp),
            &|| cancel.load(Ordering::SeqCst),
            Some(Duration::from_secs(3)),
        )
        .unwrap();
        let value = bash_json(&output);
        assert_eq!(value["exit_code"], 0, "{output}");
        assert_eq!(value["stopped"], false, "{output}");
        assert_eq!(value["timed_out"], false, "{output}");
        assert!(
            value["stderr"].as_str().unwrap().contains(DETACHED_NOTE),
            "{output}"
        );
        kill_written_pid(&pid_path);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn detached_calls_do_not_leak_reader_threads() {
        let before = linux_thread_count();
        let (_dir, root) = root_dir();
        let mut pids = Vec::new();
        for index in 0..20 {
            let pid_path = std::path::Path::new(&root).join(format!("sleep-{index}.pid"));
            let command = format!("{}; echo done", hold_stdout_in_new_session(&pid_path, "60"));
            let output = run_approved(&command, &root, Some(Duration::from_secs(3))).unwrap();
            assert!(
                bash_json(&output)["stderr"]
                    .as_str()
                    .unwrap()
                    .contains(DETACHED_NOTE),
                "{output}"
            );
            pids.push(read_pid(&pid_path));
        }
        let after = linux_thread_count();
        for pid in pids {
            let _ = nix::sys::signal::kill(
                nix::unistd::Pid::from_raw(pid),
                nix::sys::signal::Signal::SIGKILL,
            );
        }
        assert!(
            after <= before.saturating_add(4),
            "reader threads leaked: {before} -> {after}"
        );
    }

    #[cfg(target_os = "linux")]
    fn linux_thread_count() -> usize {
        let text = std::fs::read_to_string("/proc/self/status").expect("status");
        text.lines()
            .find_map(|line| line.strip_prefix("Threads:"))
            .and_then(|count| count.trim().parse().ok())
            .expect("Threads")
    }

    #[cfg(unix)]
    #[test]
    fn sigterm_reaches_a_trap_before_sigkill() {
        let (_dir, root) = root_dir();
        let started = Instant::now();
        let output = run_approved(
            "trap 'echo got-term; exit 0' TERM; sleep 30",
            &root,
            Some(Duration::from_millis(400)),
        )
        .unwrap();
        assert!(started.elapsed() < Duration::from_secs(5), "{output}");
        let value = bash_json(&output);
        assert!(
            value["stdout"].as_str().unwrap().contains("got-term"),
            "{output}"
        );
        assert_eq!(value["timed_out"], true);
        assert_eq!(value["stopped"], false);
        assert!(value["exit_code"].is_null());
    }

    #[test]
    fn invalid_utf8_becomes_replacement_and_pending_is_flushed() {
        let mut capture = StreamCapture::default();
        capture.push_bytes(b"a\xff b");
        let text = capture.finish();
        assert_eq!(text.text, "a\u{FFFD} b");

        let mut split = StreamCapture::default();
        split.push_bytes(&[b'a', 0xC3]);
        let text = split.finish();
        assert_eq!(text.text, "a\u{FFFD}");
        assert!(!text.text.contains('\u{0000}'));
    }

    fn bash_json(output: &str) -> serde_json::Value {
        serde_json::from_str(output).unwrap_or_else(|error| panic!("bash json {error}: {output}"))
    }

    #[test]
    fn under_cap_keeps_the_whole_stream_without_a_marker() {
        let mut capture = StreamCapture::default();
        let body = "ab".repeat(10 * 1024);
        capture.push_bytes(body.as_bytes());
        let text = capture.finish();
        assert!(!text.truncated);
        assert!(text.lines_hidden.is_none());
        assert_eq!(text.text, body);
        assert!(!text.text.contains('…'));
    }

    #[test]
    fn between_head_and_total_keeps_both_parts_without_dropping() {
        let mut capture = StreamCapture::default();
        let body = "c".repeat(HEAD_BYTES + 100);
        capture.push_bytes(body.as_bytes());
        let text = capture.finish();
        assert!(!text.truncated);
        assert!(text.lines_hidden.is_none());
        assert_eq!(text.text, body);
        assert!(!text.text.contains("lines hidden"));
    }

    #[test]
    fn over_cap_keeps_head_and_tail_and_counts_hidden_lines() {
        let mut capture = StreamCapture::default();
        let line = b"hello\n";
        let copies = 8_000;
        let mut body = Vec::with_capacity(line.len() * copies);
        for _ in 0..copies {
            body.extend_from_slice(line);
        }
        capture.push_bytes(&body);
        let text = capture.finish();
        let kept = HEAD_BYTES + TAIL_BYTES;
        let dropped = body.len() - kept;
        let hidden = (dropped / line.len()) as u64;
        let marker = format!("\n… [{hidden} lines hidden] …\n");
        assert!(text.truncated);
        assert_eq!(text.lines_hidden, Some(hidden));
        assert!(hidden > 0);
        assert!(text.text.starts_with("hello\n"));
        assert!(text.text.ends_with("hello\n"));
        assert_eq!(text.text.matches(&marker).count(), 1, "{}", text.text);
        let marker_at = text.text.find(&marker).unwrap();
        assert_eq!(text.text[..marker_at].len(), HEAD_BYTES);
        assert_eq!(text.text[marker_at + marker.len()..].len(), TAIL_BYTES);
    }

    #[test]
    fn multibyte_that_overflows_the_head_stays_whole() {
        let mut capture = StreamCapture::default();
        let mut body = vec![b'a'; HEAD_BYTES - 1];
        let e_acute = "é".as_bytes();
        assert_eq!(e_acute.len(), 2);
        body.extend_from_slice(e_acute);
        body.extend(std::iter::repeat(b'b').take(TAIL_BYTES));
        body.extend("你".as_bytes());
        // The two-byte character arrives split across reads.
        capture.push_bytes(&body[..HEAD_BYTES]);
        capture.push_bytes(&body[HEAD_BYTES..]);
        let text = capture.finish();
        assert!(text.truncated);
        assert!(text.text.is_char_boundary(text.text.len()));
        assert!(!text.text.contains('\u{FFFD}'));
        assert!(text.text.starts_with(&"a".repeat(HEAD_BYTES - 1)));
        assert!(text.text.ends_with('你'));
        assert!(!text.text.contains('é'));
        let marker = format!("\n… [{} lines hidden] …\n", text.lines_hidden.unwrap());
        assert_eq!(text.text.matches(marker.as_str()).count(), 1);
    }

    #[test]
    fn multibyte_that_fills_the_head_stays_before_the_marker() {
        let mut capture = StreamCapture::default();
        let mut body = vec![b'a'; HEAD_BYTES - 2];
        body.extend_from_slice("é".as_bytes());
        body.extend(std::iter::repeat(b'b').take(TAIL_BYTES + 8));
        body.extend("你".as_bytes());
        capture.push_bytes(&body);
        let text = capture.finish();
        assert!(text.truncated);
        assert!(!text.text.contains('\u{FFFD}'));
        let marker = format!("\n… [{} lines hidden] …\n", text.lines_hidden.unwrap());
        let marker_at = text.text.find(&marker).expect("marker");
        let head = &text.text[..marker_at];
        assert_eq!(head.len(), HEAD_BYTES);
        assert!(head.ends_with('é'), "{head}");
        assert!(text.text.ends_with('你'));
        assert_eq!(text.text.matches(marker.as_str()).count(), 1);
    }

    #[test]
    fn bash_result_round_trips_and_omits_line_counts_until_trimmed() {
        let full = BashResult {
            kind: "bash_result".into(),
            exit_code: Some(0),
            timed_out: false,
            stopped: false,
            stdout: "hi\n".into(),
            stderr: String::new(),
            stdout_truncated: false,
            stderr_truncated: false,
            stdout_lines_hidden: None,
            stderr_lines_hidden: None,
        };
        let text = serde_json::to_string(&full).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&text).unwrap();
        let keys: Vec<&str> = parsed
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect();
        let mut keys = keys;
        keys.sort_unstable();
        assert_eq!(
            keys,
            [
                "exit_code",
                "kind",
                "stderr",
                "stderr_truncated",
                "stdout",
                "stdout_truncated",
                "stopped",
                "timed_out",
            ]
        );
        let back: BashResult = serde_json::from_str(&text).unwrap();
        assert_eq!(back, full);

        let trimmed = BashResult {
            kind: "bash_result".into(),
            exit_code: None,
            timed_out: true,
            stopped: false,
            stdout: "head".into(),
            stderr: "err".into(),
            stdout_truncated: true,
            stderr_truncated: true,
            stdout_lines_hidden: Some(0),
            stderr_lines_hidden: Some(4),
        };
        let text = serde_json::to_string(&trimmed).unwrap();
        assert!(text.contains("\"stdout_lines_hidden\":0"), "{text}");
        assert!(text.contains("\"stderr_lines_hidden\":4"), "{text}");
        assert!(!text.contains("\"extra\""));
        let back: BashResult = serde_json::from_str(&text).unwrap();
        assert_eq!(back, trimmed);
        let with_extra = text.replacen('}', ",\"nope\":1}", 1);
        assert!(serde_json::from_str::<BashResult>(&with_extra).is_err());
    }

    #[cfg(unix)]
    fn assert_dead(pid: i32) {
        let alive = nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid), None).is_ok();
        assert!(!alive, "pid {pid} is still alive");
    }

    #[cfg(unix)]
    fn kill_written_pid(path: &std::path::Path) {
        let deadline = Instant::now() + Duration::from_secs(2);
        let text = loop {
            if let Ok(text) = std::fs::read_to_string(path) {
                if !text.trim().is_empty() {
                    break text;
                }
            }
            if Instant::now() >= deadline {
                return;
            }
            thread::sleep(Duration::from_millis(20));
        };
        if let Ok(pid) = text.trim().parse::<i32>() {
            let _ = nix::sys::signal::kill(
                nix::unistd::Pid::from_raw(pid),
                nix::sys::signal::Signal::SIGKILL,
            );
        }
    }
}
