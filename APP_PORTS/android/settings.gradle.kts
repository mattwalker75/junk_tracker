// Craving Crusher for Android (built by BUILD_APP.sh, or open this folder in Android Studio)
pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "CravingCrusher"
include(":app")
