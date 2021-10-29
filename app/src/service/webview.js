import React, {useState, useRef, useEffect} from 'react';
import * as RNFS from 'react-native-fs';
import {
  BackHandler,
  Platform,
  ToastAndroid,
  PermissionsAndroid,
} from 'react-native';
import {WebView} from 'react-native-webview';
export const WebViewWrapper = props => {
  const {webview, onMessage, canGoBack} = props;
  const [url, setUrl] = useState('');
  let exitAppTimeout = null;
  let exitApp = false;
  const url = 'http://192.168.0.64:3000/';
  // const url = 'https://price.chansoo1280.site/';
  //   const requestPermissions = async function () {
  //     if (Platform.OS === 'ios') {
  //       Geolocation.requestAuthorization();
  //       Geolocation.setRNConfiguration({
  //         skipPermissionRequests: false,
  //         authorizationLevel: 'whenInUse',
  //       });
  //     }

  //     if (Platform.OS === 'android') {
  //       await PermissionsAndroid.request(
  //         PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  //       );
  //     }
  //   };
  const onBackPress = () => {
    if (webview && webview.current && canGoBack) {
      webview.current?.goBack();
      return true;
    } else {
      if (exitApp === false) {
        exitApp = true;
        ToastAndroid.show('한번 더 누르시면 종료됩니다.', ToastAndroid.SHORT);
        exitAppTimeout = setTimeout(
          () => {
            exitApp = false;
          },
          2000, // 2초
        );
        return true;
      } else {
        if (exitAppTimeout !== null) {
          clearTimeout(exitAppTimeout);
        }
        BackHandler.exitApp(); // 앱 종료
        return true;
      }
    }
  };
  useEffect(() => {
    // RNFS.readDir('file:///android_asset')
    //   .then(e => {
    //     console.log(e);
    //   })
    //   .catch(e => console.log(e));
    // server.start().then(url => {
    //   console.log('Serving at URL', url);
    //   setUrl(url);
    // });
    BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      // server.stop();
      BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    };
  }, [canGoBack]);

  return (
    <WebView
      ref={webview}
      source={{
        uri: url,
      }}
      // onNavigationStateChange={(navState) => {
      //   console.log(navState);
      //   SetCanGoBack(navState.canGoBack);
      // }}
      injectedJavaScript={`
      const consoleLog = ( log) => window.ReactNativeWebView.postMessage(JSON.stringify({'type': 'Console', 'data': log}));
      console = {
          log: (log) => consoleLog(log),
          debug: (log) => consoleLog(log),
          info: (log) => consoleLog(log),
          warn: (log) => consoleLog(log),
          error: (log) => consoleLog(log),
        };
    (function() {
      function wrap(fn) {
        return function wrapper() {
          var res = fn.apply(this, arguments);
          window.ReactNativeWebView.postMessage('navigationStateChange');
          return res;
        }
      }

      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
      window.addEventListener('popstate', function() {
        window.ReactNativeWebView.postMessage('navigationStateChange');
      });
    })();
    true;
  `}
      onMessage={onMessage}
    />
  );
};
