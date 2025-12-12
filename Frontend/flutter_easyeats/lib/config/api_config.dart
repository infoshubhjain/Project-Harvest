class ApiConfig {
  // Use the deployed backend URL
  // Update this after deploying to Render or use your own backend URL
  static const String baseUrl = 'https://easyeats-backend.onrender.com/api';

  // For local development, uncomment this:
  // static const String baseUrl = 'http://localhost:3000/api';

  // For web deployment (GitHub Pages), always use the deployed backend
  static String get apiBaseUrl => baseUrl;
}
