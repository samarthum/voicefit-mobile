const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds the activity-alias Android 14+ uses to show "what does this app do
 * with health data" from the Health Connect permission screen. The
 * react-native-health-connect plugin only adds the pre-14 rationale
 * intent-filter, so this covers the newer flow.
 */
module.exports = function withHealthConnectPermissionUsage(config) {
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
};
