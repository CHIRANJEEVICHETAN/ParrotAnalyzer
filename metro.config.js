const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

// First get the Sentry config
let config = getSentryExpoConfig(__dirname);

// Then apply our custom config
config = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: ["js", "jsx", "json", "ts", "tsx"],
    assetExts: ["db", "ttf", "png", "jpg"],
  },
};

// Finally apply NativeWind
module.exports = withNativeWind(config, { input: "./global.css" });