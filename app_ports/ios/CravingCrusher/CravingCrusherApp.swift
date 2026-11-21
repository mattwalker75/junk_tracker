// Craving Crusher for iPhone: the web app's page (built into the app's `web` folder by BUILD_APP.sh),
// shown full screen, with its log kept on the phone. The page does all the work (app_ports/shared/);
// this app only shows it, hands it its files and keeps the log file (PhoneWebView.swift).
import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: nil, sessionRole: session.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = PageViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}
