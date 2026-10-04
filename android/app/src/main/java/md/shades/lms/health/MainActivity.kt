package md.shades.lms.health

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.format.DateUtils
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val dark = isSystemInDarkTheme()
            val colors = when {
                Build.VERSION.SDK_INT >= 31 && dark -> dynamicDarkColorScheme(this)
                Build.VERSION.SDK_INT >= 31 -> dynamicLightColorScheme(this)
                dark -> darkColorScheme()
                else -> lightColorScheme()
            }
            MaterialTheme(colorScheme = colors) {
                Surface(Modifier.fillMaxSize()) { Screen() }
            }
        }
    }
}

@Composable
private fun Screen() {
    val context = LocalContext.current
    val settings = remember { Settings(context) }
    val scope = rememberCoroutineScope()
    val sdk = remember { HealthConnectClient.getSdkStatus(context) }

    var server by remember { mutableStateOf(settings.server) }
    var key by remember { mutableStateOf(settings.key) }
    var auto by remember { mutableStateOf(settings.autoSync) }
    var granted by remember { mutableStateOf<Set<String>>(emptySet()) }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf(settings.lastResult) }
    var lastSync by remember { mutableStateOf(settings.lastSync) }

    val reader = remember(sdk) {
        if (sdk == HealthConnectClient.SDK_AVAILABLE) HealthReader(HealthConnectClient.getOrCreate(context)) else null
    }
    val ask = rememberLauncherForActivityResult(PermissionController.createRequestPermissionResultContract()) {
        granted = it
    }
    LaunchedEffect(reader) { reader?.let { granted = it.granted() } }

    val reads = granted.count { it.contains(".READ_") && it != HealthReader.BACKGROUND }

    Column(
        Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("LMS Health", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text(
            "Sends your steps, sleep, heart rate, weight and workouts from Health Connect to LMS, " +
                "and puts what you ate in LMS back into Health Connect.",
            style = MaterialTheme.typography.bodyMedium,
        )

        Section("1. Your LMS") {
            OutlinedTextField(
                value = server,
                onValueChange = { server = it; settings.server = it },
                label = { Text("Server") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = key,
                onValueChange = { key = it; settings.key = it },
                label = { Text("Access key") },
                supportingText = { Text("In LMS: Settings → Claude access → New key (Kitchen).") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Section("2. Health Connect") {
            when (sdk) {
                HealthConnectClient.SDK_AVAILABLE -> {
                    Text(
                        if (reads == 0) "Not connected yet." else "Reading $reads kinds of data.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Button(onClick = { ask.launch(HealthReader.PERMISSIONS) }) {
                        Text(if (reads == 0) "Connect Health Connect" else "Choose what LMS reads")
                    }
                }
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                    Text("Health Connect needs an update.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { openStore(context) }) { Text("Update Health Connect") }
                }
                else -> {
                    Text("Health Connect isn't on this phone.", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { openStore(context) }) { Text("Get Health Connect") }
                }
            }
        }

        Section("3. Sync") {
            Button(
                enabled = !busy && reader != null && key.isNotBlank() && reads > 0,
                onClick = {
                    busy = true
                    scope.launch {
                        result = try {
                            withContext(Dispatchers.IO) { Sync.run(context) }
                        } catch (e: LmsClient.HttpError) {
                            if (e.status == 401 || e.status == 403) "LMS didn't accept the key." else e.message.orEmpty()
                        } catch (e: Exception) {
                            e.message ?: e.toString()
                        }
                        settings.lastResult = result
                        lastSync = settings.lastSync
                        busy = false
                    }
                },
            ) { Text(if (busy) "Syncing…" else "Sync now") }
            if (lastSync > 0) {
                Text(
                    "Last sync ${DateUtils.getRelativeTimeSpanString(lastSync)}",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (result.isNotBlank()) Text(result, style = MaterialTheme.typography.bodySmall)

            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Sync every 3 hours", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        if (HealthReader.BACKGROUND in granted) "Allowed in the background"
                        else "Needs \"Access data in the background\" in Health Connect",
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
                Switch(
                    checked = auto,
                    enabled = key.isNotBlank() && reads > 0,
                    onCheckedChange = {
                        auto = it
                        settings.autoSync = it
                        SyncWorker.schedule(context, it)
                    },
                )
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        content()
    }
}

private fun openStore(context: android.content.Context) {
    val pkg = "com.google.android.apps.healthdata"
    context.startActivity(
        Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg&url=healthconnect%3A%2F%2Fonboarding"))
            .setPackage("com.android.vending")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}
