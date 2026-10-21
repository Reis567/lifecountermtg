package com.lifecounter.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Consulta /api/notifications/ no servidor a cada ~1 h (mesmo com o app fechado)
 * e mostra notificações do sistema: nova versão do APK, temporada encerrada,
 * "fulano te ultrapassou", conquistas. Sem Firebase: é polling via WorkManager.
 *
 * O "meu perfil" vem do JS (window.LCApp.setMyProfile) e fica no SharedPreferences.
 */
class NotificationWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val profileId = prefs.getInt(KEY_PROFILE_ID, 0)
        val since = prefs.getString(KEY_SINCE, null)
        val seen = prefs.getStringSet(KEY_SEEN, emptySet())?.toMutableSet() ?: mutableSetOf()
        val versionCode = try {
            val info = ctx.packageManager.getPackageInfo(ctx.packageName, 0)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode.toInt()
            else @Suppress("DEPRECATION") info.versionCode
        } catch (e: Exception) { 0 }

        val url = buildString {
            append("$BASE_URL/api/notifications/?version_code=$versionCode")
            if (profileId > 0) append("&profile=$profileId")
            if (!since.isNullOrBlank()) append("&since=").append(URLEncoder.encode(since, "UTF-8"))
        }

        return try {
            val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 20000
                setRequestProperty("Accept", "application/json")
            }
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(body)
            val list = json.getJSONArray("notifications")
            var shown = 0
            for (i in 0 until list.length()) {
                val n = list.getJSONObject(i)
                val id = n.optString("id")
                if (id.isBlank() || seen.contains(id)) continue
                show(ctx, id.hashCode(), n.optString("title"), n.optString("body"))
                seen.add(id)
                shown++
            }
            // Mantém só os últimos 200 ids vistos.
            val trimmed = if (seen.size > 200) seen.toList().takeLast(200).toSet() else seen
            prefs.edit()
                .putString(KEY_SINCE, json.optString("now", since))
                .putStringSet(KEY_SEEN, trimmed)
                .apply()
            Log.d(TAG, "notificações: $shown nova(s)")
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "notificações: ${e.message}")
            Result.retry()
        }
    }

    private fun show(ctx: Context, id: Int, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return
        ensureChannel(ctx)
        val open = PendingIntent.getActivity(
            ctx, id, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notif = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        try { NotificationManagerCompat.from(ctx).notify(id, notif) } catch (_: SecurityException) {}
    }

    companion object {
        const val TAG = "LifeCounter"
        const val BASE_URL = "https://lifecounter.mreis.site"
        const val PREFS = "lc_notifications"
        const val KEY_PROFILE_ID = "my_profile_id"
        const val KEY_PROFILE_NAME = "my_profile_name"
        const val KEY_SINCE = "since"
        const val KEY_SEEN = "seen"
        const val CHANNEL = "lc_mesa"
        private const val WORK_NAME = "lc-notifications"

        fun ensureChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL, "Mesa (ranking, temporada, versão)", NotificationManager.IMPORTANCE_DEFAULT)
                )
            }
        }

        fun schedule(ctx: Context) {
            val req = PeriodicWorkRequestBuilder<NotificationWorker>(1, TimeUnit.HOURS)
                .setInitialDelay(20, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, req)
        }
    }
}
