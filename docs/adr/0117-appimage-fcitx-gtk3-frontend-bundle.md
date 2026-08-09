# ADR-0117: Bundle the fcitx GTK3 frontend in Linux AppImages

## Status

Accepted

## Context

Linux AppImages run WebKitGTK through the GTK3 input-method stack. Users with fcitx5 can export `GTK_IM_MODULE=fcitx`, `QT_IM_MODULE=fcitx`, and `XMODIFIERS=@im=fcitx`, but the AppImage still cannot load the host GTK immodule reliably because the GTK module cache and library paths are isolated from the mounted AppDir.

The previous AppImage startup fallback set `GTK_IM_MODULE=fcitx` when fcitx was detected, but it did not make the `im-fcitx5.so` module available inside the AppImage. That left Chinese/Japanese/Korean input dependent on host paths that GTK may not search from a sealed AppImage.

## Decision

Linux release jobs install `fcitx5-frontend-gtk3` and the AppImage output-plugin shim copies the GTK3 fcitx immodule plus its client library into the AppDir before the AppImage is sealed. At runtime, AppImage startup writes a mount-path-specific `GTK_IM_MODULE_FILE` cache that points GTK at the bundled module whenever fcitx is configured explicitly or through common fcitx environment hints.

The sealed AppImage validation step extracts every produced AppImage and fails the release if the symlink-safe AppRun resolver, the bundled fcitx immodule, or the fcitx client library is missing.

## Consequences

- fcitx5 input works in AppImage launches without relying on the host GTK immodule cache path.
- X11 fallback launches with explicit `GTK_IM_MODULE=fcitx` use the same bundled module path as Wayland launches.
- Linux AppImage builds now depend on the distro package that provides the GTK3 fcitx frontend.
- If the Ubuntu package path changes, the AppImage validation step fails before publishing a broken bundle.
