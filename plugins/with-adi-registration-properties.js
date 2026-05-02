const fs = require("fs/promises");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

/**
 * Writes `android/app/src/main/assets/adi-registration.properties` during prebuild.
 * Needed for Google Play package verification. The repo gitignores `/android`, so this
 * file is not in git; EAS prebuild creates android/ without it unless we add it here.
 *
 * After Play verification succeeds, remove this plugin and its `token` from app.json
 * (or switch to env `PLAY_ADI_VERIFICATION_TOKEN` + EAS Secret instead of a committed token).
 */
function withAdiRegistrationProperties(config, props = {}) {
  const fromEnv = process.env.PLAY_ADI_VERIFICATION_TOKEN;
  const token = (fromEnv ?? props.token ?? "").trim();
  if (!token) {
    return config;
  }

  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const assetsDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "assets",
      );
      await fs.mkdir(assetsDir, { recursive: true });
      await fs.writeFile(
        path.join(assetsDir, "adi-registration.properties"),
        token,
        "utf8",
      );
      return cfg;
    },
  ]);
}

module.exports = withAdiRegistrationProperties;
