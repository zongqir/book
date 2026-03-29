import 'local_bundle_store_base.dart';
import 'local_bundle_store_stub.dart'
    if (dart.library.io) 'local_bundle_store_io.dart';

export 'local_bundle_store_base.dart';

LocalBundleStore createLocalBundleStore() => createPlatformBundleStore();
