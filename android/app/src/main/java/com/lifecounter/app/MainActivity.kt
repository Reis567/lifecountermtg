package com.lifecounter.app

import android.annotation.SuppressLint
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val TAG = "LifeCounter"

    // Callback do <input type="file"> da web (fallback "Galeria" do scanner).
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    // Pedido de permissão de câmera vindo do getUserMedia, aguardando resposta do usuário.
    private var pendingPermissionRequest: PermissionRequest? = null

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        filePathCallback?.onReceiveValue(uris)
        filePathCallback = null
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        val req = pendingPermissionRequest
        pendingPermissionRequest = null
        req?.let {
            if (granted) it.grant(it.resources) else it.deny()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            // Keep screen on during gameplay + hardware acceleration
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            window.addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED)

            // Enable immersive fullscreen mode
            enableFullscreen()

            // Create WebView programmatically
            webView = WebView(this).apply {
                layoutParams = android.view.ViewGroup.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT
                )
            }
            setContentView(webView)

            // Configure WebView settings
            webView.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                @Suppress("DEPRECATION")
                allowFileAccessFromFileURLs = true
                @Suppress("DEPRECATION")
                allowUniversalAccessFromFileURLs = true
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
                useWideViewPort = true
                loadWithOverviewMode = true
                mediaPlaybackRequiresUserGesture = false
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                cacheMode = WebSettings.LOAD_DEFAULT
            }

            // WebViewClient with error handling
            webView.webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    Log.e(TAG, "WebView error: ${error?.description}")
                    super.onReceivedError(view, request, error)
                }
            }

            // WebChromeClient (only log errors for performance)
            webView.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    if (consoleMessage?.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                        Log.e(TAG, "JS Error: ${consoleMessage.message()}")
                    }
                    return true
                }

                // Concede o acesso à câmera para o getUserMedia (scanner de cartas).
                override fun onPermissionRequest(request: PermissionRequest) {
                    runOnUiThread {
                        val wantsCamera = request.resources.any {
                            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        }
                        if (!wantsCamera) {
                            request.deny()
                            return@runOnUiThread
                        }
                        if (ContextCompat.checkSelfPermission(
                                this@MainActivity, Manifest.permission.CAMERA
                            ) == PackageManager.PERMISSION_GRANTED
                        ) {
                            request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
                        } else {
                            pendingPermissionRequest = request
                            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
                        }
                    }
                }

                // Suporte ao <input type="file"> (fallback "Galeria" do scanner).
                override fun onShowFileChooser(
                    view: WebView?,
                    callback: ValueCallback<Array<Uri>>?,
                    params: FileChooserParams?
                ): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = callback
                    return try {
                        val intent = params?.createIntent()
                        if (intent != null) {
                            fileChooserLauncher.launch(intent)
                            true
                        } else {
                            this@MainActivity.filePathCallback = null
                            false
                        }
                    } catch (e: Exception) {
                        this@MainActivity.filePathCallback = null
                        Log.e(TAG, "File chooser error: ${e.message}")
                        false
                    }
                }
            }

            // Use hardware acceleration for better performance
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

            Log.d(TAG, "Loading index.html...")
            // Load the app from assets
            webView.loadUrl("file:///android_asset/index.html")

        } catch (e: Exception) {
            Log.e(TAG, "Error in onCreate: ${e.message}", e)
        }
    }

    private fun enableFullscreen() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
                window.insetsController?.let {
                    it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                    it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error in enableFullscreen: ${e.message}")
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableFullscreen()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) {
            webView.onResume()
        }
    }

    override fun onPause() {
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
