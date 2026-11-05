package expo.modules.wattlytorch

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Flashlight for reading meters in the dark. CameraManager.setTorchMode (Android 6+) switches the LED without
 * opening the camera, so – unlike a camera preview – it needs no CAMERA permission.
 */
class WattlyTorchModule : Module() {
  /** Camera id whose LED is lit, remembered so it can be switched off when the app goes away. */
  private var litCameraId: String? = null

  private val cameraManager: CameraManager?
    get() = appContext.reactContext?.getSystemService(Context.CAMERA_SERVICE) as? CameraManager

  override fun definition() = ModuleDefinition {
    Name("WattlyTorch")

    Function("isAvailable") {
      return@Function torchCameraId() != null
    }

    AsyncFunction("setEnabled") { enabled: Boolean ->
      val manager = cameraManager ?: throw CodedException("ERR_TORCH_UNAVAILABLE", "Camera service is not available", null)
      val id = torchCameraId() ?: throw CodedException("ERR_TORCH_UNAVAILABLE", "This device has no flashlight", null)
      try {
        manager.setTorchMode(id, enabled)
      } catch (e: Exception) {
        // E.g. CameraAccessException when another app is using the camera.
        throw CodedException("ERR_TORCH_BUSY", e.message ?: "The flashlight is in use", e)
      }
      litCameraId = if (enabled) id else null
      return@AsyncFunction enabled
    }

    // Never leave the light on when the user leaves the app or the app is closed.
    OnActivityEntersBackground { turnOff() }
    OnDestroy { turnOff() }
  }

  /** Back camera with a flash unit, or any camera with one. */
  private fun torchCameraId(): String? {
    val manager = cameraManager ?: return null
    return try {
      val withFlash = manager.cameraIdList.filter {
        manager.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
      }
      withFlash.firstOrNull {
        manager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
      } ?: withFlash.firstOrNull()
    } catch (e: Exception) {
      null
    }
  }

  /** Switches the LED off if this module turned it on; errors are ignored (nothing more can be done). */
  private fun turnOff() {
    val id = litCameraId ?: return
    try {
      cameraManager?.setTorchMode(id, false)
    } catch (e: Exception) {
      // Ignored on purpose.
    }
    litCameraId = null
  }
}
