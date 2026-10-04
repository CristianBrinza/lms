package md.shades.lms.health

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Mass
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.Period
import java.time.ZoneId
import kotlin.reflect.KClass

/** Reads Health Connect into days of totals and workouts; writes what was eaten back. */
class HealthReader(private val client: HealthConnectClient) {
    companion object {
        /** What LMS reads. Each is asked for; whatever the person allows is read. */
        val READS: List<KClass<out Record>> = listOf(
            StepsRecord::class, DistanceRecord::class, ActiveCaloriesBurnedRecord::class,
            BasalMetabolicRateRecord::class, TotalCaloriesBurnedRecord::class, FloorsClimbedRecord::class,
            HeartRateRecord::class, RestingHeartRateRecord::class, HeartRateVariabilityRmssdRecord::class,
            SleepSessionRecord::class, WeightRecord::class, BodyFatRecord::class, Vo2MaxRecord::class,
            ExerciseSessionRecord::class,
        )
        const val BACKGROUND = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"
        val PERMISSIONS: Set<String> =
            READS.map { HealthPermission.getReadPermission(it) }.toSet() +
                HealthPermission.getWritePermission(NutritionRecord::class) + BACKGROUND
    }

    private val zone: ZoneId = ZoneId.systemDefault()

    suspend fun granted(): Set<String> = client.permissionController.getGrantedPermissions()

    /** The last [days] days, today included. */
    suspend fun read(days: Int): Pair<List<DayValues>, List<PhoneWorkout>> {
        val granted = granted()
        fun can(type: KClass<out Record>) = HealthPermission.getReadPermission(type) in granted

        val today = LocalDate.now(zone)
        val first = today.minusDays(days - 1L)
        val metrics = buildSet<AggregateMetric<*>> {
            if (can(StepsRecord::class)) add(StepsRecord.COUNT_TOTAL)
            if (can(DistanceRecord::class)) add(DistanceRecord.DISTANCE_TOTAL)
            if (can(ActiveCaloriesBurnedRecord::class)) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
            if (can(BasalMetabolicRateRecord::class)) add(BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL)
            if (can(FloorsClimbedRecord::class)) add(FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL)
            if (can(HeartRateRecord::class)) add(HeartRateRecord.BPM_AVG)
            if (can(RestingHeartRateRecord::class)) add(RestingHeartRateRecord.BPM_AVG)
            if (can(ExerciseSessionRecord::class)) add(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)
        }
        val byDay = mutableMapOf<LocalDate, DayValues>()
        for (d in 0 until days) first.plusDays(d.toLong()).let { byDay[it] = DayValues(it.toString()) }

        if (metrics.isNotEmpty()) {
            val groups = client.aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = metrics,
                    timeRangeFilter = TimeRangeFilter.between(first.atStartOfDay(), today.plusDays(1).atStartOfDay()),
                    timeRangeSlicer = Period.ofDays(1),
                ),
            )
            for (g in groups) {
                val day = g.startTime.toLocalDate()
                val r = g.result
                byDay[day] = (byDay[day] ?: DayValues(day.toString())).copy(
                    steps = r[StepsRecord.COUNT_TOTAL],
                    distance = r[DistanceRecord.DISTANCE_TOTAL]?.inMeters,
                    activeEnergy = r[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories,
                    restingEnergy = r[BasalMetabolicRateRecord.BASAL_CALORIES_TOTAL]?.inKilocalories,
                    flights = r[FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL],
                    heartRate = r[HeartRateRecord.BPM_AVG],
                    restingHeartRate = r[RestingHeartRateRecord.BPM_AVG],
                    exerciseMinutes = r[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.toMinutes(),
                )
            }
        }

        val from = first.atStartOfDay(zone).toInstant()
        val to = Instant.now()
        if (can(SleepSessionRecord::class)) {
            // A night counts on the day it ends; only the time asleep, not lying awake.
            for (s in records(SleepSessionRecord::class, from.minusSeconds(86_400), to)) {
                val day = s.endTime.atZone(zone).toLocalDate()
                val asleep = if (s.stages.isEmpty()) {
                    java.time.Duration.between(s.startTime, s.endTime).toMinutes()
                } else {
                    s.stages.filter { it.stage in ASLEEP }.sumOf { java.time.Duration.between(it.startTime, it.endTime).toMinutes() }
                }
                byDay[day]?.let { byDay[day] = it.copy(sleep = (it.sleep ?: 0) + asleep) }
            }
        }
        if (can(WeightRecord::class)) {
            for (w in records(WeightRecord::class, from, to).sortedBy { it.time }) {
                val day = w.time.atZone(zone).toLocalDate()
                byDay[day]?.let { byDay[day] = it.copy(weight = w.weight.inKilograms) }
            }
        }
        if (can(BodyFatRecord::class)) {
            for (b in records(BodyFatRecord::class, from, to).sortedBy { it.time }) {
                val day = b.time.atZone(zone).toLocalDate()
                byDay[day]?.let { byDay[day] = it.copy(bodyFat = b.percentage.value) }
            }
        }
        if (can(Vo2MaxRecord::class)) {
            for (v in records(Vo2MaxRecord::class, from, to).sortedBy { it.time }) {
                val day = v.time.atZone(zone).toLocalDate()
                byDay[day]?.let { byDay[day] = it.copy(vo2max = v.vo2MillilitersPerMinuteKilogram) }
            }
        }
        if (can(HeartRateVariabilityRmssdRecord::class)) {
            records(HeartRateVariabilityRmssdRecord::class, from, to)
                .groupBy { it.time.atZone(zone).toLocalDate() }
                .forEach { (day, list) ->
                    byDay[day]?.let { byDay[day] = it.copy(hrv = list.map { r -> r.heartRateVariabilityMillis }.average()) }
                }
        }

        val sessionMetrics = buildSet<AggregateMetric<*>> {
            if (can(DistanceRecord::class)) add(DistanceRecord.DISTANCE_TOTAL)
            if (can(ActiveCaloriesBurnedRecord::class)) add(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
        }
        val workouts = if (!can(ExerciseSessionRecord::class)) emptyList() else {
            records(ExerciseSessionRecord::class, from, to).map { s ->
                val totals = if (sessionMetrics.isEmpty()) null else client.aggregate(
                    AggregateRequest(sessionMetrics, TimeRangeFilter.between(s.startTime, s.endTime)),
                )
                PhoneWorkout(
                    id = s.metadata.id,
                    type = exerciseName(s.exerciseType),
                    start = OffsetDateTime.ofInstant(s.startTime, s.startZoneOffset ?: zone.rules.getOffset(s.startTime)),
                    end = OffsetDateTime.ofInstant(s.endTime, s.endZoneOffset ?: zone.rules.getOffset(s.endTime)),
                    distance = totals?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters,
                    energy = totals?.get(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)?.inKilocalories,
                )
            }
        }
        return byDay.values.sortedBy { it.date } to workouts
    }

    /** Today's food from LMS as one entry, replaced on every sync (same client id). */
    suspend fun writeEaten(date: LocalDate, kcal: Double, protein: Double, fat: Double, carbs: Double) {
        if (HealthPermission.getWritePermission(NutritionRecord::class) !in granted()) return
        val start = date.atStartOfDay(zone)
        val end = minOf(LocalDateTime.now(zone).atZone(zone), date.plusDays(1).atStartOfDay(zone).minusSeconds(1))
        if (!end.isAfter(start)) return
        client.insertRecords(
            listOf(
                NutritionRecord(
                    startTime = start.toInstant(),
                    startZoneOffset = start.offset,
                    endTime = end.toInstant(),
                    endZoneOffset = end.offset,
                    name = "LMS",
                    energy = Energy.kilocalories(kcal),
                    protein = Mass.grams(protein),
                    totalFat = Mass.grams(fat),
                    totalCarbohydrate = Mass.grams(carbs),
                    metadata = Metadata(clientRecordId = "lms-eaten-$date", clientRecordVersion = System.currentTimeMillis()),
                ),
            ),
        )
    }

    private suspend fun <T : Record> records(type: KClass<T>, from: Instant, to: Instant): List<T> {
        val out = mutableListOf<T>()
        var page: String? = null
        do {
            val res = client.readRecords(ReadRecordsRequest(type, TimeRangeFilter.between(from, to), pageToken = page))
            out += res.records
            page = res.pageToken
        } while (page != null)
        return out
    }

    private val ASLEEP = setOf(
        SleepSessionRecord.STAGE_TYPE_SLEEPING,
        SleepSessionRecord.STAGE_TYPE_LIGHT,
        SleepSessionRecord.STAGE_TYPE_DEEP,
        SleepSessionRecord.STAGE_TYPE_REM,
    )
}

/** Health Connect's exercise type as the name LMS matches its own exercises by. */
fun exerciseName(type: Int): String = when (type) {
    ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "Running"
    ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walking"
    ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "Hiking"
    ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "Cycling"
    ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "Swimming"
    ExerciseSessionRecord.EXERCISE_TYPE_ROWING, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "Rowing"
    ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "Elliptical"
    ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING, ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE -> "Stair climbing"
    ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "Yoga"
    ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "Pilates"
    ExerciseSessionRecord.EXERCISE_TYPE_DANCING -> "Dancing"
    ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIIT"
    ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "Strength training"
    ExerciseSessionRecord.EXERCISE_TYPE_STRETCHING -> "Stretching"
    else -> "Workout"
}
