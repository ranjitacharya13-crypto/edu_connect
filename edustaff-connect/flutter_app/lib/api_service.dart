import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiService {
  ApiService({String? baseUrl}) : baseUrl = (baseUrl ?? const String.fromEnvironment('API_BASE_URL')).replaceAll(RegExp(r'/+$'), '');

  final String baseUrl;
  static const _tokenKey = 'edustaff_token';
  static const _secureStorage = FlutterSecureStorage();

  bool get isConfigured => baseUrl.startsWith('https://') && baseUrl.endsWith('/api');

  Future<String?> readToken() => _secureStorage.read(key: _tokenKey);
  Future<void> saveToken(String token) => _secureStorage.write(key: _tokenKey, value: token);
  Future<void> clearToken() => _secureStorage.delete(key: _tokenKey);

  Uri _uri(String path, [Map<String, dynamic>? query]) {
    if (!isConfigured) {
      throw const ApiException('The app API URL is not configured. Rebuild with API_BASE_URL set to the public HTTPS API address ending in /api.');
    }
    final uri = Uri.parse('$baseUrl/${path.replaceFirst(RegExp(r'^/+'), '')}');
    if (query == null) return uri;
    final params = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value == null || value == '') continue;
      params[entry.key] = value is List ? value.join(',') : '$value';
    }
    return uri.replace(queryParameters: params.isEmpty ? null : params);
  }

  Future<Map<String, String>> _headers({bool auth = true}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (Uri.parse(baseUrl).host.endsWith('.ngrok-free.dev')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    if (auth) {
      final token = await readToken();
      if (token != null && token.isNotEmpty) headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  Future<dynamic> request(String method, String path, {Map<String, dynamic>? body, Map<String, dynamic>? query, bool auth = true}) async {
    final headers = await _headers(auth: auth);
    if (body != null) headers['Content-Type'] = 'application/json';
    final request = http.Request(method, _uri(path, query))..headers.addAll(headers);
    if (body != null) request.body = jsonEncode(body);
    final streamed = await http.Client().send(request).timeout(const Duration(seconds: 25));
    final response = await http.Response.fromStream(streamed);
    if (response.statusCode == 204) return null;
    dynamic data;
    try {
      data = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      throw const ApiException('The server returned an invalid response. Check the configured API address.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (response.statusCode == 401 && auth && !path.contains('/auth/login') && !path.contains('/auth/signup')) {
        await clearToken();
      }
      throw ApiException(data is Map ? '${data['message'] ?? data['error'] ?? 'Request failed (${response.statusCode}).'}' : 'Request failed (${response.statusCode}).', response.statusCode);
    }
    return data;
  }

  Future<dynamic> upload(String path, String filename, List<int> bytes, {String field = 'file', bool auth = true}) async {
    final request = http.MultipartRequest('POST', _uri(path));
    request.headers.addAll(await _headers(auth: auth));
    request.files.add(http.MultipartFile.fromBytes(field, bytes, filename: filename));
    final streamed = await request.send().timeout(const Duration(seconds: 45));
    final response = await http.Response.fromStream(streamed);
    dynamic data;
    try {
      data = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      throw const ApiException('The server returned an invalid upload response.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(data is Map ? '${data['message'] ?? 'Upload failed.'}' : 'Upload failed (${response.statusCode}).', response.statusCode);
    }
    return data;
  }

  Future<Map<String, dynamic>> signIn(String email, String password) async {
    final result = await request('POST', '/auth/login', body: {'email': email.trim(), 'password': password}, auth: false);
    await saveToken(result['token'] as String);
    return Map<String, dynamic>.from(result['user'] as Map);
  }

  Future<Map<String, dynamic>> signUp(Map<String, dynamic> details) async {
    final result = await request('POST', '/auth/signup', body: details, auth: false);
    await saveToken(result['token'] as String);
    return Map<String, dynamic>.from(result['user'] as Map);
  }
}

class ApiException implements Exception {
  const ApiException(this.message, [this.statusCode]);
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}
