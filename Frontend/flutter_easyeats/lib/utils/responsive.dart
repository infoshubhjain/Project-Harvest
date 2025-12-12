import 'package:flutter/material.dart';

class Responsive {
  static bool isMobile(BuildContext context) =>
      MediaQuery.of(context).size.width < 650;

  static bool isTablet(BuildContext context) =>
      MediaQuery.of(context).size.width >= 650 &&
      MediaQuery.of(context).size.width < 1024;

  static bool isDesktop(BuildContext context) =>
      MediaQuery.of(context).size.width >= 1024;

  static double getMaxWidth(BuildContext context) {
    if (isDesktop(context)) {
      return 1200; // Max width for desktop
    } else if (isTablet(context)) {
      return 800;
    }
    return double.infinity; // Full width for mobile
  }

  static EdgeInsets getPadding(BuildContext context) {
    if (isDesktop(context)) {
      return const EdgeInsets.symmetric(horizontal: 32, vertical: 16);
    } else if (isTablet(context)) {
      return const EdgeInsets.symmetric(horizontal: 24, vertical: 12);
    }
    return const EdgeInsets.symmetric(horizontal: 16, vertical: 8);
  }

  static double getLogoSize(BuildContext context) {
    if (isDesktop(context)) return 80;
    if (isTablet(context)) return 70;
    return 60;
  }
}
