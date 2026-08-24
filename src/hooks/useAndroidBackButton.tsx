import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate, useLocation } from 'react-router-dom';
import type { PluginListenerHandle } from '@capacitor/core';

const DOUBLE_BACK_EXIT_PATHS = ['/', '/accounts'];
const DOUBLE_BACK_INTERVAL = 2000; // 2 seconds

// Toast Portal Component - renders at document.body level
const ToastPortal: React.FC<{
  message: string | null;
  visible: boolean;
}> = ({ message, visible }) => {
  if (!message) return null;

  return createPortal(
    <div
      data-kiyo-toast="true"
      className={`kiyo-toast ${!visible ? 'exiting' : ''}`}
      data-exiting={!visible ? 'true' : 'false'}
    >
      {message}
    </div>,
    document.body
  );
};

// Main component for Android back button handling
function AndroidBackButtonHandler(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPress = useRef<number>(-DOUBLE_BACK_INTERVAL);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(location.pathname);
  const toastVisibleRef = useRef(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Clear toast with animation
  const clearToast = useCallback((instant = false) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
      toastTimeout.current = null;
    }
    
    if (!instant && toastVisibleRef.current) {
      // Trigger fadeOut animation
      toastVisibleRef.current = false;
      setToastVisible(false);
      // Wait for animation to complete
      setTimeout(() => {
        setToastMessage(null);
      }, 200);
    } else {
      // Instant removal
      toastVisibleRef.current = false;
      setToastVisible(false);
      setToastMessage(null);
    }
  }, []);

  // Show toast message
  const showToast = useCallback((message: string) => {
    clearToast(true); // Instant removal before showing new toast
    setToastMessage(message);
    // Force reflow then show
    requestAnimationFrame(() => {
      toastVisibleRef.current = true;
      setToastVisible(true);
    });

    toastTimeout.current = setTimeout(() => {
      clearToast(false); // Animate out after timeout
    }, DOUBLE_BACK_INTERVAL);
  }, [clearToast]);

  // Track pathname changes - clear toast with animation when navigating away
  // Only run after initial mount (pathnameRef.current !== location.pathname)
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    // Skip on initial mount
    if (pathnameRef.current === location.pathname) {
      pathnameRef.current = location.pathname;
      return;
    }

    pathnameRef.current = location.pathname;
    clearToast(false); // Animate out when navigating away
    lastBackPress.current = -DOUBLE_BACK_INTERVAL;
  }, [location.pathname, clearToast]);

  // Register back button listener (only once)
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    const handler = () => {
      const now = Date.now();
      const isExitPath = DOUBLE_BACK_EXIT_PATHS.includes(pathnameRef.current);

      const timeSinceLastPress = now - lastBackPress.current;
      const isDoubleBack = timeSinceLastPress > 0 && timeSinceLastPress < DOUBLE_BACK_INTERVAL;

      if (isExitPath && isDoubleBack) {
        clearToast(false); // Animate out before exit
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
    let cancelled = false;

    App.addListener('backButton', handler).then(l => {
      if (cancelled) {
        l.remove();
      } else {
        listener = l;
      }
    });

    return () => {
      cancelled = true;
      listener?.remove();
      listener = null;
      clearToast(true); // Instant removal on cleanup
    };
  }, [navigate, showToast, clearToast]);

  // Handle toast animation end - clear message after fadeOut
  useEffect(() => {
    if (!toastVisible && toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 200); // Match animation duration
      return () => clearTimeout(timer);
    }
  }, [toastVisible, toastMessage]);

  // Toast portal element
  const toastPortal = useMemo(() => (
    <ToastPortal message={toastMessage} visible={toastVisible} />
  ), [toastMessage, toastVisible]);

  return toastPortal;
}

export default AndroidBackButtonHandler;