package com.velora.plugins;

import android.app.WallpaperManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import android.view.WindowManager;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "WallpaperSetter")
public class WallpaperSetterPlugin extends Plugin {

    private static final String TAG = "WallpaperSetter";
    private static final int MAX_DOWNLOAD_BYTES = 24 * 1024 * 1024;
    private static final ExecutorService IO_EXECUTOR = Executors.newFixedThreadPool(2);

    private int targetDimension() {
        WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return 2560;
        android.util.DisplayMetrics metrics = new android.util.DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(metrics);
        return Math.max(metrics.widthPixels, metrics.heightPixels) * 2;
    }

    private Bitmap decodeSized(byte[] bytes) {
        BitmapFactory.Options probe = new BitmapFactory.Options();
        probe.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, probe);
        int target = targetDimension();
        int sample = 1;
        while (probe.outWidth / (sample * 2) >= target && probe.outHeight / (sample * 2) >= target) {
            sample *= 2;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        options.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    private Bitmap decodeBitmap(String imageUrl) throws Exception {
        if (imageUrl.startsWith("data:image")) {
            String base64 = imageUrl.substring(imageUrl.indexOf(',') + 1)
                    .replaceAll("\\s", "")
                    .trim();
            byte[] bytes = Base64.decode(base64.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            if (bytes.length > MAX_DOWNLOAD_BYTES) throw new IllegalArgumentException("Image is too large");
            return decodeSized(bytes);
        }

        URL url = new URL(imageUrl);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setDoInput(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.connect();

        try (InputStream inputStream = connection.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_DOWNLOAD_BYTES) throw new IllegalArgumentException("Image is too large");
                output.write(buffer, 0, read);
            }
            return decodeSized(output.toByteArray());
        } finally {
            connection.disconnect();
        }
    }

    @PluginMethod
    public void setWallpaper(PluginCall call) {
        String imageUrl = call.getString("url");
        String target = call.getString("target", "both");

        if (imageUrl == null || imageUrl.isEmpty()) {
            call.reject("Image URL is required");
            return;
        }

        // Run on background thread
        IO_EXECUTOR.execute(() -> {
            try {
                Bitmap bitmap = decodeBitmap(imageUrl);

                if (bitmap == null) {
                    call.reject("Failed to decode image");
                    return;
                }

                WallpaperManager wallpaperManager = WallpaperManager.getInstance(getContext());

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    switch (target) {
                        case "home":
                            wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM);
                            break;
                        case "lock":
                            wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
                            break;
                        case "both":
                        default:
                            wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM);
                            wallpaperManager.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
                            break;
                    }
                } else {
                    // Older Android - can only set system wallpaper
                    wallpaperManager.setBitmap(bitmap);
                }

                bitmap.recycle();

                JSObject result = new JSObject();
                result.put("success", true);

                // Return on main thread
                getActivity().runOnUiThread(() -> call.resolve(result));

            } catch (Exception e) {
                Log.e(TAG, "Error setting wallpaper: " + e.getMessage(), e);
                getActivity().runOnUiThread(() -> call.reject("Failed to set wallpaper: " + e.getMessage()));
            }
        });
    }
}
