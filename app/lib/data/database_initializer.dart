import 'package:sqflite_common/sqlite_api.dart';

import 'content_manifest.dart';
import 'sqlite_schemas.dart';

class DatabaseInitializer {
  const DatabaseInitializer(this.factory);

  final DatabaseFactory factory;

  Future<DatabaseBootstrapResult> initialize({
    required String contentDbPath,
    required String userDbPath,
    required String rootPath,
    required String manifestPath,
    required BundleManifest manifest,
  }) async {
    final contentDb = await factory.openDatabase(
      contentDbPath,
      options: OpenDatabaseOptions(readOnly: true),
    );

    try {
      final contentRow = await contentDb.rawQuery(
        'SELECT COUNT(*) AS count FROM books',
      );
      final contentCount = contentRow.first['count'] as int? ?? 0;
      if (contentCount == 0) {
        throw StateError('Embedded content database is empty.');
      }
    } finally {
      await contentDb.close();
    }

    final userDb = await factory.openDatabase(userDbPath);

    try {
      for (final statement in SqliteSchemas.userDatabase) {
        await userDb.execute(statement);
      }

      final primaryBundle = manifest.bundles.first;

      await userDb.transaction((txn) async {
        await txn.update('local_bundles', {'is_current': 0});
        await txn.delete('local_objects');

        await txn.insert('local_bundles', {
          'bundle_version': primaryBundle.bundleVersion,
          'bundle_id': primaryBundle.bundleId,
          'manifest_path': manifestPath,
          'is_current': 1,
          'created_at': manifest.publishedAt,
        }, conflictAlgorithm: ConflictAlgorithm.replace);
      });

      final bundleCount =
          (await userDb.rawQuery(
                'SELECT COUNT(*) AS count FROM local_bundles',
              )).first['count']
              as int? ??
          0;
      final objectCount =
          (await userDb.rawQuery(
                'SELECT COUNT(*) AS count FROM local_objects',
              )).first['count']
              as int? ??
          0;

      return DatabaseBootstrapResult(
        registeredBundleCount: bundleCount,
        registeredObjectCount: objectCount,
      );
    } finally {
      await userDb.close();
    }
  }
}

class DatabaseBootstrapResult {
  const DatabaseBootstrapResult({
    required this.registeredBundleCount,
    required this.registeredObjectCount,
  });

  final int registeredBundleCount;
  final int registeredObjectCount;
}
