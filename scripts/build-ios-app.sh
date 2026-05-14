#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/Apps/ControlPlaneMobile/ControlPlaneMobile.xcodeproj"
SCHEME="ControlPlaneMobile"
CONFIGURATION="${CONFIGURATION:-Debug}"
DESTINATION="${DESTINATION:-generic/platform=iOS}"
DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-/tmp/ControlPlaneMobileDeviceDerived}"

echo "Building $SCHEME"
echo "Project: $PROJECT_PATH"
echo "Configuration: $CONFIGURATION"
echo "Destination: $DESTINATION"
echo "DerivedData: $DERIVED_DATA_PATH"

xcodebuild \
  -project "$PROJECT_PATH" \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -destination "$DESTINATION" \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  build

APP_PATH="$DERIVED_DATA_PATH/Build/Products/${CONFIGURATION}-iphoneos/$SCHEME.app"

if [[ "$DESTINATION" == *"iOS Simulator"* ]]; then
  APP_PATH="$DERIVED_DATA_PATH/Build/Products/${CONFIGURATION}-iphonesimulator/$SCHEME.app"
fi

echo
echo "Build complete"
echo "App path: $APP_PATH"
