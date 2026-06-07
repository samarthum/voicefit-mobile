module.exports = function (api) {
  api.cache(true);
  return {
    // `babel-preset-expo` (SDK 54) automatically adds `react-native-worklets/plugin`
    // when react-native-worklets is installed, so it must NOT be listed again here —
    // adding the worklets/reanimated plugin twice double-transforms worklets and
    // breaks Reanimated (and anything built on it, e.g. @gorhom/bottom-sheet) on native.
    presets: ['babel-preset-expo'],
  };
};
