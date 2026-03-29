import 'package:flutter/foundation.dart';
import 'package:sqflite/sqflite.dart' as sqflite;
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

DatabaseFactory createDatabaseFactory() {
  if (kIsWeb) {
    throw UnsupportedError(
      'Web does not support the local SQLite runtime yet.',
    );
  }

  switch (defaultTargetPlatform) {
    case TargetPlatform.windows:
    case TargetPlatform.linux:
      sqfliteFfiInit();
      return databaseFactoryFfi;
    case TargetPlatform.android:
    case TargetPlatform.iOS:
    case TargetPlatform.macOS:
      return sqflite.databaseFactory;
    case TargetPlatform.fuchsia:
      return sqflite.databaseFactory;
  }
}
