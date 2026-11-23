// The web view that shows Craving Crusher's page, and the two things the page asks of the app:
//  - its files, served from the app's `web` folder at cc-app://local/… (LocalFiles)
//  - keeping its log: one SQLite file in Application Support (LogStore), which iCloud backs up with the phone
//  - reading workouts from Apple Health, read only (HealthBridge, Health.swift)
import UIKit
import UniformTypeIdentifiers
import WebKit

/// The whole app's screen: the page, under the clock and battery and down to the bottom edge (the page keeps
/// clear of the home bar itself, viewport-fit=cover). The strip behind the clock wears the page's own
/// background (its theme-color), and the clock's colour is picked to show on it.
final class PageViewController: UIViewController, WKNavigationDelegate {
    private var web: WKWebView!
    private var themeWatch: NSKeyValueObservation?
    private var darkPage = false

    override var preferredStatusBarStyle: UIStatusBarStyle { darkPage ? .lightContent : .darkContent }

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(LocalFiles(), forURLScheme: LocalFiles.scheme)
        config.userContentController.addScriptMessageHandler(LogStore(), contentWorld: .page, name: "ccStore")
        config.userContentController.addScriptMessageHandler(HealthBridge(), contentWorld: .page, name: "ccHealth")
        web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsBackForwardNavigationGestures = true   // swipe from the edge = back, like the page's own back arrows
        web.allowsLinkPreview = false
        web.navigationDelegate = self
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }   // Safari → Develop menu, while testing
        #endif

        let root = UIView()
        root.backgroundColor = .systemBackground
        web.translatesAutoresizingMaskIntoConstraints = false
        root.addSubview(web)
        NSLayoutConstraint.activate([
            web.topAnchor.constraint(equalTo: root.safeAreaLayoutGuide.topAnchor),
            web.bottomAnchor.constraint(equalTo: root.bottomAnchor),
            web.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            web.trailingAnchor.constraint(equalTo: root.trailingAnchor),
        ])
        view = root

        themeWatch = web.observe(\.themeColor, options: [.initial, .new]) { [weak self] web, _ in
            DispatchQueue.main.async { self?.follow(web.themeColor) }
        }
        web.load(URLRequest(url: URL(string: "\(LocalFiles.scheme)://local/index.html")!))
    }

    private func follow(_ color: UIColor?) {
        guard let color else { return }
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        view.backgroundColor = color
        darkPage = (0.299 * r + 0.587 * g + 0.114 * b) < 0.5
        setNeedsStatusBarAppearanceUpdate()
    }

    /// the page stays inside the app; any other link opens in Safari
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == LocalFiles.scheme || url.scheme == "about" { decisionHandler(.allow); return }
        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }

    /// if iOS ever ends the page's process (low memory), load it again rather than show a blank screen
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

/// Serves the page's files from the app's own `web` folder at cc-app://local/…
final class LocalFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "cc-app"
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true).standardizedFileURL

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!)
            task.didReceive(Data("Not found".utf8))
            task.didFinish()
            return
        }
        let ext = file.pathExtension.lowercased()
        let mime = ext == "wasm" ? "application/wasm" : ext == "js" ? "text/javascript" : (UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream")
        let headers = ["Content-Type": mime, "Content-Length": String(data.count), "Cache-Control": "no-cache"]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

/// Keeps the log: the page sends the whole SQLite file after each change (APP_PORTS/shared/src/store.ts).
/// The copy before the last change is kept beside it as junk.db.prev.
final class LogStore: NSObject, WKScriptMessageHandlerWithReply {
    private let file: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("CravingCrusher", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("junk.db")
    }()

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        // only the app's own page may read or write the log
        guard message.frameInfo.securityOrigin.protocol == LocalFiles.scheme,
              let body = message.body as? [String: Any], let op = body["op"] as? String else {
            replyHandler(nil, "That request was not understood.")
            return
        }
        switch op {
        case "load", "loadPrev":
            // "" only when there is no file; one that is there but can't be read is an error, so the page never
            // starts a new log and saves it over this one
            let f = op == "load" ? file : file.appendingPathExtension("prev")
            guard FileManager.default.fileExists(atPath: f.path) else { replyHandler("", nil); return }
            do { replyHandler(try Data(contentsOf: f).base64EncodedString(), nil) }
            catch { replyHandler(nil, "The iPhone could not read \(f.lastPathComponent) (\(error.localizedDescription))") }
        case "setAside":
            // a damaged log moves to junk.db.damaged, so the next save doesn't turn it into junk.db.prev
            let fm = FileManager.default
            guard fm.fileExists(atPath: file.path) else { replyHandler("ok", nil); return }
            let damaged = file.appendingPathExtension("damaged")
            do {
                if fm.fileExists(atPath: damaged.path) { try fm.removeItem(at: damaged) }
                try fm.moveItem(at: file, to: damaged)
                replyHandler("ok", nil)
            } catch { replyHandler(nil, "The iPhone could not move the damaged log aside (\(error.localizedDescription))") }
        case "keepCopy":
            // a copy kept for good, only as junk.db.before-v<N> (the log from before an upgrade)
            guard let name = body["name"] as? String, name.range(of: #"^junk\.db\.before-v\d{1,3}$"#, options: .regularExpression) != nil,
                  let b64 = body["data"] as? String, let data = Data(base64Encoded: b64), !data.isEmpty else {
                replyHandler(nil, "That copy was not understood.")
                return
            }
            do {
                try data.write(to: file.deletingLastPathComponent().appendingPathComponent(name), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                replyHandler("ok", nil)
            } catch { replyHandler(nil, "The iPhone would not keep the copy (\(error.localizedDescription))") }
        case "save":
            guard let b64 = body["data"] as? String, let data = Data(base64Encoded: b64), !data.isEmpty else {
                replyHandler(nil, "There was nothing to save.")
                return
            }
            do {
                let fm = FileManager.default
                if fm.fileExists(atPath: file.path) {
                    let prev = file.appendingPathExtension("prev")
                    try? fm.removeItem(at: prev)
                    try? fm.copyItem(at: file, to: prev)
                }
                try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                replyHandler("ok", nil)
            } catch {
                replyHandler(nil, "The phone would not save the file (\(error.localizedDescription))")
            }
        default:
            replyHandler(nil, "That request was not understood.")
        }
    }
}
