const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports wa-sqlite.wasm. Metro treats unknown
// extensions as source and fails to parse it, which breaks `expo export` for
// every platform — including the android/ios bundles that `eas update` needs.
// Registering wasm as an asset lets the export succeed.
//
// This makes the web bundle *build*; it does not make SQLite *run* on web,
// which additionally needs COOP/COEP headers on the document. See CLAUDE.md.
config.resolver.assetExts.push('wasm');

module.exports = config;
