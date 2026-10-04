package md.shades.lms.health

import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

/**
 * What the phone sends LMS: one entry per day of totals from Health Connect, and the workouts
 * recorded on the phone (a run from the watch). The same shape the iPhone Shortcut sends to
 * POST /api/training/health, with source "google". Plain Kotlin: tested without Android.
 */
data class DayValues(
    /** YYYY-MM-DD, the phone's local day. */
    val date: String,
    val steps: Long? = null,
    /** Metres walked and run. */
    val distance: Double? = null,
    /** kcal burned moving. */
    val activeEnergy: Double? = null,
    /** kcal burned at rest. */
    val restingEnergy: Double? = null,
    val flights: Double? = null,
    val restingHeartRate: Long? = null,
    val heartRate: Long? = null,
    /** Heart rate variability, ms. */
    val hrv: Double? = null,
    /** Minutes asleep (the night that ended this day). */
    val sleep: Long? = null,
    /** kg, the day's last weigh-in. */
    val weight: Double? = null,
    /** %. */
    val bodyFat: Double? = null,
    val vo2max: Double? = null,
    val exerciseMinutes: Long? = null,
) {
    val isEmpty: Boolean
        get() = listOf(steps, distance, activeEnergy, restingEnergy, flights, restingHeartRate, heartRate, hrv, sleep, weight, bodyFat, vo2max, exerciseMinutes).all { it == null }
}

data class PhoneWorkout(
    /** Health Connect's id, so a second sync doesn't count it twice. */
    val id: String,
    /** Running, Walking, Cycling, Yoga… LMS matches its own exercises by this name. */
    val type: String,
    val start: OffsetDateTime,
    val end: OffsetDateTime,
    /** Metres. */
    val distance: Double? = null,
    /** kcal. */
    val energy: Double? = null,
)

object Payload {
    fun json(days: List<DayValues>, workouts: List<PhoneWorkout>): String {
        val out = StringBuilder()
        out.append("{\"source\":\"google\",\"days\":[")
        days.filterNot { it.isEmpty }.forEachIndexed { i, d ->
            if (i > 0) out.append(',')
            val fields = linkedMapOf<String, Any?>(
                "date" to d.date,
                "steps" to d.steps,
                "distance" to d.distance?.let(::round0),
                "activeEnergy" to d.activeEnergy?.let(::round0),
                "restingEnergy" to d.restingEnergy?.let(::round0),
                "flights" to d.flights?.let(::round0),
                "restingHeartRate" to d.restingHeartRate,
                "heartRate" to d.heartRate,
                "hrv" to d.hrv?.let(::round0),
                "sleep" to d.sleep,
                "weight" to d.weight?.let(::round1),
                "bodyFat" to d.bodyFat?.let(::round1),
                "vo2max" to d.vo2max?.let(::round1),
                "exerciseMinutes" to d.exerciseMinutes,
            )
            out.append(obj(fields))
        }
        out.append("],\"workouts\":[")
        workouts.forEachIndexed { i, w ->
            if (i > 0) out.append(',')
            out.append(
                obj(
                    linkedMapOf(
                        "id" to w.id,
                        "type" to w.type,
                        "start" to w.start.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                        "end" to w.end.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                        "distance" to w.distance?.let(::round0),
                        "energy" to w.energy?.let(::round0),
                    ),
                ),
            )
        }
        out.append("]}")
        return out.toString()
    }

    private fun round0(v: Double): Long = Math.round(v)
    private fun round1(v: Double): Double = Math.round(v * 10) / 10.0

    private fun obj(fields: Map<String, Any?>): String =
        fields.entries.filter { it.value != null }.joinToString(",", "{", "}") { (k, v) -> "${quote(k)}:${value(v!!)}" }

    private fun value(v: Any): String = when (v) {
        is String -> quote(v)
        is Double -> if (v == Math.floor(v) && !v.isInfinite()) v.toLong().toString() else v.toString()
        else -> v.toString()
    }

    fun quote(s: String): String {
        val b = StringBuilder("\"")
        for (c in s) {
            when {
                c == '"' -> b.append("\\\"")
                c == '\\' -> b.append("\\\\")
                c == '\n' -> b.append("\\n")
                c == '\r' -> b.append("\\r")
                c == '\t' -> b.append("\\t")
                c < ' ' -> b.append(String.format("\\u%04x", c.code))
                else -> b.append(c)
            }
        }
        return b.append('"').toString()
    }

    /** Reads one number field from a flat JSON answer ({"eatenKcal": 1240, …}); null if absent. */
    fun number(json: String, field: String): Double? {
        val match = Regex("\"" + Regex.escape(field) + "\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)").find(json) ?: return null
        return match.groupValues[1].toDoubleOrNull()
    }
}
