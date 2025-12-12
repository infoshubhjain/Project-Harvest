import 'package:flutter/material.dart';
import 'dining_halls.dart' as dining_halls;
import 'settings_page.dart';
import '../services/nutrition_service.dart';
import '../services/user_service.dart';
import '../models/meal_entry.dart';
import '../utils/responsive.dart';

class MainPage extends StatefulWidget {
  const MainPage({super.key});

  @override
  State<MainPage> createState() => _MainPageState();
}

class _MainPageState extends State<MainPage> {
  bool _isLoading = true;
  NutritionTotals _todayTotals = NutritionTotals(
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    fiber: 0,
  );
  List<MealEntry> _todayMeals = [];
  int _userCalorieGoal = 2000;
  int? _userId;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = '';
    });

    // Skip backend calls for now - just show the UI
    setState(() {
      _isLoading = false;
      _userCalorieGoal = 2000;
    });

    // Uncomment this when backend is available:
    // try {
    //   final user = await UserService.getCurrentUser();
    //   if (user == null) {
    //     setState(() {
    //       _error = 'Not logged in';
    //       _isLoading = false;
    //     });
    //     return;
    //   }
    //   _userId = user['id'];
    //   _userCalorieGoal = user['calories'] ?? 2000;
    //   final todayData = await NutritionService.getTodayTotals(_userId!);
    //   setState(() {
    //     _todayTotals = todayData['totals'];
    //     _todayMeals = todayData['meals'];
    //     _isLoading = false;
    //   });
    // } catch (e) {
    //   setState(() {
    //     _error = e.toString();
    //     _isLoading = false;
    //   });
    // }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: 0,
        type: BottomNavigationBarType.fixed,
        showSelectedLabels: true,
        showUnselectedLabels: true,
        onTap: (index) {
          if (index == 1) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const dining_halls.MainPage()),
            );
          } else if (index == 2) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const SettingsPage()),
            );
          }
        },
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home),
            label: 'Home',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.restaurant),
            label: 'Dining Halls',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          child: Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: Responsive.getMaxWidth(context)),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: Responsive.getPadding(context),
                child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 10),
                // Logo and title at the top
                Center(
                  child: Column(
                    children: [
                      Image.asset(
                        'assets/images/Logo.png',
                        height: Responsive.getLogoSize(context),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Project Harvest',
                        style: TextStyle(
                          fontSize: Responsive.isDesktop(context) ? 28 : 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.green.shade800,
                        ),
                      ),
                      Text(
                        'University Dining Nutrition Tracker',
                        style: TextStyle(
                          fontSize: Responsive.isDesktop(context) ? 14 : 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Error message
                if (_error.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.all(12),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade700),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _error,
                            style: TextStyle(color: Colors.red.shade700),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Loading indicator
                if (_isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32.0),
                      child: CircularProgressIndicator(),
                    ),
                  )
                else ...[
                  // Search bar
                  TextField(
                    decoration: InputDecoration(
                      hintText: "Search foods...",
                      prefixIcon: const Icon(Icons.search),
                      filled: true,
                      fillColor: Colors.grey[200],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                    ),
                    onTap: () {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (context) => const dining_halls.MainPage()),
                      );
                    },
                    readOnly: true,
                  ),
                  const SizedBox(height: 16),

                  // Top Buttons Row
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildTopButton(Icons.favorite_border, "Favorites"),
                        _buildTopButton(Icons.history, "History", onTap: () {
                          // Navigate to history page - to be implemented
                        }),
                        _buildTopButton(Icons.refresh, "Refresh", onTap: _loadData),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Today's Meals Summary
                  if (_todayMeals.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Today's Meals (${_todayMeals.length})",
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(Icons.chevron_right),
                          onPressed: () {
                            // Show meals detail
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: _todayMeals.map((meal) {
                          return _buildMealCard(meal);
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 25),
                  ],

                  // Goals section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        "Today's Goals",
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        "${_todayMeals.length} meals",
                        style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),

                  _buildProgressBar(
                    "Calories",
                    _todayTotals.calories,
                    _userCalorieGoal.toDouble(),
                    "kcal",
                  ),
                  const SizedBox(height: 8),
                  _buildProgressBar(
                    "Protein",
                    _todayTotals.protein,
                    (_userCalorieGoal * 0.3 / 4).toDouble(),
                    "g",
                  ),
                  const SizedBox(height: 8),
                  _buildProgressBar(
                    "Carbohydrates",
                    _todayTotals.carbs,
                    (_userCalorieGoal * 0.5 / 4).toDouble(),
                    "g",
                  ),
                  const SizedBox(height: 8),
                  _buildProgressBar(
                    "Fat",
                    _todayTotals.fat,
                    (_userCalorieGoal * 0.2 / 9).toDouble(),
                    "g",
                  ),

                  const SizedBox(height: 30),

                  // Quick actions
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.restaurant_menu, color: Colors.green.shade700, size: 32),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "Ready to eat?",
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.green.shade900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                "Check out dining halls for personalized recommendations",
                                style: TextStyle(
                                  fontSize: 14,
                                  color: Colors.green.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: Icon(Icons.arrow_forward, color: Colors.green.shade700),
                          onPressed: () {
                            Navigator.pushReplacement(
                              context,
                              MaterialPageRoute(builder: (context) => const dining_halls.MainPage()),
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),
                ],
              ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMealCard(MealEntry meal) {
    return Container(
      width: 140,
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
        boxShadow: [
          BoxShadow(
            color: Colors.grey.shade200,
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            meal.mealType,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            meal.diningHall,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey[600],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 8),
          Text(
            "${meal.totals.calories.toInt()} cal",
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Colors.green.shade700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "P: ${meal.totals.protein.toInt()}g",
            style: TextStyle(fontSize: 11, color: Colors.grey[700]),
          ),
          Text(
            "C: ${meal.totals.carbs.toInt()}g",
            style: TextStyle(fontSize: 11, color: Colors.grey[700]),
          ),
        ],
      ),
    );
  }

  Widget _buildTopButton(IconData icon, String label, {VoidCallback? onTap}) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      child: OutlinedButton.icon(
        onPressed: onTap ?? () {},
        icon: Icon(icon, size: 18),
        label: Text(label),
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          side: BorderSide(color: Colors.grey[300]!),
        ),
      ),
    );
  }

  Widget _buildProgressBar(String label, double current, double goal, String unit) {
    double progress = current / goal;
    bool isOverGoal = progress > 1.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "$label: ${current.toInt()}/${goal.toInt()} $unit",
              style: const TextStyle(fontSize: 14),
            ),
            Text(
              "${(progress * 100).toInt()}%",
              style: TextStyle(
                fontSize: 12,
                color: isOverGoal ? Colors.red : Colors.grey[600],
                fontWeight: isOverGoal ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        LinearProgressIndicator(
          value: progress > 1.0 ? 1.0 : progress,
          backgroundColor: Colors.grey[200],
          color: isOverGoal ? Colors.red : Colors.green,
          minHeight: 8,
        ),
      ],
    );
  }
}
