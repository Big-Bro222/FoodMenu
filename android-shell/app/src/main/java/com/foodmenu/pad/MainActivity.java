package com.foodmenu.pad;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String PREFS = "food_menu_pad";
    private static final String PREF_DISPLAY_URL = "display_url";

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout statusPanel;
    private TextView statusView;
    private SharedPreferences prefs;
    private Handler handler;
    private int loadToken = 0;
    private boolean pageLoadFailed = false;
    private final BroadcastReceiver deviceStatusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            emitDeviceStatus();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        handler = new Handler(Looper.getMainLooper());
        configureKioskWindow();
        buildView();
        configureWebView();
        registerDeviceStatusReceiver();
        loadDisplayPage();
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUi();
        emitDeviceStatus();
    }

    @Override
    protected void onDestroy() {
        unregisterReceiver(deviceStatusReceiver);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        }
    }

    private void configureKioskWindow() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.setNavigationBarColor(Color.BLACK);
        window.setStatusBarColor(Color.BLACK);

        WindowManager.LayoutParams attributes = window.getAttributes();
        attributes.screenBrightness = 0.55f;
        window.setAttributes(attributes);
    }

    private void buildView() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        root.addView(progressBar, progressParams);

        statusPanel = new LinearLayout(this);
        statusPanel.setOrientation(LinearLayout.VERTICAL);
        statusPanel.setGravity(Gravity.CENTER);
        statusPanel.setPadding(48, 48, 48, 48);
        statusPanel.setBackgroundColor(Color.rgb(12, 18, 24));

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(18);
        statusView.setGravity(Gravity.CENTER);
        statusView.setLineSpacing(4, 1.05f);
        statusPanel.addView(statusView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        LinearLayout actions = new LinearLayout(this);
        actions.setGravity(Gravity.CENTER);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, 28, 0, 0);

        Button editUrlButton = new Button(this);
        editUrlButton.setText(R.string.edit_url);
        editUrlButton.setOnClickListener(view -> showUrlDialog());
        actions.addView(editUrlButton);

        Button reloadButton = new Button(this);
        reloadButton.setText(R.string.reload_page);
        reloadButton.setOnClickListener(view -> loadDisplayPage());
        actions.addView(reloadButton);

        statusPanel.addView(actions);
        root.addView(statusPanel, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        root.setOnLongClickListener(view -> {
            showUrlDialog();
            return true;
        });
        webView.setOnLongClickListener(view -> {
            showUrlDialog();
            return true;
        });

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        if (Build.VERSION.SDK_INT >= 21) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }
        webView.addJavascriptInterface(new DeviceBridge(), "FoodMenuPad");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                showStatus(getString(R.string.loading_display, url), true);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                if (!pageLoadFailed) {
                    statusPanel.setVisibility(View.GONE);
                }
                emitDeviceStatus();
                hideSystemUi();
            }

            @Override
            public void onReceivedHttpError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceResponse errorResponse
            ) {
                if (Build.VERSION.SDK_INT >= 21 && request.isForMainFrame()) {
                    showLoadError(getString(
                            R.string.http_error,
                            errorResponse.getStatusCode(),
                            request.getUrl().toString()
                    ));
                }
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    WebResourceRequest request,
                    WebResourceError error
            ) {
                if (Build.VERSION.SDK_INT >= 23 && request.isForMainFrame()) {
                    showLoadError(getString(
                            R.string.webview_error,
                            error.getErrorCode(),
                            error.getDescription(),
                            request.getUrl().toString()
                    ));
                }
            }

            @SuppressWarnings("deprecation")
            @Override
            public void onReceivedError(
                    WebView view,
                    int errorCode,
                    String description,
                    String failingUrl
            ) {
                showLoadError(getString(
                        R.string.webview_error,
                        errorCode,
                        description,
                        failingUrl
                ));
            }
        });
    }

    private void registerDeviceStatusReceiver() {
        IntentFilter filter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(deviceStatusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(deviceStatusReceiver, filter);
        }
    }

    private String getDeviceStatusJson() {
        Intent batteryStatus = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
        int level = batteryStatus == null
                ? -1
                : batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = batteryStatus == null
                ? -1
                : batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int status = batteryStatus == null
                ? -1
                : batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL;
        String batteryLevel = level >= 0 && scale > 0
                ? String.valueOf(Math.min(1.0f, Math.max(0.0f, level / (float) scale)))
                : "null";

        return "{"
                + "\"batteryLevel\":" + batteryLevel + ","
                + "\"isCharging\":" + isCharging + ","
                + "\"source\":\"android-shell\""
                + "}";
    }

    private void emitDeviceStatus() {
        if (webView == null) return;

        String payload = JSONObject.quote(getDeviceStatusJson());
        webView.post(() -> webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('foodmenu-pad-device-status', { detail: "
                        + payload
                        + " }));",
                null
        ));
    }

    private final class DeviceBridge {
        @JavascriptInterface
        public String getDeviceStatus() {
            return getDeviceStatusJson();
        }
    }

    private void loadDisplayPage() {
        int currentLoadToken = ++loadToken;
        progressBar.setVisibility(View.VISIBLE);
        String displayUrl = getDisplayUrl();
        pageLoadFailed = false;
        showStatus(getString(R.string.loading_display, displayUrl), true);
        webView.loadUrl(displayUrl);

        handler.postDelayed(() -> {
            if (currentLoadToken == loadToken && progressBar.getVisibility() == View.VISIBLE) {
                showLoadError(getString(R.string.load_timeout, getDisplayUrl()));
            }
        }, 10000L);
    }

    private String getDisplayUrl() {
        return prefs.getString(
                PREF_DISPLAY_URL,
                getString(R.string.default_display_url)
        );
    }

    private void saveDisplayUrl(String nextUrl) {
        boolean saved = prefs.edit().putString(PREF_DISPLAY_URL, nextUrl).commit();
        if (!saved) {
            Toast.makeText(this, R.string.url_save_failed, Toast.LENGTH_LONG).show();
            return;
        }

        Toast.makeText(this, getString(R.string.url_saved, nextUrl), Toast.LENGTH_LONG).show();
        loadDisplayPage();
    }

    private void showLoadError(String detail) {
        loadToken += 1;
        pageLoadFailed = true;
        progressBar.setVisibility(View.GONE);
        showStatus(getString(R.string.load_error, getDisplayUrl(), detail), false);
    }

    private void showStatus(String message, boolean loading) {
        statusView.setText(message);
        statusPanel.setVisibility(View.VISIBLE);
        progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
    }

    private void showUrlDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(getDisplayUrl());
        input.setSelectAllOnFocus(true);

        new AlertDialog.Builder(this)
                .setTitle(R.string.url_dialog_title)
                .setMessage(R.string.url_dialog_message)
                .setView(input)
                .setPositiveButton(R.string.save_and_reload, (dialog, which) -> {
                    String nextUrl = input.getText().toString().trim();
                    if (!nextUrl.startsWith("http://") && !nextUrl.startsWith("https://")) {
                        Toast.makeText(this, R.string.url_invalid, Toast.LENGTH_LONG).show();
                        return;
                    }
                    saveDisplayUrl(nextUrl);
                })
                .setNeutralButton(R.string.use_default_url, (dialog, which) ->
                        saveDisplayUrl(getString(R.string.default_display_url)))
                .setNegativeButton(android.R.string.cancel, null)
                .show();
    }

    private void hideSystemUi() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }
}
