import Flutter
import UIKit
import FBSDKCoreKit

class SceneDelegate: FlutterSceneDelegate {
  override func sceneDidBecomeActive(_ scene: UIScene) {
    super.sceneDidBecomeActive(scene)
    AppEvents.shared.activateApp()
  }
}
