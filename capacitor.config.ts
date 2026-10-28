import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.ec844bae03bb4129acaf841874877e9f',
  appName: 'scardtopia',
  webDir: 'dist',
  // Development only. Remove server before creating a store release.
  server: {
    url: 'https://ec844bae-03bb-4129-acaf-841874877e9f.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
