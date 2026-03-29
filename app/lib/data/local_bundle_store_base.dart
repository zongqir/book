import 'content_manifest.dart';

abstract class LocalBundleStore {
  Future<BundleBootstrapState> bootstrap();
}
