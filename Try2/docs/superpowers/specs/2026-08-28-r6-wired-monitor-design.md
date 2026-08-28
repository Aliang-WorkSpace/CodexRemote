# R6 Wired Monitor Design

## Summary

R6 Wired Monitor is a small, open-source iPhone application that displays the live-view feed from an original Canon EOS R6 over one USB-C data cable. Version 1 is a monitor only: it does not release the shutter, change camera settings, record video, transmit audio, or use Wi-Fi.

The first release is deliberately limited to the original EOS R6 and a USB-C iPhone. Other Canon bodies may happen to respond to the same protocol, but the application must describe them as unverified rather than supported.

## Goals

- Discover an attached EOS R6 through Apple's public ImageCaptureCore API.
- Start and stop the Canon EOS live-view session using the smallest necessary set of PTP vendor operations.
- Repeatedly request Canon EVF data, extract the embedded JPEG frame, and display the newest complete frame full-screen.
- Recover cleanly from cable removal, camera shutdown, application backgrounding, and malformed or unsupported camera responses.
- Produce a diagnostic text log that a remote tester can share without a debugger or access to the developer's computer.
- Build with Xcode without commercial dependencies, Canon SDK binaries, or a paid Apple Developer membership.
- Publish the source under the MIT license with reproducible build and device-install instructions.

## Non-goals

- Camera controls, autofocus, shutter release, media browsing, transfer, recording, audio, scopes, LUTs, overlays, or remote networking.
- App Store, TestFlight, or permanent free-device provisioning in version 1. A Personal Team build is expected to expire and require rebuilding according to Apple's current provisioning rules.
- General Canon compatibility or support for Android, Lightning iPhones, macOS, or iPadOS.
- Firmware modification or undocumented writes unrelated to entering and leaving live view.

## Approaches Considered

### Focused native implementation — selected

Use ImageCaptureCore for device discovery and raw PTP transport, then implement only the Canon EOS operations and EVF parsing needed by this application. This keeps the application small, makes the proprietary boundary visible, and permits an MIT-licensed clean implementation.

### Port libgphoto2

libgphoto2 has the strongest existing Canon protocol knowledge, but bringing its C stack and transitive assumptions to iOS would add substantial build, integration, and LGPL-distribution work. Most of its camera-control surface is outside this application's scope.

### Fork an existing monitor project

Projects such as ZENCHE already contain useful protocol research, but their iOS paths use PTP/IP or a Mac bridge rather than native USB. Forking them would retain unrelated UI, networking, and device support while leaving the core USB task unfinished.

## Architecture

The application is split into small units with explicit boundaries:

1. `CameraDiscovery` owns ImageCaptureCore browser and device lifecycle callbacks. It exposes supported-camera connection events without interpreting Canon data.
2. `PTPTransport` is an asynchronous request/response interface. The production implementation wraps `ICCameraDevice.requestSendPTPCommand`; a scripted implementation supports deterministic tests.
3. `CanonEOSSession` is a state machine that validates the camera identity, opens the device session, enables remote/event modes, enables EVF output, fetches frames, and unwinds those steps in reverse order.
4. `CanonEVFParser` validates Canon data-block lengths and extracts a complete JPEG from known EVF block types. A bounded marker-scan fallback is allowed for diagnostic compatibility.
5. `LiveViewController` coordinates connection state and a single-frame-at-a-time polling loop. It discards stale display work rather than queueing frames.
6. SwiftUI views display the image and concise connection state. A diagnostics sheet allows copying or sharing sanitized logs.

The PTP transport and Canon protocol layers must not import SwiftUI. The parser must be a pure function over `Data` so it can be tested without a camera or iOS device.

## Data Flow

1. ImageCaptureCore reports an attached camera.
2. Discovery checks the USB vendor/product identity and the camera name. An unverified device is shown but is not sent Canon vendor commands automatically.
3. The session opens the ImageCaptureCore device session and obtains the supported-operation list when available.
4. The session sends Canon remote-mode and event-mode initialization, then writes the EVF mode and output-device properties required for phone display.
5. The controller requests one `GetViewFinderData` response at a time.
6. The parser walks bounded Canon blocks, extracts the first valid JPEG, and returns it to the display layer.
7. The next request begins only after the current response has been parsed. UI image replacement occurs on the main actor.
8. On stop or disconnect, polling is cancelled first. The session attempts to disable EVF output and EVF mode when the device remains reachable, then closes the device session.

No captured frame is written to Photos or persistent storage.

## Canon Protocol Boundary

The implementation uses public ImageCaptureCore transport with Canon vendor-specific PTP operation/property identifiers observed in independent open-source implementations. The initial candidate sequence is:

- `SetRemoteMode` (`0x9114`)
- `SetEventMode` (`0x9115`)
- `SetDevicePropValueEx` (`0x9110`)
- `GetViewFinderData` (`0x9153`)
- EVF output device (`0xD1B0`)
- EVF mode (`0xD1B1`)

These values are hypotheses until verified against the target R6 firmware. They live in one namespace and are never scattered through UI code. Every response code and payload length is logged before interpretation. A failure during initialization stops later writes and starts cleanup.

The repository must not contain Canon SDK headers, binaries, confidential documentation, copied GPL implementation code, or claims of Canon endorsement.

## Session States

The observable state is one of:

- `disconnected`
- `unsupportedDevice(name)`
- `connecting`
- `preparingLiveView(step)`
- `streaming(metrics)`
- `stopping`
- `failed(userMessage, diagnosticCode)`

Only the session state machine mutates protocol state. Duplicate starts, late callbacks from a previous connection, and commands after disconnection are ignored through a monotonically increasing session identifier and cancellation checks.

## Error Handling and Safety

- PTP commands have bounded timeouts at the controller layer. A timeout stops polling and produces a diagnostic code; it does not immediately retry state-changing commands.
- Invalid block sizes, oversized payloads, missing JPEG terminators, and non-success PTP response codes are rejected without indexing outside the received data.
- A short run of malformed frame responses may be skipped and logged. Repeated failures stop streaming to prevent an unbounded busy loop.
- Disconnect and background transitions cancel the frame loop. Cleanup commands are best-effort only when the same camera session is still reachable.
- The log records timestamps, state changes, operation codes, response codes, byte counts, firmware/name strings exposed by the API, and parser outcomes. It does not include JPEG payloads, Apple IDs, file paths, or unrelated device data.
- The UI explains that the camera should be in still-photo mode with USB communication available and that charge-only cables will not work.

## User Experience

The disconnected screen contains a dark preview area and one instruction: turn on the R6 and connect it with a USB-C data cable. Connection begins automatically. During setup, the current phase is displayed without exposing raw protocol terminology.

Once a valid frame arrives, the image is aspect-fit on a black background and the status chrome fades to a minimal overlay. The interface remains usable in either orientation and prevents the display from sleeping only while streaming. A stop/retry control and a diagnostics control remain accessible. The monitor does not promise color accuracy.

## Testing Strategy

### Automated tests

- PTP command container encoding, little-endian payload encoding, transaction identifiers, and response parsing.
- Canon `SetDevicePropValueEx` payload construction.
- EVF block parsing for known JPEG block types, multiple blocks, truncated headers, invalid lengths, missing markers, and bounded fallback scanning.
- Session-state transitions for successful startup, failure at every initialization step, cancellation, disconnect, timeout, and cleanup ordering using a scripted transport.
- Diagnostic redaction and bounded in-memory log retention.

### Local build verification

- Run unit tests in an available iOS Simulator.
- Build the application for the simulator and for generic iOS device without code signing.
- Treat compiler warnings in application-owned Swift code as defects.

### Hardware validation

A remote tester installs the project using Xcode and a free Personal Team, connects the original EOS R6 and iPhone with a known data-capable cable, and performs a short protocol probe before live-view polling is enabled. The tester returns the exported diagnostic log after each attempt.

Hardware validation proceeds in gates:

1. Device discovery and session open.
2. Supported-operation and identity capture.
3. Remote/event initialization.
4. EVF property enablement.
5. One valid JPEG frame.
6. Continuous ten-minute monitoring and cable-removal recovery.

This order prevents repeated blind command sequences and gives each failure a narrow diagnostic boundary.

## Acceptance Criteria

- The repository builds and its automated tests pass without third-party packages.
- On supported hardware, the application discovers the original EOS R6 over a single USB-C data cable without Wi-Fi or a computer remaining attached.
- The application displays successive live-view frames for ten minutes without accumulating an unbounded queue or persisting images.
- Cable removal, camera power-off, and application backgrounding do not crash the application; reconnection can start a new session.
- A tester can export a small, human-readable diagnostic log from the application.
- The README documents Xcode installation with a Personal Team, the temporary nature of free provisioning, supported hardware, camera setup, troubleshooting, license, and protocol-source acknowledgements.

## Delivery and Licensing

The repository contains an Xcode project, application source, unit tests, README, MIT license, and protocol acknowledgements. It has no paid runtime service and no account requirement. A friend with a Mac, Xcode, an Apple ID, and a local coding assistant can clone the repository, choose their Personal Team and unique bundle identifier, then build directly to their own iPhone.

The project will distinguish between "implemented" and "hardware verified." Until logs from an original R6 confirm the complete sequence, releases must label wired live view experimental.
