const { withDangerousMod, withAndroidManifest } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withXrayVpnFix = (config) => {
  // 1) cleartext via manifest (app.json android.usesCleartextTraffic is not a valid schema field)
  config = withAndroidManifest(config, (cfg) => {
    try {
      const app = cfg.modResults.manifest.application?.[0];
      if (app && app.$) app.$['android:usesCleartextTraffic'] = 'true';
    } catch (e) {
      console.warn('[withXrayVpnFix] manifest patch failed:', e.message);
    }
    return cfg;
  });

  // 2) gradle fixes at prebuild time
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const modRoot = cfg.modRequest.projectRoot;
      const gradlePath = path.join(modRoot, 'node_modules', 'expo-xray-vpn', 'android', 'build.gradle');
      try {
        if (fs.existsSync(gradlePath)) {
          let t = fs.readFileSync(gradlePath, 'utf8');
          if (t.includes('lintOptions')) {
            t = t.replace(/lintOptions\s*\{/, 'lint {');
            console.log('[withXrayVpnFix] patched lintOptions -> lint');
          }
          // Canonical fix for Gradle implicit-dependency errors:
          // declare the extracted jar as builtBy extractXrayAar so EVERY
          // consumer task (desugar, collectDependencies, dex, ...) waits for it.
          if (t.includes('implementation files(classesJar)') && !t.includes('builtBy')) {
            t = t.replace(
              'implementation files(classesJar)',
              'implementation files(classesJar) { builtBy extractXrayAar }'
            );
            console.log('[withXrayVpnFix] wired builtBy extractXrayAar');
          }
          fs.writeFileSync(gradlePath, t);
        }
      } catch (e) {
        console.warn('[withXrayVpnFix] module gradle patch failed:', e.message);
      }
      // 3) wire libxray extraction before :app desugar (Gradle 9 implicit-deps check)
      try {
        const appGradle = path.join(modRoot, 'android', 'app', 'build.gradle');
        if (fs.existsSync(appGradle)) {
          let g = fs.readFileSync(appGradle, 'utf8');
          if (!g.includes('withXrayVpnFix')) {
            g += `\n// withXrayVpnFix: ensure libxray classes.jar exists before desugar\nproject.afterEvaluate {\n  tasks.matching { it.name.contains('desugar') }.configureEach {\n    dependsOn(':expo-xray-vpn:extractXrayAar')\n  }\n}\n`;
            fs.writeFileSync(appGradle, g);
            console.log('[withXrayVpnFix] wired extractXrayAar -> desugar');
          }
        }
      } catch (e) {
        console.warn('[withXrayVpnFix] app gradle patch failed:', e.message);
      }
      return cfg;
    },
  ]);
  return config;
};

module.exports = withXrayVpnFix;
