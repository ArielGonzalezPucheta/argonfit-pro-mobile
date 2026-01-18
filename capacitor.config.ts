import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.argonfit.pro',
  appName: 'ArgonFit Pro',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
