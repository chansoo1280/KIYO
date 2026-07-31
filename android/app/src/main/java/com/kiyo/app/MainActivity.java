package com.kiyo.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.kiyo.app.capacitor.KiyoAutofillPlugin;

public class MainActivity extends BridgeActivity {

    public MainActivity() {
        registerPlugin(KiyoAutofillPlugin.class);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        System.loadLibrary("sqlcipher");
    }
}