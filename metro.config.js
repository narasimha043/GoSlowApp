const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// Remove mp3 from assetExts and add to sourceExts
const assetExts = defaultConfig.resolver.assetExts.filter(ext => ext !== 'mp3');
const sourceExts = [...defaultConfig.resolver.sourceExts, 'mp3'];

const config = {
  resolver: {
    extraNodeModules: {
      dgram: require.resolve('react-native-udp'),
    },
    assetExts,
    sourceExts,
  },
  watchFolders: [
    path.resolve(__dirname, 'node_modules'),
  ],
};

module.exports = mergeConfig(defaultConfig, config);
