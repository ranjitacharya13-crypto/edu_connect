package com.educonnect.edustaff;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SecureSession {
    private static final String KEY_ALIAS = "educonnect.session.key";
    private static final String PREFS = "educonnect.secure-session";
    private static final String TOKEN = "token";
    private static final int TAG_LENGTH_BITS = 128;

    private final SharedPreferences preferences;

    SecureSession(Context context) {
        preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    synchronized String readToken() {
        String stored = preferences.getString(TOKEN, null);
        if (stored == null) return null;
        try {
            byte[] encrypted = Base64.decode(stored, Base64.NO_WRAP);
            int ivLength = encrypted[0] & 0xff;
            byte[] iv = new byte[ivLength];
            byte[] ciphertext = new byte[encrypted.length - ivLength - 1];
            System.arraycopy(encrypted, 1, iv, 0, ivLength);
            System.arraycopy(encrypted, ivLength + 1, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception error) {
            clear();
            return null;
        }
    }

    synchronized void saveToken(String token) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        byte[] encrypted = new byte[iv.length + ciphertext.length + 1];
        encrypted[0] = (byte) iv.length;
        System.arraycopy(iv, 0, encrypted, 1, iv.length);
        System.arraycopy(ciphertext, 0, encrypted, iv.length + 1, ciphertext.length);
        preferences.edit().putString(TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP)).apply();
    }

    synchronized void clear() {
        preferences.edit().remove(TOKEN).apply();
    }

    private SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build());
        return generator.generateKey();
    }
}