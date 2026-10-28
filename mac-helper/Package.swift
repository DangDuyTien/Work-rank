// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "WorkRankPrivateMediaHelper",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "WorkRankPrivateMediaHelper", targets: ["WorkRankPrivateMediaHelper"])
    ],
    targets: [
        .executableTarget(
            name: "WorkRankPrivateMediaHelper",
            path: "Sources/WorkRankPrivateMediaHelper",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("Carbon")
            ]
        )
    ]
)
