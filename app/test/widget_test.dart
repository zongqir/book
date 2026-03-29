import 'package:flutter_test/flutter_test.dart';

import 'package:book_app/app.dart';

void main() {
  testWidgets('renders the daily quote home screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const BookApp());

    expect(find.text('打开它，不是为了多看一点，而是先被一句话拽住。'), findsOneWidget);
    expect(find.text('已收藏'), findsOneWidget);
  });
}
