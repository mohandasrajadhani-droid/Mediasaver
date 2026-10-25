# MediaSaver — Stage 1

An Android app (React Native + Expo SDK 58 + TypeScript) for downloading and managing
video and audio files **from sources that permit it**.

## What's in Stage 1

| Feature | Status |
|---|---|
| Home screen: link field, Paste, Clear, Check link | Done · screen-tested |
| Link validation (no network): invalid, http, streaming playlists, blocked platforms | Done · unit-tested |
| YouTube / Instagram / Netflix / Spotify etc. → clear "not permitted" message + "Open in official app" | Done · tested |
| Direct file links (.mp4, .mp3, .m4a…): server check for type, size, login walls | Done · unit-tested with fake server |
| Internet Archive items: choose MP4 or MP3 and quality from files the Archive provides | Done · unit-tested with sample data |
| "I own this / have permission" confirmation for direct links | Done · screen-tested |
| Download manager: progress, bytes, pause/resume, cancel, retry | Written · needs on-device test |
| Duplicate detection (already downloading / already saved → ask) | Done · rules unit-tested |
| Checks before download: offline, not enough storage (200 MB safety margin) | Done · rules unit-tested |
| Interrupted downloads after app restart → marked failed, Retry available | Done · unit-tested |
| Downloads library: name, size, format, status, play, share, save-to-folder, delete | Written · needs on-device test |
| Video player (expo-video) and audio player (expo-audio) | Written · needs on-device test |
| Light / dark / match-phone theme | Written · needs on-device test |

**Verified in the build environment:** TypeScript strict type-check passes, 45 automated tests pass,
and the Android JavaScript bundle compiles (`expo export --platform android`).
**Not yet verified:** running on a real phone — that's your first test (steps below).

## Architecture

```
Paste link ──► routeUrl()          (pure rules, no network)
                 ├─ invalid / blocked / unsupported ─► message (+ official app button)
                 ├─ archive.org ─► checkArchiveItem() ─► MP4/MP3 options from metadata API
                 └─ direct link ─► checkDirectUrl()   ─► HEAD request → type/size/login check
                                         │
                          SourceResult card (format, quality, permission)
                                         │
                      downloadManager.startDownload()
                       duplicates? offline? storage? ─► friendly alert
                                         │
             File.createDownloadTask → cache/partial/<id>.part (progress)
                                         │ on success
                         documents/downloads/<name>.mp4  ─► Library (zustand + AsyncStorage)
                                         │
                Downloads tab: play · share · save to folder · delete
```

```
src/
  app/                       ← screens (Expo Router: every file is a route)
    _layout.tsx              root stack + theme
    (tabs)/_layout.tsx       bottom tabs: Get, Downloads, Settings
    (tabs)/index.tsx         Home
    (tabs)/downloads.tsx     Library
    (tabs)/settings.tsx      Theme + responsible-use note
    player/[id].tsx          Video/audio player
  sources/                   ← "Is this link allowed, and what does it offer?"
    urlRules.ts              URL parsing + blocked platforms + routing
    directMedia.ts           direct file check (HEAD / 1-byte GET fallback)
    internetArchive.ts       archive.org metadata → MP4/MP3 options
    mediaTypes.ts            extensions ↔ MIME types
    checkSource.ts           single entry point used by the UI
  download/
    downloadManager.ts       start / pause / resume / cancel / retry / delete
    fileStore.ts             all file-system access (expo-file-system)
    rules.ts                 pure rules: duplicates, storage, error messages
  library/                   persisted list of downloads (zustand + AsyncStorage)
  components/                ui.tsx, SourceResult.tsx, DownloadRow.tsx
  theme/ThemeProvider.tsx    light/dark colours
  utils/format.ts            bytes, durations, safe file names
__tests__/                   45 tests (rules, sources, formatting, Home screen)
```

## Where files are saved

Downloads go to the app's own storage (`documents/downloads`), which needs **no storage permission**
and works in Expo Go. To put a file in a normal phone folder, tap the **folder icon** on a download and
pick a folder (e.g. *Download* or *Music*) — Android's folder picker copies it there and it then shows
up in the Files app and other players.

## Run it on your phone (Expo Go)

You need Node.js 20 LTS or newer on your computer (Deepin Linux or Windows both work).

```bash
unzip mediasaver.zip && cd mediasaver
npm install
npx expo start
```

1. Install **Expo Go** from the Play Store on your phone (it must support SDK 58).
2. Phone and computer on the same Wi-Fi. Scan the QR code in the terminal with Expo Go.
   If the network blocks it, use `npx expo start --tunnel`.

### Test links to try
- Blocked: any YouTube link → should explain and offer *Open in YouTube*.
- Internet Archive: `https://archive.org/details/Popeye_forPresident` → choose MP4 or MP3 quality.
- Direct file: any public `https://…/file.mp3` or `.mp4` link you have rights to.

## Build an installable APK

**Automatic (GitHub):** every push to `main` builds the APK with GitHub Actions
(`.github/workflows/build-apk.yml`). When it finishes (about 15–25 min), open the repo's
**Releases** page on your phone and tap **MediaSaver.apk**. You can also start a build from the
**Actions** tab → *Build Android APK* → *Run workflow*.

**Manual (EAS cloud):**

```bash
npm install -g eas-cli        # or use: npx eas-cli@latest
eas login                     # free Expo account
eas build -p android --profile preview
```

EAS builds in the cloud and gives you a link to download the `.apk` — open it on the phone to install
(allow "Install unknown apps" for your browser when asked). Change `android.package` in `app.json`
(currently `com.mediasaver.app`) to your own before publishing.

## Expo Go vs development build

Everything in Stage 1 runs in **Expo Go**. A development build (`eas build --profile development`)
will be needed later only for:
- downloads that keep running after the app is closed (Android foreground service / notifications),
- writing straight into the shared Movies/Music media library without the folder picker.

## Tests and checks

```bash
npm test             # 45 tests
npm run typecheck    # TypeScript strict
```

## Compliance

- No YouTube (or other platform) extraction, no DRM/login/paywall bypass, no format conversion.
- Only formats a source already provides are offered.
- Direct links require the user to confirm ownership/permission.
- No API keys or secrets in the app.

## Next stages (proposed)
2. On-device QA fixes, download notifications, background downloads (dev build).
3. Import your own files from the phone into the library; search and sort.
4. More permitted sources (e.g. Wikimedia Commons), app icon and splash.
