import { execFile } from "node:child_process";

const QR_SWIFT_SOURCE = String.raw`
import Foundation
import CoreImage
import CoreImage.CIFilterBuiltins
import AppKit

let input = CommandLine.arguments[1]
let filter = CIFilter.qrCodeGenerator()
filter.setValue(Data(input.utf8), forKey: "inputMessage")
filter.setValue("M", forKey: "inputCorrectionLevel")

guard let outputImage = filter.outputImage else {
  fatalError("Failed to create QR image")
}

let scaled = outputImage.transformed(by: CGAffineTransform(scaleX: 10, y: 10))
let representation = NSCIImageRep(ciImage: scaled)
let image = NSImage(size: representation.size)
image.addRepresentation(representation)

guard
  let tiff = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let png = bitmap.representation(using: .png, properties: [:])
else {
  fatalError("Failed to encode PNG")
}

FileHandle.standardOutput.write(png)
`;

const qrCache = new Map();

export async function renderPairingQrPng(value, {
  execFileImpl = execFile,
  swiftCommand = "swift"
} = {}) {
  if (qrCache.has(value)) {
    return qrCache.get(value);
  }

  const buffer = await new Promise((resolve, reject) => {
    execFileImpl(
      swiftCommand,
      ["-e", QR_SWIFT_SOURCE, value],
      {
        encoding: "buffer",
        maxBuffer: 2 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(stdout);
      }
    );
  });

  qrCache.set(value, buffer);
  return buffer;
}
