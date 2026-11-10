package com.educonnect.edustaff;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class NativeApi {
    static final class ApiException extends IOException {
        final int statusCode;

        ApiException(int statusCode, String message) {
            super(message);
            this.statusCode = statusCode;
        }
    }

    private final String baseUrl;
    private final SecureSession session;

    NativeApi(String baseUrl, SecureSession session) {
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.session = session;
    }

    private static String normalizeBaseUrl(String value) {
        if (value == null || value.trim().isEmpty()) return "";
        String base = value.trim().replaceAll("/+$", "");
        try {
            URI uri = URI.create(base);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || !uri.getPath().replaceAll("/+$", "").endsWith("/api")) return "";
            return base;
        } catch (IllegalArgumentException error) {
            return "";
        }
    }

    JSONObject get(String path) throws IOException {
        return request("GET", path, null);
    }

    JSONArray getArray(String path) throws IOException {
        HttpURLConnection connection = open(path, "GET", "application/json");
        try {
            int status = connection.getResponseCode();
            byte[] response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw apiException(status, response);
            try {
                return new JSONArray(new String(response, StandardCharsets.UTF_8));
            } catch (JSONException error) {
                throw new IOException("The server returned an invalid response.", error);
            }
        } finally {
            connection.disconnect();
        }
    }

    JSONObject post(String path, JSONObject body) throws IOException {
        return request("POST", path, body);
    }

    JSONObject patch(String path, JSONObject body) throws IOException {
        return request("PATCH", path, body);
    }

    void delete(String path) throws IOException {
        request("DELETE", path, null);
    }

    JSONObject request(String method, String path, JSONObject body) throws IOException {
        HttpURLConnection connection = open(path, method, "application/json");
        try {
            if (body != null) {
                connection.setDoOutput(true);
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }
            int status = connection.getResponseCode();
            byte[] response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw apiException(status, response);
            if (response.length == 0) return new JSONObject();
            try {
                return new JSONObject(new String(response, StandardCharsets.UTF_8));
            } catch (JSONException error) {
                throw new IOException("The server returned an invalid response.", error);
            }
        } finally {
            connection.disconnect();
        }
    }

    byte[] download(String path) throws IOException {
        HttpURLConnection connection = open(path, "GET", "text/csv");
        try {
            int status = connection.getResponseCode();
            byte[] response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw apiException(status, response);
            return response;
        } finally {
            connection.disconnect();
        }
    }

    JSONObject uploadCsv(String path, String filename, byte[] contents) throws IOException {
        String boundary = "EduConnect-" + System.nanoTime();
        HttpURLConnection connection = open(path, "POST", "multipart/form-data; boundary=" + boundary);
        connection.setDoOutput(true);
        connection.setChunkedStreamingMode(0);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\""
                    + filename.replace("\"", "") + "\"\r\nContent-Type: text/csv\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            output.write(contents);
            output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        }
        try {
            int status = connection.getResponseCode();
            byte[] response = readResponse(connection, status);
            if (status < 200 || status >= 300) throw apiException(status, response);
            try {
                return new JSONObject(new String(response, StandardCharsets.UTF_8));
            } catch (JSONException error) {
                throw new IOException("The server returned an invalid response.", error);
            }
        } finally {
            connection.disconnect();
        }
    }

    static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private HttpURLConnection open(String path, String method, String accept) throws IOException {
        if (baseUrl.isEmpty()) {
            throw new IOException("Android API is not configured. Set VITE_API_BASE_URL to the deployed HTTPS API ending in /api, then rebuild.");
        }
        URL url = new URL(baseUrl + (path.startsWith("/") ? path : "/" + path));
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.setRequestProperty("Accept", accept);
        if ("application/json".equals(accept)) connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        String token = session.readToken();
        if (token != null && !token.isEmpty()) connection.setRequestProperty("Authorization", "Bearer " + token);
        return connection;
    }

    private static byte[] readResponse(HttpURLConnection connection, int status) throws IOException {
        InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (input == null) return new byte[0];
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = stream.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }

    private static ApiException apiException(int status, byte[] response) {
        String message = "Request failed (" + status + ").";
        try {
            JSONObject payload = new JSONObject(new String(response, StandardCharsets.UTF_8));
            if (payload.has("message")) message = payload.optString("message", message);
            JSONArray errors = payload.optJSONArray("errors");
            if (errors != null && errors.length() > 0) message = errors.optString(0, message);
        } catch (JSONException ignored) {
            // Keep the status-only message when the server does not return JSON.
        }
        return new ApiException(status, message);
    }
}