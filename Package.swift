// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "ControlPlaneDesktop",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    products: [
        .library(
            name: "ControlPlaneMobileCore",
            targets: ["ControlPlaneMobileCore"]
        ),
        .executable(
            name: "ControlPlaneDesktop",
            targets: ["ControlPlaneDesktop"]
        )
    ],
    targets: [
        .target(
            name: "ControlPlaneMobileCore"
        ),
        .executableTarget(
            name: "ControlPlaneDesktop",
            dependencies: ["ControlPlaneMobileCore"]
        ),
        .testTarget(
            name: "ControlPlaneDesktopTests",
            dependencies: ["ControlPlaneDesktop"]
        ),
        .testTarget(
            name: "ControlPlaneMobileCoreTests",
            dependencies: ["ControlPlaneMobileCore"]
        )
    ]
)
