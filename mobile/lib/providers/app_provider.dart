import 'package:flutter/material.dart';
import '../models/user.dart';
import '../models/task.dart';
import '../models/project.dart';
import '../services/api_client.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _client = ApiClient();
  AppUser? _user;
  bool _loading = false;
  String? _error;
  bool _initialized = false;

  AppUser? get user => _user;
  bool get loading => _loading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;
  bool get initialized => _initialized;

  Future<void> tryAutoLogin() async {
    _initialized = true;
    try {
      final user = await _client.me();
      _user = user;
    } catch (_) {}
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final data = await _client.login(email, password);
      _user = AppUser.fromJson(data['user']);
      _loading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  void logout() {
    _client.logout();
    _user = null;
    notifyListeners();
  }
}

class TaskProvider extends ChangeNotifier {
  final ApiClient _client = ApiClient();
  List<Task> _tasks = [];
  bool _loading = false;
  String? _error;

  List<Task> get tasks => _tasks;
  bool get loading => _loading;
  String? get error => _error;

  List<Task> get todoTasks => _tasks.where((t) => t.status == 'todo').toList();
  List<Task> get inProgressTasks => _tasks.where((t) => t.status == 'in_progress').toList();
  List<Task> get doneTasks => _tasks.where((t) => t.status == 'done').toList();
  List<Task> get cancelledTasks => _tasks.where((t) => t.status == 'cancelled').toList();

  int get totalTasks => _tasks.length;
  int get overdueTasks => _tasks.where((t) => t.isOverdue).length;

  Future<void> loadTasks({String? assignee, String? status, String? priority}) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _tasks = await _client.getTasks(assignee: assignee, status: status, priority: priority);
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> toggleTaskStatus(String taskId) async {
    final task = _tasks.firstWhere((t) => t.id == taskId);
    final newStatus = task.status == 'done' ? 'todo' : 'done';
    task.status; // ignore
    try {
      await _client.updateTask(taskId, {'status': newStatus});
      await loadTasks();
    } catch (_) {}
  }

  Future<void> moveTask(String taskId, String newStatus) async {
    try {
      await _client.updateTask(taskId, {'status': newStatus});
      await loadTasks();
    } catch (_) {}
  }
}

class ProjectProvider extends ChangeNotifier {
  final ApiClient _client = ApiClient();
  List<Project> _projects = [];
  List<Project> _quotes = [];
  bool _loading = false;
  String? _error;

  List<Project> get projects => _projects;
  List<Project> get quotes => _quotes;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> loadProjects() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _projects = await _client.getProjects();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> loadQuotes() async {
    try {
      _quotes = await _client.getQuotes();
    } catch (e) {
      _error = e.toString().replaceAll('Exception: ', '');
    }
    notifyListeners();
  }
}
