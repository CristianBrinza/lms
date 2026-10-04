package md.shades.lms.health

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** LMS's API with the person's access key: send the health days, read what was eaten today. */
class LmsClient(private val server: String, private val key: String) {
    class HttpError(val status: Int, body: String) : IOException("LMS answered $status: ${body.take(200)}")

    fun sendHealth(json: String): String = request("POST", "/api/training/health", json)

    fun energyToday(date: String): String = request("GET", "/api/training/energy/today?today=$date", null)

    private fun request(method: String, path: String, body: String?): String {
        val conn = URL(server + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.setRequestProperty("Authorization", "Bearer $key")
            conn.setRequestProperty("Accept", "application/json")
            if (body != null) {
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
            }
            val status = conn.responseCode
            val text = (if (status < 400) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status >= 400) throw HttpError(status, text)
            return text
        } finally {
            conn.disconnect()
        }
    }
}
