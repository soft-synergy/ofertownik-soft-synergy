import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_config.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  ApiException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

class ApiService {
  static final ApiService _instance = ApiService._();
  factory ApiService() => _instance;
  ApiService._();

  String? _token;

  Future<void> setToken(String? token) async {
    _token = token;
    final prefs = await SharedPreferences.getInstance();
    if (token != null) {
      await prefs.setString('auth_token', token);
    } else {
      await prefs.remove('auth_token');
    }
  }

  Future<String?> getToken() async {
    if (_token != null) return _token;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    return _token;
  }

  Map<String, String> _headers({bool auth = true}) {
    final headers = <String, String>{'Content-Type': 'application/json'};
    if (auth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<dynamic> get(String path, {Map<String, String>? params}) async {
    final token = await getToken();
    if (token != null) _token = token;

    var uri = Uri.parse('${ApiConfig.baseUrl}$path');
    if (params != null && params.isNotEmpty) {
      uri = uri.replace(queryParameters: params);
    }

    final response = await http.get(uri, headers: _headers()).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> post(String path, {Map<String, dynamic>? body}) async {
    final token = await getToken();
    if (token != null) _token = token;

    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: _headers(),
      body: body != null ? jsonEncode(body) : null,
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> put(String path, {Map<String, dynamic>? body}) async {
    final token = await getToken();
    if (token != null) _token = token;

    final response = await http.put(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: _headers(),
      body: body != null ? jsonEncode(body) : null,
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  Future<dynamic> delete(String path) async {
    final token = await getToken();
    if (token != null) _token = token;

    final response = await http.delete(
      Uri.parse('${ApiConfig.baseUrl}$path'),
      headers: _headers(),
    ).timeout(ApiConfig.timeout);
    return _handleResponse(response);
  }

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.body.isEmpty) return null;
      return jsonDecode(response.body);
    }
    String message = 'Request failed';
    try {
      final body = jsonDecode(response.body);
      message = body['message'] ?? body['error'] ?? message;
    } catch (_) {}
    throw ApiException(message, response.statusCode);
  }
}
