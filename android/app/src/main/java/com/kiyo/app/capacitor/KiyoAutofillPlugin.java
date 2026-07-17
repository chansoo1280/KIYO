package com.kiyo.app.capacitor;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.kiyo.app.autofill.AutofillRepository;

import java.lang.reflect.Method;
import java.util.List;
import android.util.Pair;

@CapacitorPlugin(name = "KiyoAutofill")
public class KiyoAutofillPlugin extends Plugin {

    private static final String TAG = "KiyoAutofillPlugin";
    private static final String AUTO_FILL_SERVICE_CLASS = "android.service.autofill.AutofillManager";
    private static final String SETTINGS_CLASS = "android.provider.Settings";

    private AutofillRepository autofillRepository;

    @Override
    public void load() {
        super.load();
        Context context = getContext();
        if (context != null) {
            autofillRepository = new AutofillRepository(context);
            Log.d(TAG, "AutofillRepository initialized");
        }
    }

    @PluginMethod
    public void isAutofillEnabled(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            JSObject result = new JSObject();
            result.put("enabled", false);
            call.resolve(result);
            return;
        }

        try {
            Object autofillManager = getAutofillManager(context);
            boolean enabled = autofillManager != null && invokeBooleanMethod(autofillManager, "isEnabled");
            boolean hasService = autofillManager != null && invokeBooleanMethod(autofillManager, "hasEnabledAutofillServices");
            String servicePackageName = autofillManager != null ? invokeStringMethod(autofillManager, "getAutofillServicePackageName") : null;

            Log.d(TAG, "isAutofillEnabled: enabled=" + enabled + ", hasService=" + hasService);

            JSObject result = new JSObject();
            result.put("enabled", enabled);
            result.put("hasService", hasService);
            result.put("servicePackageName", servicePackageName);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking autofill status", e);
            call.reject("Failed to check autofill status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestAutofillEnable(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Autofill requires Android 8.0 (API 26) or higher");
            return;
        }

        try {
            // Open autofill settings using reflection to avoid compile-time dependency
            Class<?> settingsClass = Class.forName(SETTINGS_CLASS);
            String actionAutoFillSettings = (String) settingsClass.getField("ACTION_AUTO_FILL_SETTINGS").get(null);
            
            Intent intent = new Intent(actionAutoFillSettings);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);

            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Error opening autofill settings", e);
            call.reject("Failed to open autofill settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void ping(PluginCall call) {
        // Simple test method to verify plugin communication
        Log.d(TAG, "Ping received from React");
        JSObject result = new JSObject();
        result.put("pong", true);
        result.put("timestamp", System.currentTimeMillis());
        result.put("message", "KiyoAutofill plugin is working");
        call.resolve(result);
    }

    @PluginMethod
    public void getAutofillServiceInfo(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("Context is null");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Autofill requires Android 8.0 (API 26) or higher");
            return;
        }

        try {
            Object autofillManager = getAutofillManager(context);
            if (autofillManager == null) {
                call.reject("AutofillManager not available");
                return;
            }

            String servicePackageName = invokeStringMethod(autofillManager, "getAutofillServicePackageName");
            boolean isOurService = "com.kiyo.app".equals(servicePackageName);
            boolean isEnabled = invokeBooleanMethod(autofillManager, "isEnabled");
            boolean hasEnabledServices = invokeBooleanMethod(autofillManager, "hasEnabledAutofillServices");

            JSObject result = new JSObject();
            result.put("servicePackageName", servicePackageName);
            result.put("isOurService", isOurService);
            result.put("isEnabled", isEnabled);
            result.put("hasEnabledServices", hasEnabledServices);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting autofill service info", e);
            call.reject("Failed to get autofill service info: " + e.getMessage());
        }
    }

    // ==================== Autofill Account Management ====================

    @PluginMethod
    public void syncAccounts(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        // Get accounts from the call (passed from React)
        JSArray accountsArray = call.getArray("accounts");
        if (accountsArray == null || accountsArray.length() == 0) {
            call.reject("No accounts provided");
            return;
        }

        int syncedCount = 0;
        int errorCount = 0;

        for (int i = 0; i < accountsArray.length(); i++) {
            try {
                org.json.JSONObject accountObj = accountsArray.getJSONObject(i);
                
                String username = accountObj.getString("username");
                String password = accountObj.getString("password");
                String title = accountObj.optString("title", null);
                String packageName = accountObj.optString("packageName", null);
                String domain = accountObj.optString("domain", null);
                boolean favorite = accountObj.optBoolean("favorite", false);

                if (username.isEmpty() || password.isEmpty()) {
                    Log.w(TAG, "Skipping account with empty username/password");
                    errorCount++;
                    continue;
                }

                AutofillRepository.AutofillAccount account = new AutofillRepository.AutofillAccount(
                    -1L,  // id (auto-generated)
                    username,
                    password,
                    title,
                    packageName,
                    domain,
                    System.currentTimeMillis(),
                    System.currentTimeMillis(),
                    favorite
                );

                autofillRepository.upsertAccount(account);
                syncedCount++;
            } catch (Exception e) {
                Log.e(TAG, "Error syncing account at index " + i, e);
                errorCount++;
            }
        }

        JSObject result = new JSObject();
        result.put("syncedCount", syncedCount);
        result.put("errorCount", errorCount);
        result.put("totalProcessed", accountsArray.length());
        call.resolve(result);
    }

    @PluginMethod
    public void getAccounts(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        String packageName = call.getString("packageName");
        String domain = call.getString("domain");
        String username = call.getString("username");

        List<AutofillRepository.AutofillAccount> accounts;

        if (packageName != null && !packageName.isEmpty()) {
            accounts = autofillRepository.findByPackageName(packageName);
        } else if (domain != null && !domain.isEmpty()) {
            accounts = autofillRepository.findByDomain(domain);
        } else if (username != null && !username.isEmpty()) {
            accounts = autofillRepository.searchByUsername(username);
        } else {
            accounts = autofillRepository.getAllAccounts();
        }

        JSArray accountsArray = new JSArray();
        for (AutofillRepository.AutofillAccount account : accounts) {
            JSObject accountObj = new JSObject();
            accountObj.put("id", account.id);
            accountObj.put("username", account.username);
            accountObj.put("password", account.password);
            accountObj.put("title", account.title);
            accountObj.put("packageName", account.packageName);
            accountObj.put("domain", account.domain);
            accountObj.put("createdAt", account.createdAt);
            accountObj.put("updatedAt", account.updatedAt);
            accountObj.put("favorite", account.favorite);
            accountsArray.put(accountObj);
        }

        JSObject result = new JSObject();
        result.put("accounts", accountsArray);
        result.put("count", accounts.size());
        call.resolve(result);
    }

    @PluginMethod
    public void addAccount(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        String username = call.getString("username");
        String password = call.getString("password");
        String title = call.getString("title");
        String packageName = call.getString("packageName");
        String domain = call.getString("domain");
        boolean favorite = call.getBoolean("favorite", false);

        if (username == null || username.isEmpty() || password == null || password.isEmpty()) {
            call.reject("Username and password are required");
            return;
        }

        AutofillRepository.AutofillAccount account = new AutofillRepository.AutofillAccount(
            -1L,  // id (auto-generated)
            username,
            password,
            title,
            packageName,
            domain,
            System.currentTimeMillis(),
            System.currentTimeMillis(),
            favorite
        );

        long id = autofillRepository.insertAccount(account);

        JSObject result = new JSObject();
        result.put("id", id);
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void updateAccount(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        long id = call.getLong("id");
        if (id <= 0) {
            call.reject("Valid account ID is required");
            return;
        }

        AutofillRepository.AutofillAccount existing = autofillRepository.getAccountById(id);
        if (existing == null) {
            call.reject("Account not found");
            return;
        }

        String username = call.getString("username", existing.username);
        String password = call.getString("password", existing.password);
        String title = call.getString("title", existing.title);
        String packageName = call.getString("packageName", existing.packageName);
        String domain = call.getString("domain", existing.domain);
        boolean favorite = call.getBoolean("favorite", existing.favorite);

        AutofillRepository.AutofillAccount updated = new AutofillRepository.AutofillAccount(
            id,
            username,
            password,
            title,
            packageName,
            domain,
            existing.createdAt,
            System.currentTimeMillis(),
            favorite
        );

        int count = autofillRepository.updateAccount(updated);

        JSObject result = new JSObject();
        result.put("updated", count > 0);
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void deleteAccount(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        long id = call.getLong("id");
        if (id <= 0) {
            call.reject("Valid account ID is required");
            return;
        }

        int count = autofillRepository.deleteAccount(id);

        JSObject result = new JSObject();
        result.put("deleted", count > 0);
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void toggleFavorite(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        long id = call.getLong("id");
        if (id <= 0) {
            call.reject("Valid account ID is required");
            return;
        }

        boolean success = autofillRepository.toggleFavorite(id);

        JSObject result = new JSObject();
        result.put("success", success);
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void getAccountCount(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        int count = autofillRepository.getAccountCount();

        JSObject result = new JSObject();
        result.put("count", count);
        call.resolve(result);
    }

    @PluginMethod
    public void clearAllAccounts(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        int count = autofillRepository.deleteAllAccounts();

        JSObject result = new JSObject();
        result.put("deletedCount", count);
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void syncAccountsFromReact(PluginCall call) {
        if (autofillRepository == null) {
            call.reject("AutofillRepository not initialized");
            return;
        }

        String accountsJson = call.getString("accountsJson");
        if (accountsJson == null || accountsJson.isEmpty()) {
            call.reject("No accounts JSON provided");
            return;
        }

        try {
            Pair<Integer, Integer> result = autofillRepository.syncAccountsFromReact(accountsJson);
            JSObject jsResult = new JSObject();
            jsResult.put("syncedCount", result.first);
            jsResult.put("errorCount", result.second);
            jsResult.put("success", result.second == 0);
            call.resolve(jsResult);
        } catch (Exception e) {
            Log.e(TAG, "Error syncing accounts from React", e);
            call.reject("Failed to sync accounts: " + e.getMessage());
        }
    }

    private Object getAutofillManager(Context context) {
        try {
            Class<?> autofillManagerClass = Class.forName(AUTO_FILL_SERVICE_CLASS);
            Method getSystemService = Context.class.getMethod("getSystemService", Class.class);
            return getSystemService.invoke(context, autofillManagerClass);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get AutofillManager", e);
            return null;
        }
    }

    private boolean invokeBooleanMethod(Object obj, String methodName) {
        try {
            Method method = obj.getClass().getMethod(methodName);
            return (Boolean) method.invoke(obj);
        } catch (Exception e) {
            Log.e(TAG, "Failed to invoke " + methodName, e);
            return false;
        }
    }

    private String invokeStringMethod(Object obj, String methodName) {
        try {
            Method method = obj.getClass().getMethod(methodName);
            return (String) method.invoke(obj);
        } catch (Exception e) {
            Log.e(TAG, "Failed to invoke " + methodName, e);
            return null;
        }
    }
}
