//! Prime's daemon pipe on Windows, opened for overlapped I/O.
//!
//! Windows serializes every read and write on a pipe opened synchronously,
//! and `try_clone` shares that serialization. The daemon reader thread parks
//! in a read for the life of the connection, so a synchronous handle holds
//! each command write behind it:
//!
//! ```text
//! reader thread   ReadFile   waits for daemon output ──┐
//! command thread  WriteFile  queued behind the read  ──┴─ deadlock
//! ```
//!
//! That froze the window on first boot. Overlapped handles do not serialize,
//! so here each call starts an overlapped operation and then blocks only its
//! own thread until it finishes. Callers still see a plain `Read + Write`.

use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::AsRawHandle;
use std::path::Path;
use windows_sys::core::BOOL;
use windows_sys::Win32::Foundation::{CloseHandle, ERROR_BROKEN_PIPE, ERROR_IO_PENDING, HANDLE};
use windows_sys::Win32::Storage::FileSystem::{ReadFile, WriteFile, FILE_FLAG_OVERLAPPED};
use windows_sys::Win32::System::Threading::CreateEventW;
use windows_sys::Win32::System::IO::{GetOverlappedResult, OVERLAPPED};

pub(crate) struct PipeStream {
    file: File,
}

impl PipeStream {
    pub(crate) fn open(path: &Path) -> io::Result<Self> {
        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .custom_flags(FILE_FLAG_OVERLAPPED)
            .open(path)?;
        Ok(Self { file })
    }

    pub(crate) fn try_clone(&self) -> io::Result<Self> {
        let file = self.file.try_clone()?;
        Ok(Self { file })
    }

    fn handle(&self) -> HANDLE {
        self.file.as_raw_handle() as HANDLE
    }
}

impl Read for &PipeStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let handle = self.handle();
        let len = clamp_len(buf.len());
        let result = complete(handle, |overlapped| unsafe {
            ReadFile(
                handle,
                buf.as_mut_ptr(),
                len,
                std::ptr::null_mut(),
                overlapped,
            )
        });

        // The daemon closing its end is end-of-stream, as std reports it.
        match result {
            Err(error) if error.raw_os_error() == Some(ERROR_BROKEN_PIPE as i32) => Ok(0),
            other => other,
        }
    }
}

impl Write for &PipeStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let handle = self.handle();
        let len = clamp_len(buf.len());
        complete(handle, |overlapped| unsafe {
            WriteFile(handle, buf.as_ptr(), len, std::ptr::null_mut(), overlapped)
        })
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl Read for PipeStream {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        (&*self).read(buf)
    }
}

impl Write for PipeStream {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        (&*self).write(buf)
    }

    fn flush(&mut self) -> io::Result<()> {
        (&*self).flush()
    }
}

fn clamp_len(len: usize) -> u32 {
    u32::try_from(len).unwrap_or(u32::MAX)
}

/// Start one overlapped operation and wait for it on this thread.
///
/// Each operation gets its own event: a read and a write in flight on the
/// same handle would otherwise signal each other's waits.
fn complete(handle: HANDLE, start: impl FnOnce(*mut OVERLAPPED) -> BOOL) -> io::Result<usize> {
    let event = Event::new()?;
    let mut overlapped = OVERLAPPED {
        hEvent: event.0,
        ..Default::default()
    };

    if start(&mut overlapped) == 0 {
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(ERROR_IO_PENDING as i32) {
            return Err(error);
        }
    }

    let mut transferred = 0u32;
    let finished = unsafe { GetOverlappedResult(handle, &overlapped, &mut transferred, 1) };
    if finished == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(transferred as usize)
}

/// A manual-reset event, closed on drop.
struct Event(HANDLE);

impl Event {
    fn new() -> io::Result<Self> {
        let handle = unsafe { CreateEventW(std::ptr::null(), 1, 0, std::ptr::null()) };
        if handle.is_null() {
            return Err(io::Error::last_os_error());
        }
        Ok(Self(handle))
    }
}

impl Drop for Event {
    fn drop(&mut self) {
        unsafe { CloseHandle(self.0) };
    }
}

/// A one-instance pipe server for tests, standing in for the daemon.
#[cfg(test)]
pub(crate) fn test_server(name: &str) -> File {
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::FromRawHandle;
    use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
    use windows_sys::Win32::Storage::FileSystem::PIPE_ACCESS_DUPLEX;
    use windows_sys::Win32::System::Pipes::{CreateNamedPipeW, PIPE_TYPE_BYTE, PIPE_WAIT};

    const PIPE_BUFFER: u32 = 4096;

    let wide: Vec<u16> = std::ffi::OsStr::new(name)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let server = unsafe {
        CreateNamedPipeW(
            wide.as_ptr(),
            PIPE_ACCESS_DUPLEX,
            PIPE_TYPE_BYTE | PIPE_WAIT,
            1,
            PIPE_BUFFER,
            PIPE_BUFFER,
            0,
            std::ptr::null(),
        )
    };
    assert_ne!(server, INVALID_HANDLE_VALUE);
    unsafe { File::from_raw_handle(server as _) }
}

/// Finish the server side once a client has opened the pipe.
#[cfg(test)]
pub(crate) fn test_accept(server: &File) {
    use windows_sys::Win32::System::Pipes::ConnectNamedPipe;

    // The client is already connected; this only completes the handshake.
    unsafe { ConnectNamedPipe(server.as_raw_handle() as HANDLE, std::ptr::null_mut()) };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_daemon_output_then_end_of_stream_when_it_closes() {
        let name = format!(r"\\.\pipe\rhizome-pipe-eof-{}", std::process::id());
        let server = test_server(&name);
        let client = PipeStream::open(Path::new(&name)).expect("open test pipe");
        test_accept(&server);

        (&server).write_all(b"hello\n").expect("server write");
        drop(server);

        let mut received = String::new();
        (&client)
            .read_to_string(&mut received)
            .expect("read to end of stream");
        assert_eq!(received, "hello\n");
    }
}
