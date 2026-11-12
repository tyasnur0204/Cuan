package id.cuan.app

import android.content.ComponentName
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.service.notification.NotificationListenerService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

object CuanNotificationBridge {
  private const val PREFS_NAME = "cuan_notif_prefs"
  private const val KEY_CONFIG = "config_json"
  private const val KEY_PENDING = "pending_events_json"
  private const val KEY_HISTORY = "history_events_json"
  private const val KEY_SEEN_HASHES = "seen_hashes_json"
  private val lock = Any()

  @Volatile
  var reactContext: ReactApplicationContext? = null

  private fun prefs(context: Context): SharedPreferences {
    return context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
  }

  fun getConfig(context: Context): JSONObject {
    synchronized(lock) {
      val raw = prefs(context).getString(KEY_CONFIG, null) ?: return JSONObject()
      return try {
        JSONObject(raw)
      } catch (_: Throwable) {
        JSONObject()
      }
    }
  }

  fun saveConfig(context: Context, configJson: String) {
    synchronized(lock) {
      prefs(context).edit().putString(KEY_CONFIG, configJson).apply()
    }
  }

  fun getPendingArray(context: Context): JSONArray {
    synchronized(lock) {
      val raw = prefs(context).getString(KEY_PENDING, null) ?: return JSONArray()
      return try {
        JSONArray(raw)
      } catch (_: Throwable) {
        JSONArray()
      }
    }
  }

  fun appendPending(context: Context, item: JSONObject) {
    synchronized(lock) {
      val arr = getPendingArray(context)
      val id = item.optString("id")
      for (i in 0 until arr.length()) {
        val existing = arr.optJSONObject(i)
        if (existing != null && existing.optString("id") == id) {
          return
        }
      }
      val next = JSONArray()
      next.put(item)
      val limit = minOf(arr.length(), 99)
      for (i in 0 until limit) {
        next.put(arr.get(i))
      }
      prefs(context).edit().putString(KEY_PENDING, next.toString()).apply()
    }
  }

  fun removePending(context: Context, eventId: String) {
    synchronized(lock) {
      val arr = getPendingArray(context)
      val next = JSONArray()
      for (i in 0 until arr.length()) {
        val obj = arr.optJSONObject(i) ?: continue
        if (obj.optString("id") != eventId) {
          next.put(obj)
        }
      }
      prefs(context).edit().putString(KEY_PENDING, next.toString()).apply()
    }
  }

  fun clearPending(context: Context) {
    synchronized(lock) {
      prefs(context).edit().putString(KEY_PENDING, "[]").apply()
    }
  }

  fun getHistoryArray(context: Context): JSONArray {
    synchronized(lock) {
      val raw = prefs(context).getString(KEY_HISTORY, null) ?: return JSONArray()
      return try {
        JSONArray(raw)
      } catch (_: Throwable) {
        JSONArray()
      }
    }
  }

  fun appendHistory(context: Context, item: JSONObject) {
    synchronized(lock) {
      val arr = getHistoryArray(context)
      val id = item.optString("id")
      val next = JSONArray()
      next.put(item)
      for (i in 0 until arr.length()) {
        val obj = arr.optJSONObject(i) ?: continue
        if (obj.optString("id") != id && next.length() < 60) {
          next.put(obj)
        }
      }
      prefs(context).edit().putString(KEY_HISTORY, next.toString()).apply()
    }
  }

  fun clearHistory(context: Context) {
    synchronized(lock) {
      prefs(context).edit().putString(KEY_HISTORY, "[]").apply()
    }
  }

  fun isDuplicateAndMark(
    context: Context,
    packageName: String,
    title: String,
    body: String,
    postTime: Long
  ): Boolean {
    val clean = "${packageName.lowercase()}|${title.trim().lowercase()}|${body.trim().lowercase()}"
    val digest = MessageDigest.getInstance("SHA-256").digest(clean.toByteArray(Charsets.UTF_8))
    val hash = digest.joinToString("") { "%02x".format(it) }.take(24)
    val now = System.currentTimeMillis()
    val windowMs = 90_000L

    synchronized(lock) {
      val raw = prefs(context).getString(KEY_SEEN_HASHES, null)
      val map = try {
        if (raw != null) JSONObject(raw) else JSONObject()
      } catch (_: Throwable) {
        JSONObject()
      }

      val lastSeen = map.optLong(hash, 0L)
      if (lastSeen > 0L && (now - lastSeen) < windowMs) {
        return true
      }

      val next = JSONObject()
      val keys = map.keys()
      while (keys.hasNext()) {
        val k = keys.next()
        val ts = map.optLong(k, 0L)
        if ((now - ts) < windowMs * 2 && next.length() < 40) {
          next.put(k, ts)
        }
      }
      next.put(hash, now)
      prefs(context).edit().putString(KEY_SEEN_HASHES, next.toString()).apply()
      return false
    }
  }

  fun makeEventId(packageName: String, title: String, body: String, postTime: Long): String {
    val bucket = (if (postTime > 0L) postTime else System.currentTimeMillis()) / 15_000L
    val seed = "$packageName|$title|$body|$bucket"
    val digest = MessageDigest.getInstance("SHA-256").digest(seed.toByteArray(Charsets.UTF_8))
    return "ntf_" + digest.joinToString("") { "%02x".format(it) }.take(20)
  }

  fun emitToJs(eventName: String, payloadJson: String) {
    val ctx = reactContext ?: return
    try {
      if (!ctx.hasActiveReactInstance()) return
      val params = Arguments.createMap()
      params.putString("payload", payloadJson)
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, params)
    } catch (_: Throwable) {
    }
  }

  fun requestRebind(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      try {
        NotificationListenerService.requestRebind(
          ComponentName(context.applicationContext, CuanNotificationListenerService::class.java)
        )
      } catch (_: Throwable) {
      }
    }
  }
}
