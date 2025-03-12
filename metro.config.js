const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname, {
  resolver: {
    sourceExts: ["js", "jsx", "json", "ts", "tsx"],
    assetExts: ["db", "ttf", "png", "jpg"],
  },
});

module.exports = withNativeWind(config, { input: "./global.css" });