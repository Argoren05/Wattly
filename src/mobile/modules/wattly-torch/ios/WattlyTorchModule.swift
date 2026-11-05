import AVFoundation
import ExpoModulesCore

/// Flashlight for reading meters in the dark. Switching the torch of AVCaptureDevice does not start a capture
/// session, so no camera permission prompt is needed.
public class WattlyTorchModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WattlyTorch")

    Function("isAvailable") { () -> Bool in
      return AVCaptureDevice.default(for: .video)?.hasTorch ?? false
    }

    AsyncFunction("setEnabled") { (enabled: Bool) -> Bool in
      try Self.setTorch(enabled)
      return enabled
    }.runOnQueue(.main)

    // Never leave the light on when the user leaves the app.
    OnAppEntersBackground {
      try? Self.setTorch(false)
    }
  }

  private static func setTorch(_ enabled: Bool) throws {
    guard let device = AVCaptureDevice.default(for: .video), device.hasTorch else {
      throw TorchUnavailableException()
    }
    try device.lockForConfiguration()
    defer { device.unlockForConfiguration() }
    if enabled {
      try device.setTorchModeOn(level: AVCaptureDevice.maxAvailableTorchLevel)
    } else {
      device.torchMode = .off
    }
  }
}

internal final class TorchUnavailableException: Exception {
  override var reason: String {
    "This device has no flashlight"
  }
}
