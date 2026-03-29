import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import 'content_manifest.dart';
import 'database_initializer.dart';
import 'database_runtime.dart';
import 'local_bundle_store_base.dart';

const _embeddedBundleRoot = 'assets/content_bundle';
const _embeddedManifestAsset = '$_embeddedBundleRoot/manifest.json';

LocalBundleStore createPlatformBundleStore() => const _IoBundleStore();

class _IoBundleStore implements LocalBundleStore {
  const _IoBundleStore();

  @override
  Future<BundleBootstrapState> bootstrap() async {
    final supportDir = await getApplicationSupportDirectory();
    final rootDir = Directory(p.join(supportDir.path, 'content_runtime'));
    final manifestsDir = Directory(p.join(rootDir.path, 'manifests'));
    final databasesDir = Directory(p.join(rootDir.path, 'databases'));
    final manifestFile = File(
      p.join(manifestsDir.path, 'current-manifest.json'),
    );
    final contentDbFile = File(p.join(databasesDir.path, 'content.db'));
    final userDbFile = File(p.join(databasesDir.path, 'user.db'));

    for (final dir in [rootDir, manifestsDir, databasesDir]) {
      await dir.create(recursive: true);
    }

    final embeddedManifestText = await rootBundle.loadString(
      _embeddedManifestAsset,
    );
    final manifest = BundleManifest.fromJson(
      Map<String, dynamic>.from(
        jsonDecode(embeddedManifestText) as Map<String, dynamic>,
      ),
    );

    if (manifest.bundles.isEmpty) {
      throw StateError('Embedded content bundle manifest has no bundles.');
    }

    final installedManifest = await _readInstalledManifest(manifestFile);
    final primaryBundle = manifest.bundles.first;
    final shouldInstallBundle =
        !await contentDbFile.exists() ||
        installedManifest == null ||
        installedManifest.bundles.isEmpty ||
        installedManifest.schemaVersion != manifest.schemaVersion ||
        installedManifest.bundles.first.bundleVersion !=
            primaryBundle.bundleVersion ||
        installedManifest.bundles.first.dbSha256 != primaryBundle.dbSha256 ||
        installedManifest.bundles.first.dbUrl != primaryBundle.dbUrl;

    if (shouldInstallBundle) {
      await _installBundle(
        manifest: manifest,
        manifestText: embeddedManifestText,
        manifestFile: manifestFile,
        contentDbFile: contentDbFile,
      );
    }

    final initializer = DatabaseInitializer(createDatabaseFactory());
    final result = await initializer.initialize(
      contentDbPath: contentDbFile.path,
      userDbPath: userDbFile.path,
      rootPath: rootDir.path,
      manifestPath: manifestFile.path,
      manifest: manifest,
    );

    return BundleBootstrapState(
      supportsFilesystem: true,
      rootPath: rootDir.path,
      objectsPath: p.join(rootDir.path, 'objects'),
      manifestsPath: manifestsDir.path,
      databasesPath: databasesDir.path,
      manifestPath: manifestFile.path,
      contentDbPath: contentDbFile.path,
      userDbPath: userDbFile.path,
      manifest: manifest,
      registeredBundleCount: result.registeredBundleCount,
      registeredObjectCount: result.registeredObjectCount,
    );
  }

  Future<void> _installBundle({
    required BundleManifest manifest,
    required String manifestText,
    required File manifestFile,
    required File contentDbFile,
  }) async {
    await _copyAssetToFile(
      '$_embeddedBundleRoot/${manifest.bundles.first.dbUrl}',
      contentDbFile,
    );
    await manifestFile.writeAsString(manifestText);
  }

  Future<BundleManifest?> _readInstalledManifest(File manifestFile) async {
    if (!await manifestFile.exists()) {
      return null;
    }

    final raw = await manifestFile.readAsString();
    return BundleManifest.fromJson(
      Map<String, dynamic>.from(jsonDecode(raw) as Map<String, dynamic>),
    );
  }

  Future<void> _copyAssetToFile(String assetPath, File targetFile) async {
    final data = await rootBundle.load(assetPath);
    final bytes = data.buffer.asUint8List(
      data.offsetInBytes,
      data.lengthInBytes,
    );
    await targetFile.parent.create(recursive: true);
    await targetFile.writeAsBytes(bytes, flush: true);
  }
}
