const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');

const SERVICE_NAME = '.CuanNotificationListenerService';

const KOTLIN_FILES = [
  'CuanNotificationBridge.kt',
  'CuanPaymentParser.kt',
  'CuanNotificationListenerService.kt',
  'CuanNotificationModule.kt',
  'CuanNotificationPackage.kt',
];

function withPaymentNotificationManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return cfg;

    if (!Array.isArray(app.service)) {
      app.service = [];
    }

    const alreadyHasService = app.service.some(
      (svc) => svc.$?.['android:name'] === SERVICE_NAME
    );

    if (!alreadyHasService) {
      app.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:label': 'CUAN Deteksi Pembayaran',
          'android:permission':
            'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
    }

    return cfg;
  });
}

function withPaymentNotificationMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('add(CuanNotificationPackage())')) {
      const marker = 'PackageList(this).packages.apply {';
      if (contents.includes(marker)) {
        contents = contents.replace(
          marker,
          `${marker}\n          add(CuanNotificationPackage())`
        );
      }
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withPaymentNotificationNativeSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const srcDir = path.join(__dirname, 'android-src');
      const pkgDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'id',
        'cuan',
        'app'
      );
      fs.mkdirSync(pkgDir, { recursive: true });

      for (const filename of KOTLIN_FILES) {
        const srcPath = path.join(srcDir, filename);
        const destPath = path.join(pkgDir, filename);
        fs.copyFileSync(srcPath, destPath);
      }

      return cfg;
    },
  ]);
}

module.exports = function withPaymentNotificationListener(config) {
  config = withPaymentNotificationManifest(config);
  config = withPaymentNotificationMainApplication(config);
  config = withPaymentNotificationNativeSources(config);
  return config;
};
