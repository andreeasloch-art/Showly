# Showly als native App veröffentlichen

Dieses Projekt enthält einen **Capacitor**-Wrapper, damit du Showly als iOS- und Android-App im App Store und Google Play veröffentlichen kannst. Außerdem ist bereits ein Web-App-Manifest vorhanden, damit die Seite im Browser als installierbare Progressive Web App (PWA) funktioniert.

## Grundidee

Die native App lädt deine veröffentlichte Lovable-Web-App (`https://app-maker-magic-588.lovable.app`) im nativen Shell-WebView. Inhalts-Updates erscheinen sofort, ohne dass du ein neues App-Binary einreichen musst. Nur wenn du native Plugins änderst (Kamera, Push, etc.), musst du die App neu bauen und erneut einreichen.

## Voraussetzungen

1. **Apple Developer Program** – ca. 99 €/Jahr (für iOS).
2. **Google Play Console** – 25 $ einmalig (für Android).
3. **macOS + Xcode** für den iOS-Build.
4. **Android Studio** für den Android-Build.
5. **Node/Bun** und dieses Repository lokal geklont.

## Schritt-für-Schritt

### 1. Abhängigkeiten installieren

```bash
bun install
```

### 2. App-Name / Bundle-ID anpassen (optional)

Öffne `capacitor.config.ts` und passe `appId` und `appName` an, bevor du die nativen Plattformen erzeugst.

### 3. Native Plattformen erzeugen

```bash
bun cap:add
```

Das legt die Ordner `ios/` und `android/` an.

### 4. Icons & Splash-Screen für native Apps generieren

Quellbilder liegen unter `assets/icon.png` und `assets/splash.png`. Ersetze sie bei Bedarf durch deine eigenen Designs (mindestens 1024×1024 für das Icon, 1280×1280 oder größer für den Splash).

```bash
bun cap:assets
```

Das erzeugt alle benötigten Größen und kopiert sie in die `ios/`- und `android/`-Ordner.

### 5. In native Projekte synchronisieren

```bash
bun cap:sync
```

Dies kopiert Web-Assets, Icons und Splash-Screens in die nativen Projekte.

### 6. In Xcode / Android Studio öffnen

```bash
bun cap:open:ios
bun cap:open:android
```

Dort folgst du den jeweiligen Signing- und Release-Anleitungen:

- **iOS:** Xcode → Product → Archive → Distribute App → App Store Connect.
- **Android:** Android Studio → Build → Generate Signed Bundle / APK → Release AAB.

### 7. Store-Einreichung

Bereite in App Store Connect und Google Play Console vor:

- App-Name, Untertitel, Kurzbeschreibung, Vollbeschreibung (mindestens auf Deutsch, Englisch und Spanisch).
- Screenshots in den geforderten Größen.
- Datenschutzerklärung (deine Rechtstexte aus der App verwenden).
- Kontakt-E-Mail, Altersfreigabe, Kategorie (z. B. Unterhaltung / Lifestyle).

## Hinweise

- Wenn du die App lieber **lokal gebundelt** (offline-fähig) haben willst, entferne `server.url` aus `capacitor.config.ts` und setze `webDir` auf den Vite-Build-Output.
- Für Push-Benachrichtigungen oder Kamera-Zugriff installierst du die entsprechenden Capacitor-Plugins (`@capacitor/push-notifications`, `@capacitor/camera`) und fügst die Berechtigungen in `ios/App/App/Info.plist` bzw. `android/app/src/main/AndroidManifest.xml` hinzu.
- Bei Fragen zu Capacitor: https://capacitorjs.com/docs

