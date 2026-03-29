import 'content_manifest.dart';
import 'local_bundle_store_base.dart';

LocalBundleStore createPlatformBundleStore() => const _StubBundleStore();

class _StubBundleStore implements LocalBundleStore {
  const _StubBundleStore();

  @override
  Future<BundleBootstrapState> bootstrap() async {
    return BundleBootstrapState(
      supportsFilesystem: false,
      rootPath: 'web-unsupported',
      objectsPath: 'web-unsupported',
      manifestsPath: 'web-unsupported',
      databasesPath: 'web-unsupported',
      manifestPath: 'web-unsupported',
      contentDbPath: 'web-unsupported',
      userDbPath: 'web-unsupported',
      manifest: appManifest,
      registeredBundleCount: 0,
      registeredObjectCount: 0,
    );
  }
}
