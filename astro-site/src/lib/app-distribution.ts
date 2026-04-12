function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, "");
}

export function getAndroidAppDownloadConfig() {
  const baseUrl = trimTrailingSlash((import.meta.env.PUBLIC_ANDROID_APP_DOWNLOAD_BASE_URL ?? "").trim());
  const latestPath = trimLeadingSlash(
    (import.meta.env.PUBLIC_ANDROID_APP_DOWNLOAD_LATEST_PATH ?? "android/latest/book-android-latest.apk").trim(),
  );
  const manifestPath = trimLeadingSlash(
    (import.meta.env.PUBLIC_ANDROID_APP_DOWNLOAD_MANIFEST_PATH ?? "android/latest/latest.json").trim(),
  );
  const releasePageUrl = (import.meta.env.PUBLIC_ANDROID_APP_RELEASE_PAGE_URL ?? "").trim();

  const latestApkUrl = baseUrl ? `${baseUrl}/${latestPath}` : "";
  const manifestUrl = baseUrl ? `${baseUrl}/${manifestPath}` : "";

  return {
    available: Boolean(latestApkUrl),
    latestApkUrl,
    manifestUrl,
    releasePageUrl,
  };
}
