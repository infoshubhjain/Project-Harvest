import 'package:flutter/material.dart';
import 'home_page.dart';
import '../services/auth_service.dart';
import '../services/user_service.dart';


class QuestionnaireScreen extends StatefulWidget {
  final int userId;

  const QuestionnaireScreen({super.key, required this.userId});

  @override
  State<QuestionnaireScreen> createState() => _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends State<QuestionnaireScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isLoading = false;

  // User responses
  String? goal;
  String? sex;
  int? age;
  double? heightFeet;
  double? heightInches;
  double? weight;
  int? calories;

  // Text controllers for numeric inputs
  final TextEditingController _ageController = TextEditingController();
  final TextEditingController _heightFeetController = TextEditingController();
  final TextEditingController _heightInchesController = TextEditingController();
  final TextEditingController _weightController = TextEditingController();
  final TextEditingController _caloriesController = TextEditingController();

  @override
  void dispose() {
    _pageController.dispose();
    _ageController.dispose();
    _heightFeetController.dispose();
    _heightInchesController.dispose();
    _weightController.dispose();
    _caloriesController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < 4) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  Future<void> _submitQuestionnaire() async {
    final navigator = Navigator.of(context);

    setState(() {
      _isLoading = true;
    });

    // Update profile on backend
    final result = await AuthService.updateProfile(
      widget.userId,
      goal,
      age,
      sex,
      calories,
    );

    setState(() {
      _isLoading = false;
    });

    if (!mounted) return;

    if (result['success']) {
      // Store user data (with persistent storage)
      await UserService.setCurrentUser(widget.userId, result['data']['user']);

      if (!mounted) return;
      navigator.pushReplacement(
        MaterialPageRoute(builder: (context) => const MainPage()),
      );
    } else {
      // Show error but offer option to continue anyway for testing
      if (!mounted) return;

      final shouldContinue = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Connection Error'),
          content: Text(
            'Could not connect to server:\n${result['error']}\n\nDo you want to continue without saving? (For testing only)',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Continue Anyway'),
            ),
          ],
        ),
      );

      if (shouldContinue == true && mounted) {
        // Continue to home page without saving
        navigator.pushReplacement(
          MaterialPageRoute(builder: (context) => const MainPage()),
        );
      }
    }
  }

  bool _canContinue(int page) {
    switch (page) {
      case 0:
        return goal != null;
      case 1:
        return sex != null;
      case 2:
        return age != null && age! > 0;
      case 3:
        return (heightFeet != null && heightFeet! > 0) ||
               (heightInches != null && heightInches! > 0) &&
               (weight != null && weight! > 0);
      case 4:
        return true; // Calorie goal is optional
      default:
        return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Personalize Your Plan'),
        automaticallyImplyLeading: _currentPage > 0,
        leading: _currentPage > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _previousPage,
              )
            : null,
      ),
      body: Column(
        children: [
          // Progress bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Question ${_currentPage + 1} of 5',
                      style: const TextStyle(fontSize: 14, color: Colors.grey),
                    ),
                    Text(
                      '${(((_currentPage + 1) / 5) * 100).toInt()}%',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (_currentPage + 1) / 5,
                  backgroundColor: Colors.grey[200],
                  color: Colors.green,
                  minHeight: 8,
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
          ),

          // Pages
          Expanded(
            child: PageView(
              controller: _pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (index) {
                setState(() {
                  _currentPage = index;
                });
              },
              children: [
                _buildGoalPage(),
                _buildSexPage(),
                _buildAgePage(),
                _buildHeightWeightPage(),
                _buildCaloriesPage(),
              ],
            ),
          ),

          // Bottom navigation
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isLoading
                      ? null
                      : (_canContinue(_currentPage)
                          ? (_currentPage == 4 ? _submitQuestionnaire : _nextPage)
                          : null),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 50),
                    disabledBackgroundColor: Colors.grey[300],
                  ),
                  child: _isLoading
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          _currentPage == 4 ? 'Finish' : 'Continue',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildGoalPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          Center(
            child: Image.asset(
              'assets/images/Logo.png',
              height: 80,
            ),
          ),
          const SizedBox(height: 40),
          const Text(
            'What is your goal?',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'This helps us personalize your meal recommendations',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          _buildGoalOption('Losing weight', Icons.trending_down),
          const SizedBox(height: 12),
          _buildGoalOption('Gaining weight', Icons.trending_up),
          const SizedBox(height: 12),
          _buildGoalOption('Becoming fit', Icons.fitness_center),
        ],
      ),
    );
  }

  Widget _buildGoalOption(String goalText, IconData icon) {
    final isSelected = goal == goalText;
    return InkWell(
      onTap: () {
        setState(() {
          goal = goalText;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(
            color: isSelected ? Colors.green : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: isSelected ? Colors.green.withOpacity(0.1) : Colors.white,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.green : Colors.grey[600],
              size: 32,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                goalText,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.green : Colors.black,
                ),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: Colors.green, size: 28),
          ],
        ),
      ),
    );
  }

  Widget _buildSexPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          const Text(
            'What is your biological sex?',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'This helps us calculate your nutritional needs',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          _buildSexOption('Male', Icons.male),
          const SizedBox(height: 12),
          _buildSexOption('Female', Icons.female),
          const SizedBox(height: 12),
          _buildSexOption('Other', Icons.person),
        ],
      ),
    );
  }

  Widget _buildSexOption(String sexText, IconData icon) {
    final isSelected = sex == sexText;
    return InkWell(
      onTap: () {
        setState(() {
          sex = sexText;
        });
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(
            color: isSelected ? Colors.green : Colors.grey[300]!,
            width: isSelected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
          color: isSelected ? Colors.green.withOpacity(0.1) : Colors.white,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.green : Colors.grey[600],
              size: 32,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                sexText,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? Colors.green : Colors.black,
                ),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle, color: Colors.green, size: 28),
          ],
        ),
      ),
    );
  }

  Widget _buildAgePage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          const Text(
            'How old are you?',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Your age helps us determine your nutritional needs',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _ageController,
            keyboardType: TextInputType.number,
            style: const TextStyle(fontSize: 18),
            decoration: InputDecoration(
              labelText: 'Age',
              hintText: 'Enter your age',
              suffixText: 'years',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.cake),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            ),
            onChanged: (val) {
              setState(() {
                age = int.tryParse(val);
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHeightWeightPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          const Text(
            'What is your height and weight?',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'This information helps us personalize your plan',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          const Text(
            'Height',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _heightFeetController,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 18),
                  decoration: InputDecoration(
                    labelText: 'Feet',
                    hintText: '5',
                    suffixText: 'ft',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  ),
                  onChanged: (val) {
                    setState(() {
                      heightFeet = double.tryParse(val);
                    });
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextField(
                  controller: _heightInchesController,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 18),
                  decoration: InputDecoration(
                    labelText: 'Inches',
                    hintText: '8',
                    suffixText: 'in',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  ),
                  onChanged: (val) {
                    setState(() {
                      heightInches = double.tryParse(val);
                    });
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Weight',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _weightController,
            keyboardType: TextInputType.number,
            style: const TextStyle(fontSize: 18),
            decoration: InputDecoration(
              labelText: 'Weight',
              hintText: 'Enter your weight',
              suffixText: 'lbs',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.monitor_weight),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            ),
            onChanged: (val) {
              setState(() {
                weight = double.tryParse(val);
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCaloriesPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 20),
          const Text(
            'Daily calorie goal',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Do you have a specific daily calorie target? (Optional)',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _caloriesController,
            keyboardType: TextInputType.number,
            style: const TextStyle(fontSize: 18),
            decoration: InputDecoration(
              labelText: 'Daily Calories',
              hintText: 'e.g., 2000',
              suffixText: 'kcal',
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.local_fire_department),
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              helperText: 'Leave blank if you\'re not sure',
            ),
            onChanged: (val) {
              setState(() {
                calories = int.tryParse(val);
              });
            },
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: Colors.blue[700]),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'We can help calculate this based on your goals and profile',
                    style: TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
