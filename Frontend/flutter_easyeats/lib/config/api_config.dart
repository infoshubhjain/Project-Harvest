class ApiConfig {
  // Using GitHub Pages static JSON API (no backend server needed!)
  static const String baseUrl = 'https://infoshubhjain.github.io/Project-Harvest/api';

  // For local development/testing with JSON files:
  // static const String baseUrl = 'http://localhost:8000/docs/api';

  // For traditional backend (if you deploy one later):
  // static const String baseUrl = 'https://your-backend.onrender.com/api';

  static String get apiBaseUrl => baseUrl;
}
