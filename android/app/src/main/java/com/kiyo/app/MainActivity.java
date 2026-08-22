package com.kiyo.app;

import android.os.Bundle;
import android.content.Intent;

import com.getcapacitor.BridgeActivity;
import com.kiyo.app.capacitor.KiyoAutofillPlugin;
import com.kiyo.app.capacitor.KiyoFilePlugin;
import com.kiyo.app.autofill.auth.AutofillAuthActivity;

public class MainActivity extends BridgeActivity {

    public MainActivity() {
        registerPlugin(KiyoAutofillPlugin.class);
        registerPlugin(KiyoFilePlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Handle autofill authentication request
        handleAutofillAuthIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleAutofillAuthIntent(intent);
    }

    private void handleAutofillAuthIntent(Intent intent) {
        if (intent != null && "autofill_auth_required".equals(intent.getStringExtra("reason"))) {
            // Start autofill authentication activity (supports biometric + device credential)
            AutofillAuthActivity.startAuthForSync(this);
        }
    }
}