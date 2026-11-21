package app.cravingcrusher.phone;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;

/**
 * Craving Crusher for Android: the web app's page (built into assets/web by BUILD_APP.sh), shown full screen,
 * with its log kept on the phone. The page does all the work (app_ports/shared/); this screen only shows it,
 * hands it its files and keeps the log file:
 *
 *  - the files are served at https://appassets.androidplatform.net/… from assets/web (Android's own address for
 *    an app's files, so the page gets a normal web origin);
 *  - the log is one SQLite file, files/junk.db (in the phone's backup), read and written through the
 *    window.CCAndroid bridge (app_ports/shared/src/store.ts). The copy before the last change is junk.db.prev.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";

    private WebView web;
    private FrameLayout root;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true); // chrome://inspect on the Mac, while testing
        }

        root = new FrameLayout(this);
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);
        keepClearOfTheBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);   // the page remembers its theme in localStorage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.addJavascriptInterface(new Bridge(), "CCAndroid");
        web.setWebViewClient(new Client());

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(START);

        // Back: the page's previous screen first, then leave the app
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::back);
        }
    }

    private void back() {
        if (web.canGoBack()) web.goBack();
        else finish();
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() { back(); }   // Android 12 and older

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);   // dark mode on/off restarts the screen: come back where we were
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Android draws the app under the clock and the navigation bar: keep the page clear of them (and of the keyboard). */
    private void keepClearOfTheBars() {
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            int top, bottom, left, right;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
                top = bars.top; left = bars.left; right = bars.right; bottom = Math.max(bars.bottom, ime.bottom);
            } else {
                top = insets.getSystemWindowInsetTop(); bottom = insets.getSystemWindowInsetBottom();
                left = insets.getSystemWindowInsetLeft(); right = insets.getSystemWindowInsetRight();
            }
            v.setPadding(left, top, right, bottom);
            return insets;
        });
    }

    /** The page's colour (its theme-color, sent by the page): the bars wear it, with icons that show on it. */
    private void barColor(int color) {
        root.setBackgroundColor(color);
        getWindow().getDecorView().setBackgroundColor(color);
        double lum = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255.0;
        boolean lightPage = lum >= 0.5;
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                int both = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                c.setSystemBarsAppearance(lightPage ? both : 0, both);
            }
        } else {
            @SuppressWarnings("deprecation") int flags = getWindow().getDecorView().getSystemUiVisibility();
            if (lightPage) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            else flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    /** What the page asks of the app (app_ports/shared/src/store.ts and boot.ts). */
    final class Bridge {
        private final File file = new File(getFilesDir(), "junk.db");

        /** the log file as base64, or "" when there is none yet */
        @JavascriptInterface
        public synchronized String load() {
            if (!file.exists()) return "";
            try {
                return Base64.encodeToString(Files.readAllBytes(file.toPath()), Base64.NO_WRAP);
            } catch (IOException e) {
                return "";
            }
        }

        /** keep the whole log file: "ok", or a sentence saying why not */
        @JavascriptInterface
        public synchronized String save(String b64) {
            byte[] data;
            try { data = Base64.decode(b64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return "The app was sent something it could not read"; }
            if (data.length == 0) return "There was nothing to save";
            File tmp = new File(getFilesDir(), "junk.db.tmp");
            try {
                try (FileOutputStream out = new FileOutputStream(tmp)) {
                    out.write(data);
                    out.getFD().sync();
                }
                if (file.exists()) Files.copy(file.toPath(), new File(getFilesDir(), "junk.db.prev").toPath(), StandardCopyOption.REPLACE_EXISTING);
                Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
                return "ok";
            } catch (IOException e) {
                return "The phone would not save the file (" + e.getMessage() + ")";
            }
        }

        /** the page's background colour, "#rrggbb" */
        @JavascriptInterface
        public void barColor(String hex) {
            try {
                int color = Color.parseColor(hex.trim());
                runOnUiThread(() -> MainActivity.this.barColor(color));
            } catch (IllegalArgumentException ignored) { }
        }
    }

    /** Serves the page's files from assets/web; links to anywhere else open in the browser. */
    final class Client extends WebViewClient {
        private final Map<String, String> types = new HashMap<>();
        Client() {
            types.put("html", "text/html"); types.put("js", "text/javascript"); types.put("css", "text/css");
            types.put("wasm", "application/wasm"); types.put("svg", "image/svg+xml"); types.put("png", "image/png");
            types.put("woff2", "font/woff2"); types.put("json", "application/json"); types.put("webmanifest", "application/manifest+json");
            types.put("txt", "text/plain");
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return null;
            String path = u.getPath() == null || u.getPath().equals("/") ? "index.html" : u.getPath().substring(1);
            if (path.contains("..")) return notFound();
            String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1).toLowerCase() : "";
            String type = types.containsKey(ext) ? types.get(ext) : "application/octet-stream";
            try {
                InputStream in = getAssets().open("web/" + path);
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                boolean text = type.startsWith("text/") || type.equals("application/json") || type.equals("image/svg+xml");
                return new WebResourceResponse(type, text ? "utf-8" : null, 200, "OK", headers, in);
            } catch (IOException e) {
                return notFound();
            }
        }

        private WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), null);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if ("https".equals(u.getScheme()) && HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { }
            return true;
        }

        /** if Android ever ends the page's process (low memory), load it again rather than show a blank screen */
        @Override
        public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
            finish();
            startActivity(getIntent());
            return true;
        }
    }
}
