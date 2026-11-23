package app.cravingcrusher.phone

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.net.Uri
import android.os.Build
import android.webkit.WebView
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Energy
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/**
 * Health Connect for the page (Matt, Nov 22 2026; APP_PORTS/shared/src/health.ts): READ ONLY — recorded workouts
 * (exercise sessions) and the active calories burned during each. Nothing is written (except the test build's
 * test workout, CC_HEALTH_TEST=1) and nothing leaves the phone: Health Connect is on the phone, and the app has no internet access.
 *
 * The page calls CCAndroid.health(op, argJson, id); the answer comes back as window.__ccHealthDone(id, json).
 */
class HealthBridge(private val activity: Activity, private val web: WebView) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val exercise = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
    private val calories = HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
    private val debug = (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    private val contract = PermissionController.createRequestPermissionResultContract()
    private var pending: CompletableDeferred<Set<String>>? = null

    fun call(op: String, arg: String, id: String) {
        scope.launch {
            val out = JSONObject()
            try {
                val value: Any? = when (op) {
                    "status" -> status()
                    "authorize" -> authorize()
                    "workouts" -> workouts(JSONObject(arg.ifBlank { "{}" }).optLong("since", 0L))
                    "getApp" -> { getApp(); true }
                    "insertTest" -> if (debug) insertTest(JSONObject(arg.ifBlank { "{}" })) else throw IllegalStateException("Not in this build")
                    else -> throw IllegalArgumentException("Not understood: $op")
                }
                out.put("ok", true).put("value", value ?: JSONObject.NULL)
            } catch (e: Throwable) {
                out.put("ok", false).put("error", e.message ?: e.javaClass.simpleName)
            }
            web.evaluateJavascript("window.__ccHealthDone && window.__ccHealthDone(${JSONObject.quote(id)}, ${JSONObject.quote(out.toString())})", null)
        }
    }

    /** "ok", or "needs-app" (install or update Health Connect from the Play Store), or "unavailable" — Health Connect
     *  runs on Android 9 and newer only, so an Android 8 phone is never sent to the Play Store for it */
    private fun status(): String = when (HealthConnectClient.getSdkStatus(activity)) {
        HealthConnectClient.SDK_AVAILABLE -> "ok"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "needs-app"
        else -> if (Build.VERSION.SDK_INT in 28..33) "needs-app" else "unavailable"
    }

    private fun client() = HealthConnectClient.getOrCreate(activity)

    /** Health Connect's own permission screen; true when reading workouts is allowed (calories are a bonus) */
    private suspend fun authorize(): Boolean {
        val want = setOf(exercise, calories)
        val have = client().permissionController.getGrantedPermissions()
        if (have.containsAll(want)) return true
        val d = CompletableDeferred<Set<String>>()
        pending = d
        if (Build.VERSION.SDK_INT >= 34) {
            // Android 14 and newer: health permissions are Android's own runtime permissions. The library's intent is
            // one only an androidx ComponentActivity answers, so this plain Activity asks Android directly
            // (startActivityForResult with it failed with "No Activity found" — review, Nov 22 2026)
            activity.requestPermissions(want.toTypedArray(), REQUEST)
        } else {
            activity.startActivityForResult(contract.createIntent(activity, want), REQUEST)
        }
        return d.await().contains(exercise) || client().permissionController.getGrantedPermissions().contains(exercise)
    }

    /** MainActivity hands the permission screen's answer here (Android 13 and older: Health Connect's own screen) */
    fun onResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != REQUEST) return false
        pending?.complete(contract.parseResult(resultCode, data))
        pending = null
        return true
    }

    /** … and Android's own permission prompt's answer (Android 14 and newer) */
    fun onPermissions(requestCode: Int, permissions: Array<out String>, results: IntArray): Boolean {
        if (requestCode != REQUEST) return false
        val granted = permissions.filterIndexed { i, _ -> results.getOrNull(i) == android.content.pm.PackageManager.PERMISSION_GRANTED }.toSet()
        pending?.complete(granted)
        pending = null
        return true
    }

    private suspend fun workouts(since: Long): JSONArray = withContext(Dispatchers.IO) {
        val c = client()
        val granted = c.permissionController.getGrantedPermissions()
        if (!granted.contains(exercise)) throw SecurityException("Health Connect isn't sharing your workouts with Craving Crusher. Allow Exercise in Health Connect → App permissions.")
        val out = JSONArray()
        var token: String? = null
        do {
            val page = c.readRecords(ReadRecordsRequest(ExerciseSessionRecord::class, TimeRangeFilter.after(Instant.ofEpochMilli(since)), pageToken = token))
            for (s in page.records) {
                var problem: String? = null
                val kcal = if (granted.contains(calories)) try { caloriesDuring(c, s) } catch (e: Exception) { problem = e.message; null } else null
                val w = JSONObject()
                    .put("id", s.metadata.id)
                    .put("what", nameOf(s))
                    .put("startMs", s.startTime.toEpochMilli())
                    .put("endMs", s.endTime.toEpochMilli())
                    .put("calories", kcal ?: JSONObject.NULL)
                if (debug && problem != null) w.put("caloriesProblem", problem)
                out.put(w)
            }
            token = page.pageToken
        } while (!token.isNullOrEmpty())
        out
    }

    /** the active calories burned during a workout: Health Connect's own total, else the calorie records in it added up */
    private suspend fun caloriesDuring(c: HealthConnectClient, s: ExerciseSessionRecord): Double? {
        val range = TimeRangeFilter.between(s.startTime, s.endTime)
        val total = c.aggregate(AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), range))[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
        if (total != null && total > 0) return total
        val sum = c.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, range)).records.sumOf { it.energy.inKilocalories }
        return if (sum > 0) sum else null
    }

    /** Health Connect's kind of workout, as Craving Crusher's quick picks say it */
    private fun nameOf(s: ExerciseSessionRecord): String = when (s.exerciseType) {
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walk"
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "Run"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING, ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "Bike"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL, ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "Swim"
        ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "Yoga"
        ExerciseSessionRecord.EXERCISE_TYPE_HIKING -> "Hike"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING, ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "Strength training"
        ExerciseSessionRecord.EXERCISE_TYPE_DANCING -> "Dance"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "Elliptical"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING, ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "Rowing"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIIT"
        ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "Pilates"
        ExerciseSessionRecord.EXERCISE_TYPE_TENNIS -> "Tennis"
        ExerciseSessionRecord.EXERCISE_TYPE_BASKETBALL -> "Basketball"
        ExerciseSessionRecord.EXERCISE_TYPE_SOCCER -> "Soccer"
        ExerciseSessionRecord.EXERCISE_TYPE_GOLF -> "Golf"
        ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING, ExerciseSessionRecord.EXERCISE_TYPE_STAIR_CLIMBING_MACHINE -> "Stairs"
        ExerciseSessionRecord.EXERCISE_TYPE_CALISTHENICS -> "Calisthenics"
        ExerciseSessionRecord.EXERCISE_TYPE_BOOT_CAMP -> "Boot camp"
        else -> s.title?.trim()?.takeIf { it.isNotEmpty() }?.take(120) ?: "Workout"
    }

    /** the Play Store's Health Connect page (to install or update it) */
    private fun getApp() {
        val pkg = "com.google.android.apps.healthdata"
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg&url=healthconnect%3A%2F%2Fonboarding")).setPackage("com.android.vending"))
        } catch (e: ActivityNotFoundException) {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")))
        }
    }

    /** TEST BUILDS ONLY (debug, built with CC_HEALTH_TEST=1 and the write permissions granted by adb): put a test
     *  workout in Health Connect, to try the import on the emulator */
    private suspend fun insertTest(a: JSONObject): String = withContext(Dispatchers.IO) {
        val start = Instant.ofEpochMilli(a.optLong("startMs", System.currentTimeMillis() - 3_600_000L))
        val end = start.plus(Duration.ofMinutes(a.optLong("minutes", 40L)))
        val zone = ZoneOffset.systemDefault().rules.getOffset(start)
        val session = ExerciseSessionRecord(start, zone, end, zone, Metadata.manualEntry(), ExerciseSessionRecord.EXERCISE_TYPE_WALKING, "Test walk")
        val kcal = ActiveCaloriesBurnedRecord(start, zone, end, zone, Energy.kilocalories(a.optDouble("calories", 200.0)), Metadata.manualEntry())
        client().insertRecords(listOf<Record>(session, kcal)).recordIdsList.first()
    }

    companion object { const val REQUEST = 4021 }
}
