package md.shades.lms.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import java.time.LocalDate

/** One sync: Health Connect → LMS, then today's eaten kcal LMS → Health Connect. */
object Sync {
    suspend fun run(context: Context): String {
        val settings = Settings(context)
        if (settings.key.isBlank()) return "Add your access key first."
        val reader = HealthReader(HealthConnectClient.getOrCreate(context))
        // First sync: the last 30 days (all Health Connect gives an app at first); then a week.
        val days = if (settings.lastSync == 0L) 30 else 7
        val (dayValues, workouts) = reader.read(days)
        val lms = LmsClient(settings.server, settings.key)
        lms.sendHealth(Payload.json(dayValues, workouts))

        val today = LocalDate.now()
        val energy = lms.energyToday(today.toString())
        val kcal = Payload.number(energy, "eatenKcal") ?: 0.0
        if (kcal > 0) {
            reader.writeEaten(
                today,
                kcal,
                Payload.number(energy, "protein") ?: 0.0,
                Payload.number(energy, "fat") ?: 0.0,
                Payload.number(energy, "carbs") ?: 0.0,
            )
        }
        settings.lastSync = System.currentTimeMillis()
        val sent = dayValues.count { !it.isEmpty }
        return "Sent $sent day${if (sent == 1) "" else "s"}, ${workouts.size} workout${if (workouts.size == 1) "" else "s"}."
    }
}
