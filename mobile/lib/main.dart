import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/theme.dart';
import 'providers/app_provider.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final auth = AuthProvider();
  await auth.tryAutoLogin();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: auth),
        ChangeNotifierProvider(create: (_) => TaskProvider()),
        ChangeNotifierProvider(create: (_) => ProjectProvider()),
      ],
      child: const SynergyApp(),
    ),
  );
}

class SynergyApp extends StatelessWidget {
  const SynergyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Synergy',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      home: const _AuthGate(),
      builder: (context, child) {
        // Global error handler overlay
        return child ?? const SizedBox.shrink();
      },
    );
  }
}

class _AuthGate extends StatelessWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.initialized) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Theme.of(context).extension<AppColors>()!.primary,
                      Theme.of(context).extension<AppColors>()!.secondary,
                    ],
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
              child: const Icon(Icons.sync, color: Colors.white, size: 28),
            ),
              const SizedBox(height: 20),
              Text('Synergy', style: Theme.of(context).textTheme.headlineMedium),
            ],
          ),
        ),
      );
    }

    if (auth.isLoggedIn) {
      return const DashboardScreen();
    }

    return const LoginScreen();
  }
}
