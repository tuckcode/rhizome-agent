//! Allowed tool bodies. A denied call never reaches this function.
//! `bash` is not a process. Limited tools never call it.

pub fn execute_allowed(args: &str) -> String {
    args.to_string()
}
