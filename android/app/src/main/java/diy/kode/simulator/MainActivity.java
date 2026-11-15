package diy.kode.simulator;

import android.app.Activity;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.setStatusBarColor(Color.rgb(16, 17, 21));
        window.setNavigationBarColor(Color.rgb(16, 17, 21));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(16, 17, 21));
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        AssetManager assets = getAssets();
        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", path -> {
                    if (path.contains("..") || path.startsWith("/")) return null;
                    try {
                        String assetPath = "site/" + path;
                        String lower = path.toLowerCase();
                        String mime = lower.endsWith(".wasm") ? "application/wasm"
                                : lower.endsWith(".js") ? "text/javascript"
                                : lower.endsWith(".json") ? "application/json"
                                : lower.endsWith(".html") ? "text/html"
                                : lower.endsWith(".css") ? "text/css"
                                : lower.endsWith(".bin") ? "application/octet-stream"
                                : "application/octet-stream";
                        return new WebResourceResponse(mime, null, 200, "OK",
                                Collections.singletonMap("Cache-Control", "no-store"),
                                assets.open(assetPath));
                    } catch (IOException error) {
                        return null;
                    }
                })
                .build();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
