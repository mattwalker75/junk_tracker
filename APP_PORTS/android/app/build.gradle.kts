// The version, build number and app id come from BUILD_APP.sh (-PccVersion=… -PccVersionCode=… -PccAppId=…).
// A release build is signed with your own key: CC_KEYSTORE, CC_KEYSTORE_PASSWORD, CC_KEY_ALIAS, CC_KEY_PASSWORD.
plugins {
    id("com.android.application")
}

val ccVersion = (findProperty("ccVersion") as String?) ?: "1.0"
val ccVersionCode = ((findProperty("ccVersionCode") as String?) ?: "1").toInt()
val ccAppId = (findProperty("ccAppId") as String?) ?: "app.cravingcrusher.phone"

android {
    namespace = "app.cravingcrusher.phone"
    compileSdk = 36

    defaultConfig {
        applicationId = ccAppId
        minSdk = 26
        targetSdk = 36
        versionCode = ccVersionCode
        versionName = ccVersion
    }

    signingConfigs {
        create("release") {
            val keystore = System.getenv("CC_KEYSTORE")
            if (!keystore.isNullOrBlank()) {
                storeFile = file(keystore)
                storePassword = System.getenv("CC_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("CC_KEY_ALIAS")
                keyPassword = System.getenv("CC_KEY_PASSWORD") ?: System.getenv("CC_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (!System.getenv("CC_KEYSTORE").isNullOrBlank()) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
