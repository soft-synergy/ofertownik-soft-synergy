import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../config/theme.dart';
import 'tasks/tasks_screen.dart';
import 'projects/projects_screen.dart';
import 'quotes/quotes_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  final _screens = const [
    _DashboardHome(),
    TasksScreen(),
    ProjectsScreen(),
    QuotesScreen(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<TaskProvider>().loadTasks();
      context.read<ProjectProvider>().loadProjects();
      context.read<ProjectProvider>().loadQuotes();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => setState(() => _currentIndex = i),
        animationDuration: const Duration(milliseconds: 400),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_outlined), selectedIcon: Icon(Icons.dashboard_rounded), label: 'Pulpit'),
          NavigationDestination(icon: Icon(Icons.check_circle_outline), selectedIcon: Icon(Icons.check_circle_rounded), label: 'Zadania'),
          NavigationDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder_rounded), label: 'Projekty'),
          NavigationDestination(icon: Icon(Icons.description_outlined), selectedIcon: Icon(Icons.description_rounded), label: 'Wyceny'),
        ],
      ),
    );
  }
}

class _DashboardHome extends StatelessWidget {
  const _DashboardHome();

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final auth = context.watch<AuthProvider>();
    final taskProv = context.watch<TaskProvider>();
    final projProv = context.watch<ProjectProvider>();
    final user = auth.user;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          await Future.wait([
            taskProv.loadTasks(),
            projProv.loadProjects(),
            projProv.loadQuotes(),
          ]);
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(colors: [colors.primary, colors.secondary]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Center(
                    child: Text(user?.initials ?? '?', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16)),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Cześć, ${user?.firstName ?? ''}!', style: Theme.of(context).textTheme.headlineSmall),
                      Text('Dziś mamy co robić', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF636E72))),
                    ],
                  ),
                ),
                IconButton(onPressed: () => auth.logout(), icon: Icon(Icons.logout_rounded, color: colors.error), tooltip: 'Wyloguj'),
              ],
            ),
            const SizedBox(height: 28),
            _StatCard(title: 'Zadania', value: '${taskProv.totalTasks}', subtitle: '${taskProv.overdueTasks} po terminie', color: colors.primary, icon: Icons.task_alt_rounded),
            const SizedBox(height: 14),
            _StatCard(title: 'Projekty', value: '${projProv.projects.length}', subtitle: 'Aktywne', color: colors.secondary, icon: Icons.folder_rounded),
            const SizedBox(height: 14),
            _StatCard(title: 'Wyceny', value: '${projProv.quotes.length}', subtitle: 'Do akceptacji', color: colors.warning, icon: Icons.description_rounded),
            const SizedBox(height: 28),
            Text('Szybkie akcje', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(child: _QuickAction(icon: Icons.add_circle_outline, label: 'Nowe\nzadanie', color: colors.primary, onTap: () {})),
                const SizedBox(width: 12),
                Expanded(child: _QuickAction(icon: Icons.create_new_folder_outlined, label: 'Nowy\nprojekt', color: colors.secondary, onTap: () {})),
                const SizedBox(width: 12),
                Expanded(child: _QuickAction(icon: Icons.rate_review_outlined, label: 'Nowa\nwycena', color: colors.warning, onTap: () {})),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final Color color;
  final IconData icon;

  const _StatCard({required this.title, required this.value, required this.subtitle, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [color.withOpacity(0.12), color.withOpacity(0.04)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: color.withOpacity(0.15)),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(width: 18),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: const Color(0xFF636E72))),
                const SizedBox(height: 2),
                Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: Color(0xFF2D3436), fontWeight: FontWeight.w800)),
                Text(subtitle, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(20),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 22),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFDFE6E9)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 10),
              Text(label, textAlign: TextAlign.center, style: Theme.of(context).textTheme.labelMedium?.copyWith(color: const Color(0xFF2D3436))),
            ],
          ),
        ),
      ),
    );
  }
}
