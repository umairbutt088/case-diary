const fs = require("fs/promises");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");
const { generateImageAsync } = require("@expo/image-utils");

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 4096 ? Math.round(n) : fallback;
}

function withAndroidFullscreenSplash(config, props = {}) {
  const imagePath = props.image || "./assets/images/splash-image.png";
  const raw = Number(props.iconSizeDp);
  const iconSizeDp =
    Number.isFinite(raw) && raw >= 280 && raw <= 520 ? Math.round(raw) : 420;
  const imageWidthPx = parsePositiveInt(props.imageWidthPx, 400);
  const imageHeightPx = parsePositiveInt(props.imageHeightPx, 600);
  const splashBackgroundColor = props.backgroundColor || "#fcfcfc";
  const imageResizeMode = props.imageResizeMode === "cover" ? "cover" : "contain";

  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const androidMainResDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );
      const drawableDir = path.join(androidMainResDir, "drawable");
      const nodpiDir = path.join(androidMainResDir, "drawable-nodpi");
      const valuesDir = path.join(androidMainResDir, "values");
      await fs.mkdir(drawableDir, { recursive: true });
      await fs.mkdir(nodpiDir, { recursive: true });
      await fs.mkdir(valuesDir, { recursive: true });

      const splashIconSizeXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <dimen name="splashscreen_animated_icon_size">${iconSizeDp}dp</dimen>
</resources>
`;
      await fs.writeFile(
        path.join(valuesDir, "splash_icon_size.xml"),
        splashIconSizeXml,
        "utf8"
      );

      // Layer-list must be the animated icon drawable (not the raw PNG): API 31+ scales that
      // drawable into the splash icon bounds; <bitmap android:gravity="fill"> stretches the
      // artwork to those bounds. (Drawable XML has no android:scaleType — that is ImageView-only.)
      const windowXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item>
    <bitmap android:gravity="fill" android:src="@drawable/splashscreen_full" />
  </item>
</layer-list>
`;
      await fs.writeFile(path.join(drawableDir, "splashscreen_window.xml"), windowXml, "utf8");

      const sourceImagePath = path.resolve(projectRoot, imagePath);
      const targetImagePath = path.join(nodpiDir, "splashscreen_full.png");
      try {
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: "legal-diary-splash-full" },
          {
            src: sourceImagePath,
            width: imageWidthPx,
            height: imageHeightPx,
            resizeMode: imageResizeMode,
            backgroundColor: splashBackgroundColor,
          }
        );
        await fs.writeFile(targetImagePath, source);
      } catch {
        await fs.copyFile(sourceImagePath, targetImagePath);
      }
      try {
        await fs.unlink(path.join(drawableDir, "splashscreen_full.png"));
      } catch {
        /* no legacy file */
      }

      const stylesPath = path.join(androidMainResDir, "values", "styles.xml");
      const stylesContent = await fs.readFile(stylesPath, "utf8");
      const fullscreenStyle = `  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_window</item>
    <item name="splashScreenIconSize">@dimen/splashscreen_animated_icon_size</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
    <item name="android:windowSplashScreenBehavior">icon_preferred</item>
  </style>`;
      const splashStyleRegex = new RegExp(
        '  <style name="Theme\\.App\\.SplashScreen"[\\s\\S]*?<\\/style>'
      );
      const replaced = stylesContent.replace(splashStyleRegex, fullscreenStyle);
      await fs.writeFile(stylesPath, replaced, "utf8");

      return config;
    },
  ]);
}

module.exports = withAndroidFullscreenSplash;
