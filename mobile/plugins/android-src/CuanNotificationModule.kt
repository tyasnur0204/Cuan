package id.cuan.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

class CuanNotificationModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  init {
    CuanNotificationBridge.reactContext = reactContext
  }

  override fun getName(): String = "CuanNotificationModule"

  @ReactMethod
  fun isNotificationAccessEnabled(promise: Promise) {
    try {
      val flat = Settings.Secure.getString(
        reactApplicationContext.contentResolver,
        "enabled_notification_listeners"
      ) ?: ""
      val pkg = reactApplicationContext.packageName
      val enabled = flat.contains("$pkg/") || flat.contains("CuanNotificationListenerService")
      promise.resolve(enabled)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun openNotificationAccessSettings(promise: Promise) {
    try {
      val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS").apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (_: Throwable) {
      try {
        val fallback = Intent(Settings.ACTION_SETTINGS).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(fallback)
        promise.resolve(true)
      } catch (err: Throwable) {
        promise.reject("OPEN_SETTINGS_ERROR", err.message, err)
      }
    }
  }

  @ReactMethod
  fun openAppDetailsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
        data = Uri.parse("package:${reactApplicationContext.packageName}")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("OPEN_APP_SETTINGS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun openBatteryOptimizationSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(true)
    } catch (_: Throwable) {
      openAppDetailsSettings(promise)
    }
  }

  @ReactMethod
  fun syncConfig(configJson: String, promise: Promise) {
    try {
      CuanNotificationBridge.saveConfig(reactApplicationContext, configJson)
      CuanNotificationBridge.requestRebind(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("SYNC_CONFIG_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun getPendingEvents(promise: Promise) {
    try {
      promise.resolve(CuanNotificationBridge.getPendingArray(reactApplicationContext).toString())
    } catch (_: Throwable) {
      promise.resolve("[]")
    }
  }

  @ReactMethod
  fun removePendingEvent(eventId: String, promise: Promise) {
    try {
      CuanNotificationBridge.removePending(reactApplicationContext, eventId)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("REMOVE_PENDING_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun clearPendingEvents(promise: Promise) {
    try {
      CuanNotificationBridge.clearPending(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("CLEAR_PENDING_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun getRecentHistory(promise: Promise) {
    try {
      promise.resolve(CuanNotificationBridge.getHistoryArray(reactApplicationContext).toString())
    } catch (_: Throwable) {
      promise.resolve("[]")
    }
  }

  @ReactMethod
  fun appendHistoryEvent(eventJson: String, promise: Promise) {
    try {
      val obj = JSONObject(eventJson)
      CuanNotificationBridge.appendHistory(reactApplicationContext, obj)
      promise.resolve(true)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun clearHistory(promise: Promise) {
    try {
      CuanNotificationBridge.clearHistory(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("CLEAR_HISTORY_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun requestRebindService(promise: Promise) {
    try {
      CuanNotificationBridge.requestRebind(reactApplicationContext)
      promise.resolve(true)
    } catch (_: Throwable) {
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for RN NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for RN NativeEventEmitter
  }
}
