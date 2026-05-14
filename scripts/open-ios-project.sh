#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_PATH="$ROOT_DIR/Apps/ControlPlaneMobile/ControlPlaneMobile.xcodeproj"

open "$PROJECT_PATH"
