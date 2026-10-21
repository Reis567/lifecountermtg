package com.lifecounter.app

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import android.util.Log
import java.util.Locale
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
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import android.provider.Settings
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

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

    // Comando de vida por voz (SpeechRecognizer) — o WebView não tem Web Speech API.
    private var speechRecognizer: SpeechRecognizer? = null
    private var voiceActive = false

    private val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) startSpeech()
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> /* sem permissão o worker só não mostra nada */ }

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

            // Ponte de voz (comando de vida por voz) — o WebView não tem Web Speech API.
            webView.addJavascriptInterface(VoiceBridge(), "LCVoice")

            // Ponte da vitória escandalosa: lanterna, vibrador e TTS gritado.
            webView.addJavascriptInterface(HypeBridge(), "LCHype")
            ensureTts() // inicializa cedo: o TTS demora ~1s e o grito não pode atrasar

            // Ponte do app: versão instalada + download/instalação de atualização + notificações.
            webView.addJavascriptInterface(AppBridge(), "LCApp")
            NotificationWorker.ensureChannel(this)
            NotificationWorker.schedule(this)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
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
        // Sair do app no meio do escândalo não pode deixar a lanterna acesa.
        strobeHandler.removeCallbacks(strobeRunnable)
        setTorch(false)
        if (::webView.isInitialized) {
            webView.onPause()
        }
        super.onPause()
    }

    // ===== Versão e auto-update (window.LCApp) =====
    // O app pergunta ao servidor (lifecounter.mreis.site) se há versão nova e,
    // se houver, baixa o APK pro cache e chama o instalador do Android.
    // Progresso volta pro JS via window.__lcUpdateStatus(json). Ver src/ts/updater.ts.

    @Volatile private var updateDownloading = false
    private var downloadedApk: File? = null

    inner class AppBridge {
        @JavascriptInterface
        fun getVersionCode(): Int = try {
            val info = packageManager.getPackageInfo(packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode.toInt()
            else @Suppress("DEPRECATION") info.versionCode
        } catch (e: Exception) { 0 }

        @JavascriptInterface
        fun getVersionName(): String = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        } catch (e: Exception) { "" }

        @JavascriptInterface
        fun downloadAndInstall(url: String, versionName: String) {
            if (updateDownloading) return
            updateDownloading = true
            Thread { downloadApk(url, versionName) }.start()
        }

        // Reabre o instalador com o APK já baixado (ex.: depois de liberar "fontes desconhecidas").
        @JavascriptInterface
        fun installAgain() {
            val f = downloadedApk
            if (f != null && f.exists()) runOnUiThread { installApk(f) }
        }

        // "Meu perfil" neste aparelho — usado pelo NotificationWorker ("fulano te ultrapassou").
        @JavascriptInterface
        fun setMyProfile(profileId: Int, name: String) {
            getSharedPreferences(NotificationWorker.PREFS, Context.MODE_PRIVATE).edit()
                .putInt(NotificationWorker.KEY_PROFILE_ID, profileId)
                .putString(NotificationWorker.KEY_PROFILE_NAME, name)
                .apply()
        }

        @JavascriptInterface
        fun getMyProfile(): Int =
            getSharedPreferences(NotificationWorker.PREFS, Context.MODE_PRIVATE).getInt(NotificationWorker.KEY_PROFILE_ID, 0)
    }

    private fun sendUpdateStatus(state: String, percent: Int = 0, message: String = "") {
        val json = JSONObject().put("state", state).put("percent", percent).put("message", message).toString()
        val safe = json.replace("\\", "\\\\").replace("'", "\\'")
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript("window.__lcUpdateStatus && window.__lcUpdateStatus('$safe')", null)
            }
        }
    }

    private fun downloadApk(url: String, versionName: String) {
        try {
            val dir = File(cacheDir, "updates").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            val out = File(dir, "LifeCounter-v${versionName.ifBlank { "nova" }}.apk")

            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 60000
                instanceFollowRedirects = true
            }
            conn.connect()
            if (conn.responseCode !in 200..299) throw Exception("HTTP ${conn.responseCode}")
            val total = conn.contentLength.toLong()
            var read = 0L
            var lastPct = -1
            conn.inputStream.use { input ->
                FileOutputStream(out).use { output ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n <= 0) break
                        output.write(buf, 0, n)
                        read += n
                        if (total > 0) {
                            val pct = (read * 100 / total).toInt()
                            if (pct != lastPct) { lastPct = pct; sendUpdateStatus("progress", pct) }
                        }
                    }
                }
            }
            if (out.length() < 100_000) throw Exception("arquivo baixado parece inválido (${out.length()} bytes)")
            downloadedApk = out
            sendUpdateStatus("installing", 100)
            runOnUiThread { installApk(out) }
        } catch (e: Exception) {
            Log.e(TAG, "update: ${e.message}", e)
            sendUpdateStatus("error", 0, e.message ?: "erro")
        } finally {
            updateDownloading = false
        }
    }

    private fun installApk(file: File) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                // Precisa liberar "instalar apps desconhecidos" pra este app; abre a tela certa.
                sendUpdateStatus("error", 0, "Libere \"instalar apps desconhecidos\" para o LifeCounter e toque em Instalar de novo")
                startActivity(
                    Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName"))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                return
            }
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "install: ${e.message}", e)
            sendUpdateStatus("error", 0, "não consegui abrir o instalador: ${e.message}")
        }
    }

    // ===== Vitória escandalosa (window.LCHype) =====
    // O WebView não acende a lanterna nem vibra sozinho de forma confiável, e o
    // speechSynthesis dele é instável — então os 8 segundos de escândalo passam
    // por aqui. Ver src/ts/victory.ts.

    private val strobeHandler = Handler(Looper.getMainLooper())
    private var strobeOn = false
    private var strobeEndAt = 0L
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private val pendingShouts = ArrayList<String>()

    inner class HypeBridge {
        @JavascriptInterface
        fun strobe(durationMs: Int) {
            runOnUiThread { startTorchStrobe(durationMs.toLong()) }
        }

        @JavascriptInterface
        fun vibrate(durationMs: Int) {
            runOnUiThread { vibrateEscandalo(durationMs.toLong()) }
        }

        @JavascriptInterface
        fun shout(text: String) {
            runOnUiThread { ttsShout(text) }
        }

        @JavascriptInterface
        fun isShouting(): Boolean =
            synchronized(pendingShouts) { pendingShouts.isNotEmpty() } || tts?.isSpeaking == true

        @JavascriptInterface
        fun shutUp() {
            runOnUiThread {
                synchronized(pendingShouts) { pendingShouts.clear() }
                try { tts?.stop() } catch (_: Exception) {}
            }
        }
    }

    // Lanterna piscando. O ciclo (90 ms aceso / 320 ms apagado) fica abaixo de
    // 3 Hz por segurança contra fotossensibilidade — igual ao flash de tela.
    private val strobeRunnable = object : Runnable {
        override fun run() {
            if (System.currentTimeMillis() >= strobeEndAt) {
                strobeOn = false
                setTorch(false)
                return
            }
            strobeOn = !strobeOn
            setTorch(strobeOn)
            strobeHandler.postDelayed(this, if (strobeOn) 90L else 320L)
        }
    }

    private fun startTorchStrobe(durationMs: Long) {
        strobeHandler.removeCallbacks(strobeRunnable)
        if (durationMs <= 0) {
            strobeOn = false
            setTorch(false)
            return
        }
        strobeEndAt = System.currentTimeMillis() + durationMs
        strobeOn = false
        strobeHandler.post(strobeRunnable)
    }

    private fun setTorch(on: Boolean) {
        try {
            val manager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = manager.cameraIdList.firstOrNull { id ->
                manager.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: return
            manager.setTorchMode(cameraId, on)
        } catch (e: Exception) {
            Log.w(TAG, "lanterna: ${e.message}")
        }
    }

    private fun vibrator(): Vibrator? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    } catch (e: Exception) {
        Log.w(TAG, "vibrador: ${e.message}")
        null
    }

    private fun vibrateEscandalo(durationMs: Long) {
        val vibrator = vibrator() ?: return
        if (!vibrator.hasVibrator()) return

        if (durationMs <= 0) {
            try { vibrator.cancel() } catch (_: Exception) {}
            return
        }

        // Rajadas cada vez mais longas e fortes até cobrir o escândalo inteiro.
        val timings = ArrayList<Long>()
        val amplitudes = ArrayList<Int>()
        var total = 0L
        var i = 0
        while (total < durationMs) {
            val on = 200L + i * 25L
            timings.add(on); amplitudes.add(minOf(255, 150 + i * 10))
            timings.add(120L); amplitudes.add(0)
            total += on + 120L
            i++
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(timings.toLongArray(), amplitudes.toIntArray(), -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(timings.toLongArray(), -1)
            }
        } catch (e: Exception) {
            Log.w(TAG, "vibrar: ${e.message}")
        }
    }

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(this) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (!ttsReady) {
                Log.w(TAG, "TTS indisponível ($status)")
                return@TextToSpeech
            }
            tts?.language = Locale("pt", "BR")
            tts?.setPitch(1.5f)
            tts?.setSpeechRate(1.25f)
            val queued = synchronized(pendingShouts) {
                val copy = pendingShouts.toList()
                pendingShouts.clear()
                copy
            }
            queued.forEach { speakNow(it) }
        }
    }

    private fun ttsShout(text: String) {
        if (text.isBlank()) return
        if (!ttsReady) {
            synchronized(pendingShouts) { pendingShouts.add(text) }
            ensureTts()
            return
        }
        speakNow(text)
    }

    private fun speakNow(text: String) {
        try {
            tts?.speak(text, TextToSpeech.QUEUE_ADD, null, "escandalo")
        } catch (e: Exception) {
            Log.w(TAG, "falar: ${e.message}")
        }
    }

    // ===== Comando de voz (SpeechRecognizer) exposto como window.LCVoice =====
    inner class VoiceBridge {
        @JavascriptInterface
        fun start() {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(
                        this@MainActivity, Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    startSpeech()
                } else {
                    audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        }

        @JavascriptInterface
        fun stop() {
            runOnUiThread { stopSpeech() }
        }
    }

    private fun startSpeech() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            Log.w(TAG, "Reconhecimento de voz indisponível neste aparelho")
            return
        }
        voiceActive = true
        if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(object : RecognitionListener {
                    override fun onResults(results: Bundle?) {
                        results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()?.let { sendVoiceResult(it, true) }
                        if (voiceActive) restartListening()
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()?.let { sendVoiceResult(it, false) }
                    }
                    override fun onError(error: Int) {
                        if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                            sendVoiceStatus("sem permissão de microfone")
                            voiceActive = false
                            return
                        }
                        if (error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                            sendVoiceStatus(errText(error))
                        }
                        if (voiceActive) restartListening()
                    }
                    override fun onReadyForSpeech(params: Bundle?) {
                        sendVoiceStatus("ouvindo… pode falar")
                    }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() {}
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
            }
        }
        listenOnce()
    }

    private fun listenOnce() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        try {
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {
            Log.e(TAG, "startListening: ${e.message}")
        }
    }

    private fun restartListening() {
        if (::webView.isInitialized) {
            webView.postDelayed({ if (voiceActive) listenOnce() }, 350)
        }
    }

    private fun sendVoiceResult(text: String, final: Boolean) {
        val safe = text.replace("\\", "\\\\").replace("'", "\\'")
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "window.__lcVoiceResult && window.__lcVoiceResult('$safe', $final)", null
                )
            }
        }
    }

    private fun sendVoiceStatus(msg: String) {
        val safe = msg.replace("\\", "\\\\").replace("'", "\\'")
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript("window.__lcVoiceStatus && window.__lcVoiceStatus('$safe')", null)
            }
        }
    }

    private fun errText(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "erro de áudio"
        SpeechRecognizer.ERROR_CLIENT -> "erro de cliente"
        SpeechRecognizer.ERROR_NETWORK -> "erro de rede"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "timeout de rede"
        SpeechRecognizer.ERROR_NO_MATCH -> "não entendi, repita"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "reconhecedor ocupado"
        SpeechRecognizer.ERROR_SERVER -> "erro no servidor de voz"
        else -> "erro de voz ($code)"
    }

    private fun stopSpeech() {
        voiceActive = false
        speechRecognizer?.let {
            try { it.stopListening() } catch (_: Exception) {}
            try { it.cancel() } catch (_: Exception) {}
        }
    }

    override fun onDestroy() {
        voiceActive = false
        try { speechRecognizer?.destroy() } catch (_: Exception) {}
        speechRecognizer = null
        // Não deixa a lanterna acesa nem o TTS gritando depois de fechar o app.
        strobeHandler.removeCallbacks(strobeRunnable)
        setTorch(false)
        try { tts?.stop() } catch (_: Exception) {}
        try { tts?.shutdown() } catch (_: Exception) {}
        tts = null
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
