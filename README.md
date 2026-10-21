# bun-react-tailwind-template

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
