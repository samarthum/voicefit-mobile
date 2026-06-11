const { withAndroidManifest, withMainActivity } = require("expo/config-plugins");

/**
 * Android pieces of the Health Connect integration that the
 * react-native-health-connect plugin doesn't cover:
 *
 * 1. MainActivity must register the permission delegate in onCreate —
 *    requestPermission() launches an ActivityResult flow through a lateinit
 *    launcher, and without this registration the native side throws inside
 *    a coroutine and hard-crashes the app.
 * 2. The Android 14+ activity-alias that shows "what does this app do with
 *    health data" from the Health Connect permission screen (the library
 *    plugin only adds the pre-14 rationale intent-filter).
 */

const DELEGATE_IMPORT =
  "import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate";
const DELEGATE_CALL = "HealthConnectPermissionDelegate.setPermissionDelegate(this)";

function withPermissionDelegate(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== "kt") {
      throw new Error(
        "with-health-connect-android: expected a Kotlin MainActivity; update the plugin for Java."
      );
    }
    let contents = config.modResults.contents;

    if (!contents.includes(DELEGATE_IMPORT)) {
      if (!/^package .*$/m.test(contents)) {
        throw new Error(
          "with-health-connect-android: could not find package declaration in MainActivity."
        );
      }
      contents = contents.replace(/^(package .*)$/m, `$1\n\n${DELEGATE_IMPORT}`);
    }

    if (!contents.includes(DELEGATE_CALL)) {
      const onCreateAnchor = /(super\.onCreate\([^)]*\))/;
      if (!onCreateAnchor.test(contents)) {
        throw new Error(
          "with-health-connect-android: could not find super.onCreate(...) in MainActivity."
        );
      }
      contents = contents.replace(onCreateAnchor, `$1\n    ${DELEGATE_CALL}`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

function withPermissionUsageAlias(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    const aliases = application["activity-alias"] ?? [];
    application["activity-alias"] = aliases;

    const alreadyAdded = aliases.some(
      (alias) => alias.$?.["android:name"] === "ViewPermissionUsageActivity"
    );
    if (!alreadyAdded) {
      aliases.push({
        $: {
          "android:name": "ViewPermissionUsageActivity",
          "android:exported": "true",
          "android:targetActivity": ".MainActivity",
          "android:permission": "android.permission.START_VIEW_PERMISSION_USAGE",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.VIEW_PERMISSION_USAGE" } },
            ],
            category: [
              { $: { "android:name": "android.intent.category.HEALTH_PERMISSIONS" } },
            ],
          },
        ],
      });
    }

    return config;
  });
}

module.exports = function withHealthConnectAndroid(config) {
  return withPermissionUsageAlias(withPermissionDelegate(config));
};
