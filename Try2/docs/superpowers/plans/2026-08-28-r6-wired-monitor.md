# R6 Wired Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a source-distributed iOS app that monitors an original Canon EOS R6 over one USB-C data cable using ImageCaptureCore and a minimal Canon PTP implementation.

**Architecture:** A SwiftUI shell owns discovery and presentation, while protocol-independent transport, Canon session state, EVF parsing, and diagnostics remain focused units. ImageCaptureCore is isolated behind an async `PTPTransport`, allowing every protocol behavior except physical USB discovery to be tested with scripted responses.

**Tech Stack:** Swift 5, SwiftUI, Observation/Combine, ImageCaptureCore, UIKit image decoding, XCTest, Xcode 26; iOS 17 minimum; no third-party packages.

---

## File Map

- `R6Monitor.xcodeproj/project.pbxproj`: application and test targets with generated Info.plists.
- `R6Monitor/App/R6MonitorApp.swift`: application entry point and scene lifecycle forwarding.
- `R6Monitor/App/MonitorView.swift`: connection, preview, retry, and diagnostic-sharing UI.
- `R6Monitor/App/MonitorViewModel.swift`: discovery/session orchestration and newest-frame publication.
- `R6Monitor/Camera/CameraDiscovery.swift`: ImageCaptureCore authorization, USB camera discovery, and device removal callbacks.
- `R6Monitor/PTP/PTPContainer.swift`: bounded PTP command/response binary encoding.
- `R6Monitor/PTP/PTPTransport.swift`: async command abstraction and response value.
- `R6Monitor/PTP/ImageCapturePTPTransport.swift`: ImageCaptureCore session and raw-command adapter.
- `R6Monitor/Canon/CanonEOSProtocol.swift`: centralized Canon operation/property identifiers and payload builders.
- `R6Monitor/Canon/CanonEVFParser.swift`: pure Canon block/JPEG extraction.
- `R6Monitor/Canon/CanonEOSSession.swift`: startup, frame polling, cancellation, and cleanup state machine.
- `R6Monitor/Diagnostics/DiagnosticLog.swift`: bounded, shareable text diagnostics.
- `R6MonitorTests/*.swift`: encoder, parser, state-machine, and diagnostics tests.
- `README.md`, `LICENSE`, `NOTICE.md`: build, Personal Team install, hardware test, licensing, and protocol attribution.

### Task 1: Create the buildable project shell

**Files:**
- Create: `R6Monitor.xcodeproj/project.pbxproj`
- Create: `R6Monitor/App/R6MonitorApp.swift`
- Create: `R6Monitor/App/MonitorView.swift`
- Create: `R6Monitor/App/MonitorViewModel.swift`
- Create: `R6MonitorTests/ProjectSmokeTests.swift`

- [ ] **Step 1: Add a failing smoke test**

```swift
import XCTest
@testable import R6Monitor

final class ProjectSmokeTests: XCTestCase {
    func testInitialStatusExplainsHowToConnect() {
        XCTAssertEqual(MonitorStatus.disconnected.message,
                       "打开佳能 R6，并用 USB-C 数据线连接")
    }
}
```

- [ ] **Step 2: Create the Xcode project and minimal status model**

Configure `R6Monitor` and `R6MonitorTests`, iOS 17.0, Swift 5, automatic signing, generated Info.plists, portrait/landscape support, and linked `ImageCaptureCore.framework`. Implement the exact `MonitorStatus.disconnected` string asserted above.

- [ ] **Step 3: Verify the project**

Run:

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

Expected: one passing test and both builds exit 0.

- [ ] **Step 4: Commit**

```bash
git add Try2/R6Monitor.xcodeproj Try2/R6Monitor Try2/R6MonitorTests
git commit -m "build: scaffold R6 monitor iOS app"
```

### Task 2: Implement safe PTP binary containers

**Files:**
- Create: `R6Monitor/PTP/PTPContainer.swift`
- Create: `R6Monitor/PTP/PTPTransport.swift`
- Create: `R6MonitorTests/PTPContainerTests.swift`

- [ ] **Step 1: Add failing byte-exact tests**

Test that operation `0x9153`, transaction `7`, and no parameters encodes as the 12 bytes `0C 00 00 00 01 00 53 91 07 00 00 00`; test a parameterized command, a 12-byte success response (`0x2001`), and rejection of short or self-inconsistent containers.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:R6MonitorTests/PTPContainerTests test
```

Expected: compile failure because `PTPCommand` is missing.

- [ ] **Step 3: Implement the minimal types**

```swift
struct PTPCommand: Equatable {
    let operationCode: UInt16
    let transactionID: UInt32
    var parameters: [UInt32] = []
    func encoded() -> Data
}

struct PTPResponse: Equatable {
    let responseCode: UInt16
    let transactionID: UInt32
    init(data: Data) throws
}

@MainActor
protocol PTPTransport: AnyObject {
    func open() async throws
    func send(_ command: PTPCommand, outData: Data?) async throws -> PTPExchange
    func close() async
}

struct PTPExchange: Equatable {
    let response: PTPResponse
    let data: Data
}
```

All integer reads must be bounds-checked and explicitly little-endian.

- [ ] **Step 4: Run all tests and commit**

Expected: byte-exact and malformed-input tests pass.

```bash
git add Try2/R6Monitor/PTP Try2/R6MonitorTests/PTPContainerTests.swift
git commit -m "feat: add bounded PTP container codec"
```

### Task 3: Implement Canon payloads and EVF parsing

**Files:**
- Create: `R6Monitor/Canon/CanonEOSProtocol.swift`
- Create: `R6Monitor/Canon/CanonEVFParser.swift`
- Create: `R6MonitorTests/CanonEOSProtocolTests.swift`
- Create: `R6MonitorTests/CanonEVFParserTests.swift`

- [ ] **Step 1: Add failing Canon payload tests**

Assert that `setDeviceProperty(.evfMode, value: 1)` creates a 12-byte little-endian body containing length `12`, property `0xD1B1`, and value `1`. Assert operation identifiers `0x9110`, `0x9114`, `0x9115`, and `0x9153` in one centralized namespace.

- [ ] **Step 2: Add failing parser fixtures**

Construct synthetic blocks as `[u32 blockLength][u32 blockType][payload]`. Verify JPEG extraction for types `1`, `9`, and `11`; multiple-block traversal; marker fallback; and rejection of zero length, length below 8, length beyond input, missing EOI, and input above the parser limit.

- [ ] **Step 3: Implement the payload builder and pure parser**

```swift
enum CanonEVFParser {
    static let maximumPayloadBytes = 32 * 1024 * 1024
    static func extractJPEG(from data: Data) throws -> Data
}
```

The parser returns one complete `FFD8...FFD9` image, never exposes an unchecked slice, and scans no more than `maximumPayloadBytes`.

- [ ] **Step 4: Run focused tests and commit**

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:R6MonitorTests/CanonEOSProtocolTests \
  -only-testing:R6MonitorTests/CanonEVFParserTests test
git add Try2/R6Monitor/Canon Try2/R6MonitorTests/Canon*.swift
git commit -m "feat: parse Canon EVF JPEG frames"
```

### Task 4: Build the tested Canon session state machine

**Files:**
- Create: `R6Monitor/Canon/CanonEOSSession.swift`
- Create: `R6MonitorTests/CanonEOSSessionTests.swift`

- [ ] **Step 1: Add a scripted transport and startup-order test**

Queue success responses and assert `open`, `0x9114`, `0x9115`, two `0x9110` writes, then `0x9153`. Assert monotonically increasing transaction identifiers.

- [ ] **Step 2: Add failure and cleanup tests**

For failure at each startup command, assert no later startup command is sent. For stop, assert polling ends before EVF output `0`, EVF mode `0`, and `close`. Verify disconnect makes cleanup best-effort and repeated start/stop is idempotent.

- [ ] **Step 3: Implement the state machine**

```swift
@MainActor
final class CanonEOSSession {
    enum State: Equatable { case idle, opening, preparing(String), streaming, stopping, failed(String) }
    func start() async throws
    func nextFrame() async throws -> Data
    func stop() async
}
```

Accept only PTP success `0x2001`, cap consecutive malformed frames at five, and keep only one request in flight.

- [ ] **Step 4: Run tests and commit**

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -only-testing:R6MonitorTests/CanonEOSSessionTests test
git add Try2/R6Monitor/Canon/CanonEOSSession.swift Try2/R6MonitorTests/CanonEOSSessionTests.swift
git commit -m "feat: add Canon live-view session state machine"
```

### Task 5: Add diagnostics and ImageCaptureCore transport

**Files:**
- Create: `R6Monitor/Diagnostics/DiagnosticLog.swift`
- Create: `R6Monitor/PTP/ImageCapturePTPTransport.swift`
- Create: `R6Monitor/Camera/CameraDiscovery.swift`
- Create: `R6MonitorTests/DiagnosticLogTests.swift`

- [ ] **Step 1: Add failing diagnostics tests**

Verify bounded retention, deterministic ISO-8601 formatting, hexadecimal operation/response codes, and removal of line breaks from external device names. Verify entries contain payload byte counts but never payload bytes.

- [ ] **Step 2: Implement diagnostics**

Use an in-memory ring limited to 1,000 entries and expose a `textReport` snapshot. Prefix the report with app version, iOS version, and an explicit experimental-protocol warning.

- [ ] **Step 3: Implement the production adapter**

`CameraDiscovery` requests control authorization, browses `.camera | .local`, accepts USB vendor `0x04A9` with a case-insensitive name containing `EOS R6`, and reports all other devices as unverified. `ImageCapturePTPTransport` wraps block-based session APIs and `requestSendPTPCommand`, translating callback errors and parsing the returned PTP response.

- [ ] **Step 4: Compile, run tests, and commit**

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
git add Try2/R6Monitor/Camera Try2/R6Monitor/Diagnostics Try2/R6Monitor/PTP/ImageCapturePTPTransport.swift Try2/R6MonitorTests/DiagnosticLogTests.swift
git commit -m "feat: connect ImageCaptureCore PTP transport"
```

### Task 6: Complete the monitor UI and lifecycle

**Files:**
- Modify: `R6Monitor/App/R6MonitorApp.swift`
- Modify: `R6Monitor/App/MonitorView.swift`
- Modify: `R6Monitor/App/MonitorViewModel.swift`
- Create: `R6MonitorTests/MonitorViewModelTests.swift`

- [ ] **Step 1: Add view-model lifecycle tests**

Inject fake discovery/session factories. Assert attach starts once, each parsed frame replaces the previous frame, detach stops, background stops, retry creates a new session, and streaming is the only state that disables the idle timer.

- [ ] **Step 2: Implement orchestration and UI**

Render `UIImage(data:)` only after parser validation, publish at most the newest image, display an aspect-fit image on black, support both orientations, and expose Retry, Stop, and Share Diagnostics. Forward `scenePhase` changes to the view model.

- [ ] **Step 3: Run all tests and both builds**

```bash
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
```

Expected: all tests pass; both commands exit 0; application-owned sources produce no warnings.

- [ ] **Step 4: Commit**

```bash
git add Try2/R6Monitor/App Try2/R6MonitorTests/MonitorViewModelTests.swift Try2/R6Monitor.xcodeproj
git commit -m "feat: add wired live-view monitor interface"
```

### Task 7: Prepare the open-source hardware-test handoff

**Files:**
- Modify: `README.md`
- Create: `LICENSE`
- Create: `NOTICE.md`
- Create: `docs/hardware-test-checklist.md`

- [ ] **Step 1: Document reproducible installation**

Include clone/open/select device/select Personal Team/change bundle identifier/build steps; state that free provisioning is temporary. List original EOS R6, USB-C iPhone, data-capable C-to-C cable, still-photo mode, and firmware/log fields to report.

- [ ] **Step 2: Document safe gated validation**

The checklist separates discovery, session open, remote/event setup, EVF enablement, first JPEG, ten-minute run, background, and unplug/replug. Each gate instructs the tester to stop and export diagnostics on failure.

- [ ] **Step 3: Add licensing and acknowledgements**

Use the MIT text for this repository. Acknowledge behavioral/protocol research from PTPPT, libgphoto2, ZENCHE, and open-eos-control with links and their licenses; clarify that no Canon SDK or copied GPL implementation is distributed.

- [ ] **Step 4: Final verification and commit**

```bash
rg -n "T[B]D|T[O]DO|FIX[M]E" README.md NOTICE.md docs R6Monitor R6MonitorTests
git diff --check
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' test
xcodebuild -project R6Monitor.xcodeproj -scheme R6Monitor \
  -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
git add Try2/README.md Try2/LICENSE Try2/NOTICE.md Try2/docs
git commit -m "docs: add R6 hardware test and install guide"
```

Expected: no placeholders, whitespace errors, test failures, or unsigned device-build errors.

## Execution Decision

The user requested uninterrupted progress and no further choice prompts. Execute this plan inline in the current task, preserving all unrelated parent-repository changes and staging only files under `Try2`.
