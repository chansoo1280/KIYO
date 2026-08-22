import { useEffect, useRef, useCallback } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';

const DOUBLE_BACK_EXIT_PATHS = ['/', '/accounts'];
const DOUBLE_BACK_INTERVAL = 2000; // 2 seconds

const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPress = useRef<number>(-DOUBLE_BACK_INTERVAL);
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);
  const prevPathnameRef = useRef<string>('');

  // Show toast message
  const showToast = useCallback((message: string) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      animation: fadeIn 0.2s ease-out;
    `;
    toast.textContent = message;

    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(10px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    toastTimeout.current = setTimeout(() => {
      toast.style.animation = 'fadeOut 0.2s ease-out forwards';
      setTimeout(() => toast.remove(), 200);
    }, DOUBLE_BACK_INTERVAL);
  }, []);

  // Track pathname changes for forward navigation
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    // Initialize ref on first run
    if (!prevPathnameRef.current) {
      prevPathnameRef.current = location.pathname;
    }

    const checkInterval = setInterval(() => {
      if (location.pathname !== prevPathnameRef.current) {
        // Forward navigation detected (pathname changed without back button)
        // Only reset if the last back press was not very recent (avoid race condition)
        if (lastBackPress.current > 0 && Date.now() - lastBackPress.current > 100) {
          lastBackPress.current = -DOUBLE_BACK_INTERVAL;
        }
        prevPathnameRef.current = location.pathname;
      }
    }, 100);

    return () => clearInterval(checkInterval);
  }, [location.pathname]);

  // Register back button listener
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const handler = () => {
      const now = Date.now();
      const isExitPath = DOUBLE_BACK_EXIT_PATHS.includes(location.pathname);

      const timeSinceLastPress = now - lastBackPress.current;
      const isDoubleBack = timeSinceLastPress > 0 && timeSinceLastPress < DOUBLE_BACK_INTERVAL;

      if (isExitPath && isDoubleBack) {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        App.exitApp();
      } else if (isExitPath) {
        // Exit path: show toast or exit, don't navigate back
        lastBackPress.current = now;
        showToast('한 번 더 누르면 앱이 종료됩니다.');
      } else if (window.history.length > 1) {
        // Non-exit path: normal back navigation
        navigate(-1);
        lastBackPress.current = now;
      } else {
        // Non-exit path with no history: exit app
        App.exitApp();
      }
    };

    let listener: PluginListenerHandle | null = null;
    App.addListener('backButton', handler).then(l => { listener = l; });

    return () => {
      if (listener) listener.remove();
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, [navigate, location.pathname]);
};

export default useAndroidBackButton;