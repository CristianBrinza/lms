package md.shades.lms.health

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** The server, the access key (encrypted at rest) and how the last sync went. */
class Settings(context: Context) {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "lms",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    var server: String
        get() = prefs.getString("server", null) ?: DEFAULT_SERVER
        set(v) = prefs.edit().putString("server", v.trim().trimEnd('/')).apply()

    var key: String
        get() = prefs.getString("key", null).orEmpty()
        set(v) = prefs.edit().putString("key", v.trim()).apply()

    var autoSync: Boolean
        get() = prefs.getBoolean("autoSync", false)
        set(v) = prefs.edit().putBoolean("autoSync", v).apply()

    /** Epoch ms of the last sync that reached LMS; 0 before the first. */
    var lastSync: Long
        get() = prefs.getLong("lastSync", 0)
        set(v) = prefs.edit().putLong("lastSync", v).apply()

    var lastResult: String
        get() = prefs.getString("lastResult", null).orEmpty()
        set(v) = prefs.edit().putString("lastResult", v).apply()

    companion object {
        const val DEFAULT_SERVER = "https://lms.shades.md"
    }
}
