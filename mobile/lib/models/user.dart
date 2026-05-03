class AppUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String? avatar;

  AppUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.role = 'employee',
    this.avatar,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['_id'] ?? json['id'] ?? '',
        email: json['email'] ?? '',
        firstName: json['firstName'] ?? '',
        lastName: json['lastName'] ?? '',
        role: json['role'] ?? 'employee',
        avatar: json['avatar'],
      );

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}';
}
