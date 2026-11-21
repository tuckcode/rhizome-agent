#!/bin/sh
set -eu

# The CLI may inherit the standalone Command Line Tools or an older Xcode.
if ! xcodebuild -version 2>/dev/null | awk 'NR == 1 && $1 == "Xcode" && $2 + 0 >= 26 { found = 1 } END { exit !found }'; then
  for xcode in /Applications/Xcode.app /Applications/Xcode_*.app; do
    [ -x "$xcode/Contents/Developer/usr/bin/actool" ] || continue
    if DEVELOPER_DIR="$xcode/Contents/Developer" xcodebuild -version 2>/dev/null |
      awk 'NR == 1 && $1 == "Xcode" && $2 + 0 >= 26 { found = 1 } END { exit !found }'; then
      export DEVELOPER_DIR="$xcode/Contents/Developer"
      break
    fi
  done
fi

output=src-tauri/target/macos-icon
mkdir -p "$output"
xcrun actool --compile "$output" \
  --platform macosx --target-device mac --minimum-deployment-target 10.13 \
  --app-icon RhizomeIcon --output-partial-info-plist "$output/Info.plist" \
  src-tauri/icons/RhizomeIcon.icon
test -s "$output/Assets.car"
