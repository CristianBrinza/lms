package md.shades.lms.health

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/** Syncs every few hours while auto-sync is on (needs Health Connect's background permission). */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val settings = Settings(applicationContext)
        return try {
            settings.lastResult = Sync.run(applicationContext)
            Result.success()
        } catch (e: LmsClient.HttpError) {
            settings.lastResult = e.message.orEmpty()
            if (e.status >= 500) Result.retry() else Result.failure()
        } catch (e: SecurityException) {
            settings.lastResult = "Health Connect didn't allow reading in the background. Open the app and sync."
            Result.failure()
        } catch (e: Exception) {
            settings.lastResult = e.message ?: e.toString()
            Result.retry()
        }
    }

    companion object {
        private const val NAME = "lms-health-sync"

        fun schedule(context: Context, on: Boolean) {
            val work = WorkManager.getInstance(context)
            if (!on) {
                work.cancelUniqueWork(NAME)
                return
            }
            val request = PeriodicWorkRequestBuilder<SyncWorker>(3, TimeUnit.HOURS)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build()
            work.enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }
    }
}
