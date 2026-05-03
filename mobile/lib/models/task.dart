class TaskUser {
  final String id;
  final String firstName;
  final String lastName;
  final String? email;

  TaskUser({required this.id, required this.firstName, required this.lastName, this.email});

  factory TaskUser.fromJson(Map<String, dynamic> json) => TaskUser(
        id: json['_id'] ?? '',
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        email: json['email'],
      );

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}';
}

class TaskProject {
  final String id;
  final String name;
  final String? clientName;
  final String? status;

  TaskProject({required this.id, required this.name, this.clientName, this.status});

  factory TaskProject.fromJson(Map<String, dynamic> json) => TaskProject(
        id: json['_id'] ?? '',
        name: json['name'] ?? '',
        clientName: json['clientName'],
        status: json['status'],
      );
}

class TaskUpdate {
  final String text;
  final TaskUser? author;
  final DateTime? createdAt;

  TaskUpdate({required this.text, this.author, this.createdAt});

  factory TaskUpdate.fromJson(Map<String, dynamic> json) => TaskUpdate(
        text: json['text'] ?? '',
        author: json['author'] != null ? TaskUser.fromJson(json['author']) : null,
        createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      );
}

class TaskAttachment {
  final String id;
  final String filename;
  final String originalname;
  final String mimetype;
  final int size;

  TaskAttachment({
    required this.id,
    required this.filename,
    required this.originalname,
    required this.mimetype,
    required this.size,
  });

  factory TaskAttachment.fromJson(Map<String, dynamic> json) => TaskAttachment(
        id: json['_id'] ?? '',
        filename: json['filename'] ?? '',
        originalname: json['originalname'] ?? '',
        mimetype: json['mimetype'] ?? '',
        size: json['size'] ?? 0,
      );
}

class Task {
  final String id;
  final String title;
  final String description;
  final String status;
  final String priority;
  final DateTime? dueDate;
  final int? dueTimeMinutes;
  final TaskUser? assignee;
  final List<TaskUser> assignees;
  final List<TaskUser> watchers;
  final TaskProject? project;
  final TaskUser? createdBy;
  final bool isPrivate;
  final List<TaskUpdate> updates;
  final List<TaskAttachment> attachments;
  final DateTime? createdAt;
  final DateTime? completedAt;

  Task({
    required this.id,
    required this.title,
    this.description = '',
    this.status = 'todo',
    this.priority = 'normal',
    this.dueDate,
    this.dueTimeMinutes,
    this.assignee,
    this.assignees = const [],
    this.watchers = const [],
    this.project,
    this.createdBy,
    this.isPrivate = false,
    this.updates = const [],
    this.attachments = const [],
    this.createdAt,
    this.completedAt,
  });

  factory Task.fromJson(Map<String, dynamic> json) => Task(
        id: json['_id'] ?? '',
        title: json['title'] ?? '',
        description: json['description'] ?? '',
        status: json['status'] ?? 'todo',
        priority: json['priority'] ?? 'normal',
        dueDate: json['dueDate'] != null ? DateTime.tryParse(json['dueDate']) : null,
        dueTimeMinutes: json['dueTimeMinutes'],
        assignee: json['assignee'] != null && json['assignee'] is Map ? TaskUser.fromJson(json['assignee']) : null,
        assignees: json['assignees'] != null && json['assignees'] is List ? (json['assignees'] as List).where((a) => a is Map).map((a) => TaskUser.fromJson(a as Map<String, dynamic>)).toList() : [],
        watchers: json['watchers'] != null && json['watchers'] is List ? (json['watchers'] as List).where((w) => w is Map).map((w) => TaskUser.fromJson(w as Map<String, dynamic>)).toList() : [],
        project: json['project'] != null && json['project'] is Map ? TaskProject.fromJson(json['project']) : null,
        createdBy: json['createdBy'] != null && json['createdBy'] is Map ? TaskUser.fromJson(json['createdBy']) : null,
        isPrivate: json['isPrivate'] ?? false,
        updates: json['updates'] != null && json['updates'] is List ? (json['updates'] as List).where((u) => u is Map).map((u) => TaskUpdate.fromJson(u as Map<String, dynamic>)).toList() : [],
        attachments: json['attachments'] != null && json['attachments'] is List ? (json['attachments'] as List).where((a) => a is Map).map((a) => TaskAttachment.fromJson(a as Map<String, dynamic>)).toList() : [],
        createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
        completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt']) : null,
      );

  bool get isOverdue => status != 'done' && dueDate != null && dueDate!.isBefore(DateTime.now().subtract(const Duration(days: 1)));

  String get dueDateFormatted {
    if (dueDate == null) return '—';
    final months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
    return '${dueDate!.day} ${months[dueDate!.month - 1]}';
  }
}
