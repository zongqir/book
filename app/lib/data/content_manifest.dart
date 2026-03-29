import 'dart:convert';

class BundleManifest {
  const BundleManifest({
    required this.schemaVersion,
    required this.publishedAt,
    required this.bundles,
  });

  final int schemaVersion;
  final String publishedAt;
  final List<BundleDescriptor> bundles;

  factory BundleManifest.fromJson(Map<String, dynamic> json) {
    return BundleManifest(
      schemaVersion: json['schema_version'] as int,
      publishedAt: json['published_at'] as String,
      bundles: (json['bundles'] as List<dynamic>)
          .map(
            (item) => BundleDescriptor.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'schema_version': schemaVersion,
      'published_at': publishedAt,
      'bundles': bundles.map((bundle) => bundle.toJson()).toList(),
    };
  }

  String toPrettyJson() => const JsonEncoder.withIndent('  ').convert(toJson());
}

class BundleDescriptor {
  const BundleDescriptor({
    required this.bundleId,
    required this.bundleType,
    required this.bundleVersion,
    required this.minAppVersion,
    required this.dbUrl,
    required this.dbSha256,
    required this.requiredObjects,
  });

  final String bundleId;
  final String bundleType;
  final String bundleVersion;
  final String minAppVersion;
  final String dbUrl;
  final String dbSha256;
  final List<ContentObjectRef> requiredObjects;

  factory BundleDescriptor.fromJson(Map<String, dynamic> json) {
    return BundleDescriptor(
      bundleId: json['bundle_id'] as String,
      bundleType: json['bundle_type'] as String,
      bundleVersion: json['bundle_version'] as String,
      minAppVersion: json['min_app_version'] as String,
      dbUrl: json['db_url'] as String,
      dbSha256: json['db_sha256'] as String,
      requiredObjects: (json['required_objects'] as List<dynamic>)
          .map(
            (item) => ContentObjectRef.fromJson(item as Map<String, dynamic>),
          )
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'bundle_id': bundleId,
      'bundle_type': bundleType,
      'bundle_version': bundleVersion,
      'min_app_version': minAppVersion,
      'db_url': dbUrl,
      'db_sha256': dbSha256,
      'required_objects': requiredObjects.map((item) => item.toJson()).toList(),
    };
  }
}

class ContentObjectRef {
  const ContentObjectRef({
    required this.objectHash,
    required this.objectType,
    required this.relativePath,
    this.sizeBytes,
  });

  final String objectHash;
  final String objectType;
  final String relativePath;
  final int? sizeBytes;

  factory ContentObjectRef.fromJson(Map<String, dynamic> json) {
    return ContentObjectRef(
      objectHash: json['object_hash'] as String,
      objectType: json['object_type'] as String,
      relativePath: json['relative_path'] as String,
      sizeBytes: json['size_bytes'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'object_hash': objectHash,
      'object_type': objectType,
      'relative_path': relativePath,
      'size_bytes': sizeBytes,
    };
  }
}

class BundleBootstrapState {
  const BundleBootstrapState({
    required this.supportsFilesystem,
    required this.rootPath,
    required this.objectsPath,
    required this.manifestsPath,
    required this.databasesPath,
    required this.manifestPath,
    required this.contentDbPath,
    required this.userDbPath,
    required this.manifest,
    required this.registeredBundleCount,
    required this.registeredObjectCount,
  });

  final bool supportsFilesystem;
  final String rootPath;
  final String objectsPath;
  final String manifestsPath;
  final String databasesPath;
  final String manifestPath;
  final String contentDbPath;
  final String userDbPath;
  final BundleManifest manifest;
  final int registeredBundleCount;
  final int registeredObjectCount;
}

const appManifest = BundleManifest(
  schemaVersion: 1,
  publishedAt: '',
  bundles: <BundleDescriptor>[],
);
