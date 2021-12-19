import React, { useEffect, useRef, useState } from 'react';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import Clipboard from '@react-native-clipboard/clipboard';
import { BackHandler, ToastAndroid, View } from 'react-native';
import {
	RN_API,
	WebViewWrapper,
	readDir,
	readFile,
	editFilename,
	editPincode,
	createFile,
	deleteFile,
	modifyFile
} from '@Service';
import { AdMobBanner } from 'expo-ads-admob';
import { vw, vh } from 'react-native-expo-viewport-units';
import { StorageAccessFramework } from 'expo-file-system';

var RNGRP = require('react-native-get-real-path');

const extension = '.txt';
const App = () => {
	const webview = useRef(null);
	const getDirectoryUri = async () => {
		const directoryUriEnd = await AsyncStorage.getItem('directoryUriEnd', (err, result) => result);
		if (directoryUriEnd) {
			AsyncStorage.setItem('directoryUri', directoryUriEnd);
			return directoryUriEnd;
		}
		return false;
	};
	const setDirectoryUri = async () => {
		const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync().catch((e) => alert(e));
		if (permissions.granted) {
			// Gets SAF URI from response
			AsyncStorage.setItem('directoryUri', permissions.directoryUri);

			return permissions.directoryUri;
		}
		return false;
	};
	const getFilename = (filepath) => {
		const fileList = decodeURI(filepath).split('%2F');
		return (fileList && fileList[fileList.length - 1]) || '';
	};
	useEffect(() => {
		NetInfo.fetch().then((state) => {
			if (state.isConnected !== true) {
				alert('네트워크 연결이 불안정하여 앱을 종료합니다.');
				BackHandler.exitApp(); // 앱 종료
			}
		});
	}, []);
	return (
		<View
			style={{
				width: vw(100),
				height: vh(100)
			}}
		>
			<WebViewWrapper
				ref={webview}
				uri="http://172.30.1.40:3000/"
				// uri="https://am.chansoo1280.site/"
				onMessage={async (req) => {
					if (!req) return;
					const { data, type, reqId } = req;
					console.log(reqId, type);
					switch (type) {
						case 'Console': {
							console.info(`[Console] ${JSON.stringify(data)}`);
							break;
						}
						case RN_API.GET_VERSION: {
							console.log(RN_API.GET_VERSION);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.GET_VERSION,
									data: '1.9'
								})
							);
							break;
						}
						case RN_API.SET_COPY: {
							console.log(RN_API.SET_COPY);
							const { text } = data;
							Clipboard.setString(text);
							console.log(text);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_COPY,
									data: true
								})
							);
							ToastAndroid.show('클립보드에 복사되었습니다.', ToastAndroid.SHORT);
							break;
						}
						case RN_API.SET_SEL_FILENAME: {
							console.log(RN_API.SET_SEL_FILENAME);
							const { filepath } = data;
							AsyncStorage.setItem('filepath', filepath);
							const directoryUri = await AsyncStorage.getItem('directoryUri', (err, result) => result);
							AsyncStorage.setItem('directoryUriEnd', directoryUri);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_SEL_FILENAME,
									data: true
								})
							);
							break;
						}
						case RN_API.SET_FILENAME: {
							console.log(RN_API.SET_FILENAME);
							const { myFilename, pincode } = data;
							const newFilename = myFilename + extension;
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							let directoryUri = await getDirectoryUri();
							if (directoryUri === false) {
								directoryUri = await setDirectoryUri();
							}

							const filename = getFilename(filepath);
							if (filename === newFilename) {
								ToastAndroid.show('동일한 파일명입니다.', ToastAndroid.SHORT);
								return;
							}
							const newFilepath = await editFilename(directoryUri, filepath, newFilename, pincode);
							if (newFilepath !== false) {
								AsyncStorage.setItem('filepath', newFilepath);
								ToastAndroid.show('파일이름이 변경되었습니다.', ToastAndroid.SHORT);
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_FILENAME,
									data: newFilepath ? newFilename : false
								})
							);
							break;
						}
						case RN_API.GET_FILENAME: {
							console.log(RN_API.GET_FILENAME);
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const filename = getFilename(filepath);
							const isExist = await (async () => {
								const directoryUri = await getDirectoryUri();
								if (directoryUri === false) {
									return 'no-folder';
								}
								const files = await readDir(directoryUri);

								return files.find((file) => file === filepath) || false;
							})();
							console.log(isExist);
							// if (!isExist) {
							//   console.log("");
							// }
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.GET_FILENAME,
									data: isExist === 'no-folder' ? isExist : isExist ? filename : false
								})
							);
							break;
						}
						case RN_API.SET_DIR: {
							console.log(RN_API.SET_DIR);
							const directoryUri = await setDirectoryUri();
							if (directoryUri === false) {
								ToastAndroid.show('권한이 없습니다.', ToastAndroid.SHORT);
								return false;
							}
							const files = await readDir(directoryUri);
							const filenames = await Promise.all(files.map((file) => RNGRP.getRealPathFromURI(file)));
							const fileList = files
								.map((file, idx) => {
									const fileList = decodeURIComponent(filenames[idx]).split('/');
									return {
										filepath: file,
										filename: (fileList && fileList[fileList.length - 1]) || ''
									};
								})
								.filter(({ filename }) => filename.slice(-4, filename.length) === '.txt');
							// console.log(fileList);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_DIR,
									data: {
										dirpath: directoryUri,
										list: fileList
									}
								})
							);
							break;
						}
						case RN_API.GET_FILE_LIST: {
							console.log(RN_API.GET_FILE_LIST);
							const directoryUri = await AsyncStorage.getItem('directoryUri', (err, result) => result);
							const files = await readDir(directoryUri);
							const filenames = await Promise.all(files.map((file) => RNGRP.getRealPathFromURI(file)));
							const fileList = files
								.map((file, idx) => {
									const fileList = decodeURIComponent(filenames[idx]).split('/');
									return {
										filepath: file,
										filename: (fileList && fileList[fileList.length - 1]) || ''
									};
								})
								.filter(({ filename }) => filename.slice(-4, filename.length) === '.txt');
							// console.log(fileList);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.GET_FILE_LIST,
									data: {
										dirpath: filenames.length
											? decodeURIComponent(filenames[0]).split('/').slice(0, -1).join('/')
											: directoryUri,
										list: fileList
									}
								})
							);
							break;
						}
						case RN_API.GET_FILE: {
							console.log(RN_API.GET_FILE);
							const { pincode } = data;
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const filename = getFilename(filepath);
							const result = await readFile(filepath, pincode);
							console.log(result);
							const sortType = await AsyncStorage.getItem('sortType', (err, result) => result);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.GET_FILE,
									data:
										result === false
											? false
											: {
													filename,
													pincode,
													sortType: sortType,
													list: result
												}
								})
							);
							break;
						}
						case RN_API.SHARE_FILE: {
							console.log(RN_API.SHARE_FILE);
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const realPath = await RNGRP.getRealPathFromURI(filepath);
							const result = await Share.open({
								url: 'file://' + realPath
							}).catch((err) => {
								err && console.log(err);
								return err;
							});
							console.log(result);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SHARE_FILE,
									data: result
								})
							);
							break;
						}
						case RN_API.BACKUP_FILE: {
							console.log(RN_API.BACKUP_FILE);
							const { filename: myFilename, pincode } = data;
							const filename = myFilename + extension;
							const directoryUriEnd = await AsyncStorage.getItem(
								'directoryUriEnd',
								(err, result) => result
							);
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const list = await readFile(filepath, pincode);
							const newFilepath = await createFile(
								directoryUriEnd,
								filename,
								JSON.stringify(list),
								pincode
							);
							if (newFilepath) {
								ToastAndroid.show('백업 완료', ToastAndroid.SHORT);
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.BACKUP_FILE,
									data: !!newFilepath
								})
							);
							break;
						}
						case RN_API.CREATE_FILE: {
							console.log(RN_API.CREATE_FILE);
							const { filename: myFilename, list, pincode } = data;
							const filename = myFilename + extension;
							const directoryUri = await AsyncStorage.getItem('directoryUri', (err, result) => result);
							console.log(list);
							const filepath = await createFile(directoryUri, filename, JSON.stringify(list), pincode);
							if (filepath !== false) {
								AsyncStorage.setItem('directoryUriEnd', directoryUri);
								AsyncStorage.setItem('filepath', filepath);
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.CREATE_FILE,
									data: filepath ? data : null
								})
							);
							break;
						}
						case RN_API.SET_FILE: {
							console.log(RN_API.SET_FILE);
							const { list, pincode } = data;
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const result = await modifyFile(filepath, JSON.stringify(list), pincode);
							if (result !== false) {
								ToastAndroid.show('파일 정보가 변경되었습니다.', ToastAndroid.SHORT);
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_FILE,
									data: result ? list : false
								})
							);
							break;
						}
						case RN_API.SET_PINCODE: {
							console.log(RN_API.SET_PINCODE);
							const { pincode, newPincode } = data;
							const filepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							const result = await editPincode(filepath, pincode, newPincode);
							if (result !== false) {
								ToastAndroid.show('핀코드가 수정되었습니다.', ToastAndroid.SHORT);
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_PINCODE,
									data: result ? newPincode : false
								})
							);
							break;
						}
						case RN_API.DELETE_FILE: {
							console.log(RN_API.DELETE_FILE);
							const { filepath } = data;
							const result = await deleteFile(filepath);
							const curFilepath = await AsyncStorage.getItem('filepath', (err, result) => result);
							if (curFilepath === filepath) {
								AsyncStorage.setItem('filepath', '');
							}
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.DELETE_FILE,
									data: result
								})
							);
							break;
						}
						case RN_API.SET_SORTTYPE: {
							console.log(RN_API.SET_SORTTYPE);
							const { sortType } = data;
							await AsyncStorage.setItem('sortType', sortType);
							webview.current.postMessage(
								JSON.stringify({
									type: RN_API.SET_SORTTYPE,
									data: true
								})
							);
							break;
						}
					}
				}}
			/>
			<AdMobBanner
				bannerSize="smartBannerPortrait"
				adUnitID="ca-app-pub-1378042447494891/5032269634"
				servePersonalizedAds // true or false
				onDidFailToReceiveAdWithError={(e) => {
					console.log(e);
				}}
			/>
		</View>
	);
};

export default App;
