import React, {useEffect, useRef, useState} from 'react';
import Share from 'react-native-share';
import * as RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import {zip, unzip, unzipAssets, subscribe} from 'react-native-zip-archive';
import {ToastAndroid, PermissionsAndroid} from 'react-native';
import {
  WebViewWrapper,
  readDir,
  readFile,
  editFilename,
  editPincode,
  createFile,
  deleteFile,
  modifyFile,
} from '@Service';
import * as FileSystem from 'expo-file-system';
const {StorageAccessFramework} = FileSystem;

const RN_API = {
  CHANGE_DIR: 'CHANGE_DIR',
  SET_COPY: 'SET_COPY',
  SET_FILENAME: 'SET_FILENAME',
  SET_SEL_FILENAME: 'SET_SEL_FILENAME',
  GET_FILENAME: 'GET_FILENAME',
  GET_FILE: 'GET_FILE',
  SHARE_FILE: 'SHARE_FILE',
  GET_FILE_LIST: 'GET_FILE_LIST',
  CREATE_FILE: 'CREATE_FILE',
  SET_FILE: 'SET_FILE',
  DELETE_FILE: 'DELETE_FILE',
  SET_PINCODE: 'SET_PINCODE',
};
const extension = '.txt';
const App = () => {
  const webview = useRef(null);
  const [canGoBack, SetCanGoBack] = useState(false);
  const getDirectoryUri = async () => {
    const directoryUri = await AsyncStorage.getItem(
      'directoryUri',
      (err, result) => result,
    );
    if (directoryUri) return directoryUri;
    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (permissions.granted) {
      // Gets SAF URI from response
      AsyncStorage.setItem('directoryUri', permissions.directoryUri);

      return permissions.directoryUri;
    }
    return false;
    // const granted = await PermissionsAndroid.requestMultiple([
    //   PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    //   PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    // ]);
    // const readGranted = await PermissionsAndroid.check(
    //   PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    // );
    // const writeGranted = await PermissionsAndroid.check(
    //   PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    // );
    // if (!readGranted || !writeGranted) {
    //   alert('Read and write permissions have not been granted');
    //   return false;
    // }
    // return true;
  };
  const getFilename = filepath => {
    const fileList = decodeURI(filepath).split('%2F');
    return (fileList && fileList[fileList.length - 1]) || '';
  };
  useEffect(() => {}, []);

  return (
    <WebViewWrapper
      onMessage={async message => {
        const {nativeEvent} = message;
        if (nativeEvent?.data === 'navigationStateChange') {
          SetCanGoBack(nativeEvent.canGoBack);
          return;
        }
        const req = JSON.parse(nativeEvent?.data || '""');
        switch (req.type) {
          case 'Console': {
            console.info(`[Console] ${JSON.stringify(req?.data)}`);
            break;
          }
          case RN_API.SET_COPY: {
            console.log(RN_API.SET_COPY);
            const {text} = req?.data;
            Clipboard.setString(text);
            console.log(text);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_COPY,
                data: true,
              }),
            );
            ToastAndroid.show('클립보드에 복사되었습니다.', ToastAndroid.SHORT);
            break;
          }
          case RN_API.SET_SEL_FILENAME: {
            console.log(RN_API.SET_SEL_FILENAME);
            const {filepath} = req?.data;
            AsyncStorage.setItem('filepath', filepath);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_SEL_FILENAME,
                data: true,
              }),
            );
            break;
          }
          case RN_API.SET_FILENAME: {
            console.log(RN_API.SET_FILENAME);
            const {myFilename, pincode} = req?.data;
            const newFilename = myFilename + extension;
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            const directoryUri = await AsyncStorage.getItem(
              'directoryUri',
              (err, result) => result,
            );
            const filename = getFilename(filepath);
            if (filename === newFilename) {
              ToastAndroid.show('동일한 파일명입니다.', ToastAndroid.SHORT);
              return;
            }
            const newFilepath = await editFilename(
              directoryUri,
              filepath,
              newFilename,
              pincode,
            );
            if (newFilepath !== false) {
              AsyncStorage.setItem('filepath', newFilepath);
              ToastAndroid.show(
                '파일이름이 변경되었습니다.',
                ToastAndroid.SHORT,
              );
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_FILENAME,
                data: newFilepath ? newFilename : false,
              }),
            );
            break;
          }
          case RN_API.GET_FILENAME: {
            console.log(RN_API.GET_FILENAME);
            const directoryUri = await getDirectoryUri();
            if (directoryUri === false) {
              return;
            }
            console.log(directoryUri);
            const files = await readDir(directoryUri);
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            const filename = getFilename(filepath);

            const isExist = files.find(file => file === filepath) || false;
            if (!isExist) {
              console.log(files);
              console.log(filepath);
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.GET_FILENAME,
                data: isExist ? filename : false,
              }),
            );
            break;
          }
          case RN_API.GET_FILE_LIST: {
            console.log(RN_API.GET_FILE_LIST);
            const directoryUri = await AsyncStorage.getItem(
              'directoryUri',
              (err, result) => result,
            );
            const files = await readDir(directoryUri);
            console.log(files);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.GET_FILE_LIST,
                data: {
                  dirpath: directoryUri,
                  list: files,
                },
              }),
            );
            break;
          }
          case RN_API.GET_FILE: {
            console.log(RN_API.GET_FILE);
            const {pincode} = req?.data;
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            const filename = getFilename(filepath);
            const result = await readFile(filepath, pincode);
            console.log(result);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.GET_FILE,
                data: {
                  filename,
                  pincode,
                  contents: result,
                },
              }),
            );
            break;
          }
          case RN_API.SHARE_FILE: {
            console.log(RN_API.SHARE_FILE);
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            console.log(filepath);

            const targetPath = filepath.replace(extension, '.zip');

            await zip(filepath, targetPath)
              .then(path => {
                console.log(`zip completed at ${path}`);
              })
              .catch(error => {
                console.error(error);
              });
            const result = await Share.open({
              url: 'file://' + targetPath,
              title: '내가 기억할게 파일 내보내기',
            }).catch(err => {
              err && console.log(err);
              return err;
            });
            console.log(result);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SHARE_FILE,
                data: result,
              }),
            );
            break;
          }
          case RN_API.CREATE_FILE: {
            console.log(RN_API.CREATE_FILE);
            const {filename: myFilename, contents, pincode} = req?.data;
            const filename = myFilename + extension;
            const directoryUri = await AsyncStorage.getItem(
              'directoryUri',
              (err, result) => result,
            );
            console.log(contents);
            const filepath = await createFile(
              directoryUri,
              filename,
              JSON.stringify(contents),
              pincode,
            );
            if (filepath !== false) {
              AsyncStorage.setItem('filepath', filepath);
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.CREATE_FILE,
                data: filepath ? req?.data : null,
              }),
            );
            break;
          }
          case RN_API.SET_FILE: {
            console.log(RN_API.SET_FILE);
            const {contents, pincode} = req?.data;
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            const result = await modifyFile(
              filepath,
              JSON.stringify(contents),
              pincode,
            );
            if (result !== false) {
              ToastAndroid.show(
                '파일 정보가 변경되었습니다.',
                ToastAndroid.SHORT,
              );
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_FILE,
                data: result ? contents : false,
              }),
            );
            break;
          }
          case RN_API.SET_PINCODE: {
            console.log(RN_API.SET_PINCODE);
            const {pincode, newPincode} = req?.data;
            const filepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            const result = await editPincode(filepath, pincode, newPincode);
            if (result !== false) {
              ToastAndroid.show('핀코드가 수정되었습니다.', ToastAndroid.SHORT);
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_PINCODE,
                data: result ? newPincode : false,
              }),
            );
            break;
          }
          case RN_API.DELETE_FILE: {
            console.log(RN_API.DELETE_FILE);
            const {filepath} = req?.data;
            const result = await deleteFile(filepath);
            const curFilepath = await AsyncStorage.getItem(
              'filepath',
              (err, result) => result,
            );
            if (curFilepath === filepath) {
              AsyncStorage.setItem('filepath', '');
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.DELETE_FILE,
                data: result,
              }),
            );
            break;
          }
        }
      }}
      webview={webview}
      canGoBack={canGoBack}
    />
  );
};

export default App;
