# Craving Crusher for Android

```bash
./BUILD_APP.sh --check          # what's needed, and what to install for anything missing
./BUILD_APP.sh --install-tools  # install what's missing with Homebrew (Java 21, Android's tools, the emulator)
./BUILD_APP.sh                  # build it → BUILD/CravingCrusher-<version>.apk
./BUILD_APP.sh --run            # build it and open it in the Android Emulator on this Mac
./BUILD_APP.sh --install        # build it and put it on the Android phone plugged in (USB debugging on)
./BUILD_APP.sh --release        # the Play Store build, signed with your key (CC_KEYSTORE, …)
```

At the end the script says where the app is and how to try it. See `../README.md` for how the app works.

**Needs:** Java 17–25 (a JDK), the Android SDK with Android 16 (API 36) and its build tools, and Node.js
22.12+; for `--run` the Android Emulator and an Android 36 phone image. The easiest way to get them all is
Android Studio (https://developer.android.com/studio, opened once); or `./BUILD_APP.sh --install-tools`
(Homebrew). The script finds Java and the SDK in the usual places, or set `JAVA_HOME` / `ANDROID_HOME`.

| File | |
|---|---|
| `settings.gradle.kts`, `build.gradle.kts`, `app/build.gradle.kts` | the Gradle build (opens in Android Studio) |
| `gradlew`, `gradle/wrapper/` | Gradle itself, fetched on first use (9.8.2, checked against its checksum) |
| `app/src/main/java/app/cravingcrusher/phone/MainActivity.java` | the screen: the page, its files (https://appassets.androidplatform.net/…) and the log file |
| `app/src/main/res/` | the name, colours, theme and icon — `drawable-nodpi/cc_icon.png` is written by `scripts/make_icons.mjs`, don't edit it |
| `app/src/main/assets/web/` | the built page (made by the build, not committed) |
| `BUILD/` | what the builds make (not committed) |

- The app uses only Android itself: no extra libraries. Android's build plugin is 9.5.1.
- The app's id is `app.cravingcrusher.phone` (`CC_APP_ID=…` to change it). Once an app is on the Play Store
  its id and its signing key can never change: make the key once and keep it safe, outside the repo.
- Testing: the debug build can be inspected from Chrome on the Mac (chrome://inspect).
- The icon's background colour is `cc_icon_bg` in `res/values/colors.xml`: keep it the same as the first
  `<rect>` in `Docs/icon/icon.svg` if the icon changes colour.
