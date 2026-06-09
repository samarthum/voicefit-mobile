import * as Haptics from "expo-haptics";

// Centralized haptics. No-op on web. Safe to call anywhere (fire-and-forget).
const enabled = process.env.EXPO_OS !== "web";

export const haptic = {
  /** light tap — taps, toggles, selection of a control */
  tap: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  /** medium press — primary button / mic press */
  press: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  /** success notification — save/complete */
  success: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  /** warning notification */
  warning: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
  /** error notification — failed action */
  error: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); },
  /** selection tick — picker/segment changes */
  selection: () => { if (enabled) Haptics.selectionAsync(); },
};
