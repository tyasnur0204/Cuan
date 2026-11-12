package id.cuan.app

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors

class CuanNotificationListenerService : NotificationListenerService() {
  private val networkExecutor = Executors.newSingleThreadExecutor()

  override fun onListenerConnected() {
    super.onListenerConnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val pkg = sbn.packageName?.lowercase(Locale.ROOT) ?: return
    if (pkg == applicationContext.packageName.lowercase(Locale.ROOT)) return
    if (sbn.isOngoing) return

    val notification = sbn.notification ?: return
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

    val config = CuanNotificationBridge.getConfig(applicationContext)
    if (!config.optBoolean("enabled", false)) return

    val watchedArr = config.optJSONArray("watchedPackages")
    val watchedSet = mutableSetOf<String>()
    if (watchedArr != null && watchedArr.length() > 0) {
      for (i in 0 until watchedArr.length()) {
        val p = watchedArr.optString(i).trim().lowercase(Locale.ROOT)
        if (p.isNotEmpty()) watchedSet.add(p)
      }
    } else {
      watchedSet.addAll(CuanPaymentParser.ALL_PACKAGES)
    }

    if (!watchedSet.contains(pkg)) return

    val extras = notification.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
    val bigText = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""

    val bodyForDedup = bigText.ifBlank { text }
    if (title.isBlank() && bodyForDedup.isBlank()) return

    if (CuanNotificationBridge.isDuplicateAndMark(applicationContext, pkg, title, bodyForDedup, sbn.postTime)) {
      return
    }

    val parsed = CuanPaymentParser.parse(pkg, title, text, bigText, sbn.postTime) ?: return

    val accountMap = config.optJSONObject("accountMap") ?: JSONObject()
    val defaultAccountId = config.optString("defaultAccountId", "").trim()
    val mappedAccountId = accountMap.optString(parsed.appKey, "").trim()
    val targetAccountId = mappedAccountId.ifEmpty { defaultAccountId }

    val businessArr = config.optJSONArray("businessApps") ?: JSONArray()
    var isBusiness = false
    for (i in 0 until businessArr.length()) {
      if (businessArr.optString(i) == parsed.appKey) {
        isBusiness = true
        break
      }
    }

    val eventId = CuanNotificationBridge.makeEventId(pkg, title, bodyForDedup, sbn.postTime)
    val eventObj = JSONObject().apply {
      put("id", eventId)
      put("appKey", parsed.appKey)
      put("appName", parsed.appName)
      put("packageName", parsed.packageName)
      put("type", parsed.type)
      put("amount", parsed.amount)
      put("category", parsed.category)
      put("transactionDate", parsed.transactionDate)
      put("notes", parsed.notes)
      put("rawTitle", parsed.rawTitle)
      put("rawText", parsed.rawText)
      put("postTime", parsed.postTime)
      put("receivedAt", System.currentTimeMillis())
      put("suggestedAccountId", targetAccountId)
      put("isBusiness", isBusiness)
      put("status", "pending")
    }

    val mode = config.optString("mode", "queue")
    val apiBaseUrl = config.optString("apiBaseUrl", "").trim().trimEnd('/')
    val authToken = config.optString("authToken", "").trim()

    if (mode == "auto" && apiBaseUrl.isNotEmpty() && authToken.isNotEmpty() && targetAccountId.isNotEmpty()) {
      networkExecutor.execute {
        val result = postTransactionDirectly(apiBaseUrl, authToken, targetAccountId, parsed, isBusiness)
        if (result.first) {
          eventObj.put("status", "synced")
          eventObj.put("accountId", targetAccountId)
          eventObj.put("txId", result.second ?: "")
          eventObj.put("syncedAt", System.currentTimeMillis())
          CuanNotificationBridge.appendHistory(applicationContext, eventObj)
        } else {
          eventObj.put("status", "pending")
          eventObj.put("errorReason", result.second ?: "Gagal kirim otomatis")
          CuanNotificationBridge.appendPending(applicationContext, eventObj)
        }
        CuanNotificationBridge.emitToJs("CuanPaymentNotification", eventObj.toString())
      }
    } else {
      CuanNotificationBridge.appendPending(applicationContext, eventObj)
      CuanNotificationBridge.emitToJs("CuanPaymentNotification", eventObj.toString())
    }
  }

  private fun postTransactionDirectly(
    apiBaseUrl: String,
    authToken: String,
    accountId: String,
    parsed: ParsedPaymentResult,
    isBusiness: Boolean
  ): Pair<Boolean, String?> {
    var conn: HttpURLConnection? = null
    return try {
      val url = URL("$apiBaseUrl/transactions")
      conn = (url.openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 15_000
        readTimeout = 20_000
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("Accept", "application/json")
        setRequestProperty("Authorization", "Bearer $authToken")
      }
      val body = JSONObject().apply {
        put("account_id", accountId)
        put("type", parsed.type)
        put("category", parsed.category)
        put("amount", parsed.amount)
        put("transaction_date", parsed.transactionDate)
        put("notes", parsed.notes)
        put("is_business", isBusiness)
      }
      OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { writer ->
        writer.write(body.toString())
        writer.flush()
      }
      val code = conn.responseCode
      if (code in 200..299) {
        val respText = BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { it.readText() }
        val txId = try {
          JSONObject(respText).optString("id", "")
        } catch (_: Throwable) {
          ""
        }
        Pair(true, txId)
      } else {
        Pair(false, "HTTP $code")
      }
    } catch (e: Throwable) {
      Pair(false, e.message ?: "Network error")
    } finally {
      conn?.disconnect()
    }
  }

  override fun onDestroy() {
    networkExecutor.shutdown()
    super.onDestroy()
  }
}
