package md.shades.lms.health

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.OffsetDateTime

class PayloadTest {
    @Test
    fun `sends days of totals and workouts the way LMS reads them`() {
        val json = Payload.json(
            listOf(
                DayValues("2026-10-04", steps = 8543, distance = 6210.4, activeEnergy = 420.6, restingEnergy = 1550.2, sleep = 412, weight = 78.44, restingHeartRate = 58),
                DayValues("2026-10-05"), // nothing recorded: left out
            ),
            listOf(
                PhoneWorkout(
                    id = "hc-1",
                    type = "Running",
                    start = OffsetDateTime.parse("2026-10-04T08:00:00+03:00"),
                    end = OffsetDateTime.parse("2026-10-04T08:31:00+03:00"),
                    distance = 5200.0,
                    energy = 410.4,
                ),
            ),
        )
        assertEquals(
            "{\"source\":\"google\",\"days\":[{\"date\":\"2026-10-04\",\"steps\":8543,\"distance\":6210,\"activeEnergy\":421,\"restingEnergy\":1550," +
                "\"restingHeartRate\":58,\"sleep\":412,\"weight\":78.4}]," +
                "\"workouts\":[{\"id\":\"hc-1\",\"type\":\"Running\",\"start\":\"2026-10-04T08:00:00+03:00\",\"end\":\"2026-10-04T08:31:00+03:00\",\"distance\":5200,\"energy\":410}]}",
            json,
        )
    }

    @Test
    fun `escapes names and reads numbers back`() {
        assertEquals("\"Yoga \\\"flow\\\"\\n\"", Payload.quote("Yoga \"flow\"\n"))
        assertEquals(1240.0, Payload.number("{\"date\":\"2026-10-04\",\"eatenKcal\":1240,\"protein\":61.5}", "eatenKcal"))
        assertEquals(61.5, Payload.number("{\"protein\":61.5}", "protein"))
        assertNull(Payload.number("{}", "eatenKcal"))
    }
}
