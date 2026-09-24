import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.showly.app",
  appName: "Showly",
  webDir: "dist",
  // Load the published Lovable web app inside the native shell. This keeps
  // content updates automatic; only native plugin changes need a store resubmission.
  server: {
    url: "https://app-maker-magic-588.lovable.app",
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0F172A",
      androidSplashResourceName: "splash",
      iosSplashResourceName: "splash",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0F172A",
    },
  },
  android: {
    backgroundColor: "#0F172A",
  },
  ios: {
    backgroundColor: "#0F172A",
    contentInset: "always",
  },
};

export default config;
