export default ({ config }) => ({
  ...config,
  name: 'EduConnect',
  slug: 'educonnect-mobile',
  scheme: 'educonnect',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: false,
  android: {
    ...config.android,
    package: 'com.educonnect.edustaff',
    versionCode: 1,
    permissions: ['INTERNET'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sharing',
    'expo-status-bar',
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 35,
        },
      },
    ],
  ],
})
