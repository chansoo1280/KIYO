import React, { forwardRef, useEffect, useState } from 'react';
import { BackHandler, ToastAndroid } from 'react-native';
import { WebView } from 'react-native-webview';
export const RN_API = {
	GET_VERSION: 'GET_VERSION',
	SET_DIR: 'SET_DIR',
	SET_COPY: 'SET_COPY',
	SET_FILENAME: 'SET_FILENAME',
	SET_SEL_FILENAME: 'SET_SEL_FILENAME',
	GET_FILENAME: 'GET_FILENAME',
	GET_FILE: 'GET_FILE',
	SHARE_FILE: 'SHARE_FILE',
	BACKUP_FILE: 'BACKUP_FILE',
	GET_FILE_LIST: 'GET_FILE_LIST',
	CREATE_FILE: 'CREATE_FILE',
	SET_FILE: 'SET_FILE',
	DELETE_FILE: 'DELETE_FILE',
	SET_PINCODE: 'SET_PINCODE',
	SET_SORTTYPE: 'SET_SORTTYPE'
};
export const WebViewWrapper = forwardRef((props, ref) => {
	const { onMessage, uri } = props;
	const [ canGoBack, SetCanGoBack ] = useState(false);
	let exitAppTimeout = null;
	let isExit = false;

	const onBackPress = () => {
		if (ref && ref.current && canGoBack) {
			ref.current.goBack();
			return true;
		} else {
			if (isExit === false) {
				isExit = true;
				ToastAndroid.show('한번 더 누르시면 종료됩니다.', ToastAndroid.SHORT);
				exitAppTimeout = setTimeout(
					() => {
						isExit = false;
					},
					2000 // 2초
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
	useEffect(
		() => {
			BackHandler.addEventListener('hardwareBackPress', onBackPress);
			return () => {
				BackHandler.removeEventListener('hardwareBackPress', onBackPress);
			};
		},
		[ canGoBack ]
	);

	return (
		<WebView
			ref={ref}
			source={{
				uri
			}}
			onMessage={async (message) => {
				const { nativeEvent } = message;
				if (nativeEvent.data === 'navigationStateChange') {
					SetCanGoBack(nativeEvent.canGoBack);
					return;
				}
				const req = nativeEvent.data && JSON.parse(nativeEvent.data);
				await onMessage(req);
			}}
			injectedJavaScript={`
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
		/>
	);
});
