# Archivist

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Mobile (Android / iOS)

The mobile apps are built with [Capacitor](https://capacitorjs.com), which wraps the web build in `dist/` inside a native WebView. The native projects are in `android/` and `ios/`.

```bash
bun run build:mobile   # build dist/ (with Supabase config from .env inlined) and copy it into android/ and ios/
bun run android        # build + open the project in Android Studio
bun run ios            # build + open the project in Xcode (macOS only)
```

Requirements: Android Studio (or the Android SDK + JDK 21) for Android, and a Mac with Xcode for iOS.
Run `bun run build:mobile` again after every frontend change before rebuilding the native app.

## Releases (Windows and Android)

Both builds need `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: the desktop app reads it from inside the installer, and the Android build inlines it.

```bash
bun run dist:win       # release/Archivist-Setup-<version>.exe (NSIS installer, x64)
bun run dist:android   # android/app/build/outputs/apk/release/app-release.apk (signed)
```

Bump `version` in `package.json` and `versionName`/`versionCode` in `android/app/build.gradle` before each release.

The Android release is signed with the key in `android/keystore.properties` (not in git; it has `storeFile`, `storePassword`, `keyAlias` and `keyPassword`). Keep the keystore and its password backed up: Android only installs an update when it's signed with the same key. Without `keystore.properties` the release APK is built unsigned.
