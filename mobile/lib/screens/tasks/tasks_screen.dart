import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/app_provider.dart';
import '../../config/theme.dart';
import '../../models/task.dart';

class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});

  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  String _filter = 'all';
  String _priorityFilter = '';

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final prov = context.watch<TaskProvider>();

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Row(
              children: [
                Text('Zadania', style: Theme.of(context).textTheme.headlineSmall),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: colors.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                  child: Text('${prov.totalTasks}', style: TextStyle(color: colors.primary, fontWeight: FontWeight.w700, fontSize: 13)),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Moje',
                  selected: _filter == 'me',
                  onTap: () {
                    setState(() => _filter = _filter == 'me' ? 'all' : 'me');
                    prov.loadTasks(assignee: _filter == 'me' ? 'me' : null, priority: _priorityFilter.isEmpty ? null : _priorityFilter);
                  },
                ),
                const SizedBox(width: 8),
                PopupMenuButton<String>(
                  icon: Icon(Icons.filter_list, color: _priorityFilter.isNotEmpty ? colors.primary : const Color(0xFF636E72)),
                  tooltip: 'Priorytet',
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  onSelected: (v) {
                    setState(() => _priorityFilter = _priorityFilter == v ? '' : v);
                    prov.loadTasks(assignee: _filter == 'me' ? 'me' : null, priority: _priorityFilter.isEmpty ? null : _priorityFilter);
                  },
                  itemBuilder: (_) => [
                    PopupMenuItem(value: 'urgent', child: Row(children: [Icon(Icons.flash_on, size: 16, color: colors.error), const SizedBox(width: 8), const Text('Pilny')])),
                    PopupMenuItem(value: 'high', child: Row(children: [Icon(Icons.priority_high, size: 16, color: const Color(0xFFE17055)), const SizedBox(width: 8), const Text('Wysoki')])),
                    PopupMenuItem(value: 'normal', child: Row(children: [Icon(Icons.flag, size: 16, color: colors.primary), const SizedBox(width: 8), const Text('Normalny')])),
                    PopupMenuItem(value: 'low', child: Row(children: [Icon(Icons.low_priority, size: 16, color: const Color(0xFF636E72)), const SizedBox(width: 8), const Text('Niski')])),
                  ],
                ),
              ],
            ),
          ),
          TabBar(
            controller: _tabCtrl,
            isScrollable: true,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            indicatorSize: TabBarIndicatorSize.label,
            indicator: BoxDecoration(color: colors.primary, borderRadius: BorderRadius.circular(14)),
            labelColor: Colors.white,
            unselectedLabelColor: const Color(0xFF636E72),
            labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
            dividerColor: Colors.transparent,
            tabs: [
              Tab(text: 'Do zrobienia (${prov.todoTasks.length})'),
              Tab(text: 'W toku (${prov.inProgressTasks.length})'),
              Tab(text: 'Zrobione (${prov.doneTasks.length})'),
              Tab(text: 'Anulowane (${prov.cancelledTasks.length})'),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: prov.loading
                ? const Center(child: CircularProgressIndicator())
                : prov.error != null
                    ? Center(child: Padding(padding: const EdgeInsets.all(32), child: Text('Błąd: ${prov.error}', style: TextStyle(color: Theme.of(context).extension<AppColors>()!.error, fontSize: 14), textAlign: TextAlign.center)))
                    : TabBarView(
                    controller: _tabCtrl,
                    children: [
                      _TaskList(tasks: prov.todoTasks, onToggle: (id) => prov.toggleTaskStatus(id), onMove: (id, s) => prov.moveTask(id, s)),
                      _TaskList(tasks: prov.inProgressTasks, onToggle: (id) => prov.toggleTaskStatus(id), onMove: (id, s) => prov.moveTask(id, s)),
                      _TaskList(tasks: prov.doneTasks, onToggle: (id) => prov.toggleTaskStatus(id), onMove: (id, s) => prov.moveTask(id, s)),
                      _TaskList(tasks: prov.cancelledTasks, onToggle: (id) => prov.toggleTaskStatus(id), onMove: (id, s) => prov.moveTask(id, s)),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? colors.primary.withOpacity(0.1) : const Color(0xFFF1F2F6),
          borderRadius: BorderRadius.circular(12),
          border: selected ? Border.all(color: colors.primary.withOpacity(0.3)) : null,
        ),
        child: Text(label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? colors.primary : const Color(0xFF636E72))),
      ),
    );
  }
}

class _TaskList extends StatelessWidget {
  final List<Task> tasks;
  final Function(String) onToggle;
  final Function(String, String) onMove;

  const _TaskList({required this.tasks, required this.onToggle, required this.onMove});

  @override
  Widget build(BuildContext context) {
    if (tasks.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_rounded, size: 48, color: const Color(0xFFB2BEC3).withOpacity(0.5)),
            const SizedBox(height: 12),
            Text('Brak zadań', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFFB2BEC3))),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      itemCount: tasks.length,
      itemBuilder: (_, i) => _TaskCard(task: tasks[i], onToggle: onToggle, onMove: onMove),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final Task task;
  final Function(String) onToggle;
  final Function(String, String) onMove;

  const _TaskCard({required this.task, required this.onToggle, required this.onMove});

  Color _priorityColor() {
    final colors = AppColors(primary: const Color(0xFF6C5CE7), secondary: const Color(0xFF00CEC9), error: const Color(0xFFFF6B6B), success: const Color(0xFF00B894), warning: const Color(0xFFFDCB6E));
    switch (task.priority) {
      case 'urgent':
        return colors.error;
      case 'high':
        return const Color(0xFFE17055);
      case 'low':
        return const Color(0xFFB2BEC3);
      default:
        return colors.primary;
    }
  }

  String _priorityLabel() {
    switch (task.priority) {
      case 'urgent': return 'Pilny';
      case 'high': return 'Wysoki';
      case 'low': return 'Niski';
      default: return 'Norm.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final isDone = task.status == 'done';
    final priColor = _priorityColor();

    return Dismissible(
      key: Key(task.id),
      direction: DismissDirection.horizontal,
      confirmDismiss: (dir) async {
        if (dir == DismissDirection.endToStart) {
          onToggle(task.id);
        } else if (dir == DismissDirection.startToEnd) {
          onMove(task.id, 'done');
        }
        return false;
      },
      background: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [colors.success, colors.success.withOpacity(0.7)]),
          borderRadius: BorderRadius.circular(18),
        ),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 24),
        child: const Icon(Icons.check_circle, color: Colors.white),
      ),
      secondaryBackground: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [colors.success, colors.success.withOpacity(0.7)]),
          borderRadius: BorderRadius.circular(18),
        ),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        child: const Icon(Icons.check_circle, color: Colors.white),
      ),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: isDone ? const Color(0xFFF1F8F5) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: isDone ? colors.success.withOpacity(0.2) : const Color(0xFFF1F2F6)),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => _showTaskDetail(context, task),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 4,
                        height: 20,
                        decoration: BoxDecoration(color: priColor, borderRadius: BorderRadius.circular(2)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          task.title,
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF2D3436),
                            decoration: isDone ? TextDecoration.lineThrough : null,
                            decorationColor: const Color(0xFFB2BEC3),
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => onToggle(task.id),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDone ? colors.success : Colors.transparent,
                            border: Border.all(color: isDone ? colors.success : const Color(0xFFDFE6E9), width: 2),
                          ),
                          child: isDone ? const Icon(Icons.check, size: 16, color: Colors.white) : null,
                        ),
                      ),
                    ],
                  ),
                  if (task.description.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(task.description, style: const TextStyle(fontSize: 13, color: Color(0xFF636E72)), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      if (task.dueDate != null) ...[
                        Icon(Icons.schedule, size: 14, color: task.isOverdue ? colors.error : const Color(0xFFB2BEC3)),
                        const SizedBox(width: 4),
                        Text(
                          task.dueDateFormatted,
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: task.isOverdue ? colors.error : const Color(0xFF636E72)),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: priColor.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                        child: Text(_priorityLabel(), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: priColor)),
                      ),
                      const Spacer(),
                      if (task.assignees.isNotEmpty)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: task.assignees.take(3).map((a) => Container(
                                width: 24,
                                height: 24,
                                margin: const EdgeInsets.only(left: 2),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(colors: [colors.primary.withOpacity(0.6), colors.primary]),
                                  shape: BoxShape.circle,
                                ),
                                child: Center(child: Text(a.initials, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700))),
                              )).toList(),
                        ),
                      if (task.assignees.length > 3)
                        Container(
                          width: 24, height: 24,
                          margin: const EdgeInsets.only(left: 2),
                          decoration: BoxDecoration(color: const Color(0xFFF1F2F6), shape: BoxShape.circle),
                          child: Center(child: Text('+${task.assignees.length - 3}', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700, color: Color(0xFF636E72)))),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showTaskDetail(BuildContext context, Task task) {
    Navigator.of(context).push(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => TaskDetailScreen(task: task),
        transitionsBuilder: (_, animation, __, child) {
          const begin = Offset(0, 1);
          const end = Offset.zero;
          final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: Curves.easeOutCubic));
          return SlideTransition(position: animation.drive(tween), child: child);
        },
      ),
    );
  }
}

class TaskDetailScreen extends StatelessWidget {
  final Task task;
  const TaskDetailScreen({super.key, required this.task});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<AppColors>()!;
    final priColor = task.priority == 'urgent' ? colors.error : task.priority == 'high' ? const Color(0xFFE17055) : colors.primary;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18), onPressed: () => Navigator.pop(context)),
        title: const Text('Szczegóły zadania'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(color: priColor.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 6, height: 6, decoration: BoxDecoration(color: priColor, shape: BoxShape.circle)),
                const SizedBox(width: 6),
                Text(task.priority == 'urgent' ? 'Pilny' : task.priority == 'high' ? 'Wysoki' : task.priority == 'low' ? 'Niski' : 'Normalny',
                    style: TextStyle(color: priColor, fontWeight: FontWeight.w600, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(task.title, style: Theme.of(context).textTheme.headlineSmall),
          if (task.description.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(task.description, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xFF636E72), height: 1.6)),
          ],
          const SizedBox(height: 24),
          _InfoRow(icon: Icons.calendar_today, label: 'Termin', value: task.dueDate != null ? DateFormat('d MMMM yyyy', 'pl').format(task.dueDate!) : 'Brak'),
          const SizedBox(height: 12),
          _InfoRow(icon: Icons.watch_later, label: 'Status',
            value: {'todo': 'Do zrobienia', 'in_progress': 'W toku', 'done': 'Zrobione', 'cancelled': 'Anulowane'}[task.status] ?? task.status),
          const SizedBox(height: 12),
          if (task.assignees.isNotEmpty)
            _InfoRow(
              icon: Icons.people,
              label: 'Przypisani',
              value: task.assignees.map((a) => a.fullName).join(', '),
            ),
          if (task.project != null) ...[
            const SizedBox(height: 12),
            _InfoRow(icon: Icons.folder, label: 'Projekt', value: task.project!.name),
          ],
          if (task.updates.isNotEmpty) ...[
            const SizedBox(height: 28),
            Text('Aktualizacje', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            ...task.updates.reversed.map((u) => Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFF8F9FA), borderRadius: BorderRadius.circular(16)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          width: 28, height: 28,
                          decoration: BoxDecoration(gradient: LinearGradient(colors: [colors.primary.withOpacity(0.6), colors.primary]), shape: BoxShape.circle),
                          child: Center(child: Text(u.author?.initials ?? '?', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700))),
                        ),
                        const SizedBox(width: 8),
                        Text(u.author?.fullName ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        const Spacer(),
                        Text(u.createdAt != null ? DateFormat('d MMM HH:mm', 'pl').format(u.createdAt!) : '', style: const TextStyle(fontSize: 11, color: Color(0xFFB2BEC3))),
                      ]),
                      const SizedBox(height: 8),
                      Text(u.text, style: const TextStyle(fontSize: 14, color: Color(0xFF2D3436))),
                    ],
                  ),
                )),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFFB2BEC3)),
        const SizedBox(width: 10),
        Text('$label: ', style: const TextStyle(fontSize: 13, color: Color(0xFF636E72))),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF2D3436)))),
      ],
    );
  }
}
