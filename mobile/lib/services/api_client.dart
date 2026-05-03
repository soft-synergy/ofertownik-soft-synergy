import '../models/user.dart';
import '../models/task.dart';
import '../models/project.dart';
import 'api_service.dart';

class ApiClient {
  final ApiService _api = ApiService();

  // ── Auth ──
  Future<Map<String, dynamic>> login(String email, String password) async {
    final data = await _api.post('/auth/login', body: {'email': email, 'password': password});
    if (data != null) {
      await _api.setToken(data['token']);
    }
    return data;
  }

  Future<AppUser> me() async {
    final data = await _api.get('/auth/me');
    return AppUser.fromJson(data['user']);
  }

  Future<List<AppUser>> getUsers() async {
    final data = await _api.get('/auth/users');
    return (data as List).map((j) => AppUser.fromJson(j)).toList();
  }

  void logout() => _api.setToken(null);

  // ── Tasks ──
  Future<List<Task>> getTasks({String? assignee, String? status, String? priority, String? project}) async {
    final params = <String, String>{'limit': '500'};
    if (assignee != null) params['assignee'] = assignee;
    if (status != null) params['status'] = status;
    if (priority != null) params['priority'] = priority;
    if (project != null) params['project'] = project;
    final data = await _api.get('/tasks', params: params);
    if (data is List) return data.map((j) => Task.fromJson(j)).toList();
    return [];
  }

  Future<Task> getTask(String id) async {
    final data = await _api.get('/tasks/$id');
    return Task.fromJson(data);
  }

  Future<Task> createTask(Map<String, dynamic> body) async {
    final data = await _api.post('/tasks', body: body);
    return Task.fromJson(data);
  }

  Future<Task> updateTask(String id, Map<String, dynamic> body) async {
    final data = await _api.put('/tasks/$id', body: body);
    return Task.fromJson(data);
  }

  Future<void> deleteTask(String id) async {
    await _api.delete('/tasks/$id');
  }

  // ── Projects ──
  Future<List<Project>> getProjects({int limit = 50}) async {
    final data = await _api.get('/projects', params: {'limit': limit.toString()});
    if (data is Map && data['projects'] != null) return (data['projects'] as List).map((j) => Project.fromJson(j)).toList();
    return [];
  }

  Future<Project> getProject(String id) async {
    final data = await _api.get('/projects/$id');
    return Project.fromJson(data);
  }

  // ── Offers/Quotes ──
  Future<List<Project>> getQuotes() async {
    // Projects with offer statuses serve as quotes
    final data = await _api.get('/projects', params: {'limit': '200'});
    if (data is Map && data['projects'] != null) {
      final all = (data['projects'] as List).map((j) => Project.fromJson(j)).toList();
      return all.where((p) => ['accepted', 'to_final_estimation', 'to_prepare_final_offer'].contains(p.status)).toList();
    }
    return [];
  }
}
