import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';

const useAndroidBackButton = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Only add the listener on Android
    if (Capacitor.getPlatform() !== 'android') {
      return;
    }

    const handler = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        App.exitApp();
      }
    };

    let listener: PluginListenerHandle | null = null;

    App.addListener('backButton', handler).then(l => {
      listener = l;
    });

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [navigate]);
};

export default useAndroidBackButton;