class Project {
  final String id;
  final String name;
  final String clientName;
  final String? clientContact;
  final String? clientEmail;
  final String status;
  final String? offerType;
  final String? description;
  final ProjectUser? owner;
  final Pricing? pricing;
  final DateTime? createdAt;

  Project({
    required this.id,
    required this.name,
    this.clientName = '',
    this.clientContact,
    this.clientEmail,
    this.status = 'active',
    this.offerType,
    this.description,
    this.owner,
    this.pricing,
    this.createdAt,
  });

  factory Project.fromJson(Map<String, dynamic> json) => Project(
        id: json['_id'] ?? '',
        name: json['name'] ?? '',
        clientName: json['clientName'] ?? '',
        clientContact: json['clientContact'],
        clientEmail: json['clientEmail'],
        status: json['status'] ?? 'active',
        offerType: json['offerType'],
        description: json['description'],
        owner: json['owner'] != null && json['owner'] is Map ? ProjectUser.fromJson(json['owner']) : null,
        pricing: json['pricing'] != null ? Pricing.fromJson(json['pricing']) : null,
        createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      );
}

class ProjectUser {
  final String id;
  final String firstName;
  final String lastName;
  final String? email;

  ProjectUser({required this.id, required this.firstName, required this.lastName, this.email});

  factory ProjectUser.fromJson(Map<String, dynamic> json) => ProjectUser(
        id: json['_id'] ?? '',
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        email: json['email'],
      );

  String get fullName => '$firstName $lastName';
}

class Pricing {
  final double phase1;
  final double phase2;
  final double phase3;
  final double phase4;
  final double total;

  Pricing({
    this.phase1 = 0,
    this.phase2 = 0,
    this.phase3 = 0,
    this.phase4 = 0,
    this.total = 0,
  });

  factory Pricing.fromJson(Map<String, dynamic> json) => Pricing(
        phase1: (json['phase1'] ?? 0).toDouble(),
        phase2: (json['phase2'] ?? 0).toDouble(),
        phase3: (json['phase3'] ?? 0).toDouble(),
        phase4: (json['phase4'] ?? 0).toDouble(),
        total: (json['total'] ?? 0).toDouble(),
      );
}
