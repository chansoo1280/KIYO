import React, {useEffect, useRef, useState} from 'react';
import Share from 'react-native-share';
import * as RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';
import {zip, unzip, unzipAssets, subscribe} from 'react-native-zip-archive';
import {ToastAndroid} from 'react-native';
import {
  WebViewWrapper,
  readDir,
  readFile,
  editFilename,
  createFile,
  deleteFile,
  moveFile,
} from '@Service';

const RN_API = {
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
};
const extension = '.txt';
const filedir = RNFS.DownloadDirectoryPath + '/acApp';
const App = () => {
  const webview = useRef(null);
  const [canGoBack, SetCanGoBack] = useState(false);
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
            const {filename} = req?.data;
            AsyncStorage.setItem('filename', filename);
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
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            const filepath = filedir + '/' + filename;
            const newFilepath = filedir + '/' + newFilename;
            const result = await editFilename(filepath, newFilepath, pincode);
            if (result !== false) {
              AsyncStorage.setItem('filename', newFilename);
              ToastAndroid.show(
                '파일이름이 변경되었습니다.',
                ToastAndroid.SHORT,
              );
            }
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_FILENAME,
                data: result ? newFilename : false,
              }),
            );
            break;
          }
          case RN_API.GET_FILENAME: {
            console.log(RN_API.GET_FILENAME);
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            console.log(filename);

            // const folderDir = await readDir(RNFS.DownloadDirectoryPath);
            // const folder =
            //   folderDir.find(file => file.name === 'acApp') || false;
            // if (folder === false) {
            //   await RNFS.mkdir(filedir);
            // }
            // console.log(folderDir);
            const docFiles = await readDir(RNFS.DocumentDirectoryPath);
            const docFile =
              docFiles.find(file => file.name === filename) || false;
            if (docFile) {
              await moveFile(docFile.path, filedir + '/' + docFile.name);
            }

            const files = await readDir(filedir);
            const isExist = files.find(file => file.name === filename) || false;
            console.log(isExist);
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
            const files = await readDir(filedir);
            console.log(files);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.GET_FILE_LIST,
                data: {
                  dirpath: filedir,
                  list: files,
                },
              }),
            );
            break;
          }
          case RN_API.GET_FILE: {
            console.log(RN_API.GET_FILE);
            const {pincode} = req?.data;
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            const filepath = filedir + '/' + filename;
            console.log(filepath, pincode);
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
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            const filepath = filedir + '/' + filename;
            console.log(filepath);

            const targetPath = `${filedir}/${filename.replace(
              extension,
              '.zip',
            )}`;

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
            const filepath = filedir + '/' + filename;

            console.log(contents);
            const result = await createFile(
              filepath,
              JSON.stringify(contents),
              pincode,
            );
            AsyncStorage.setItem('filename', filename);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.CREATE_FILE,
                data: result ? req?.data : null,
              }),
            );
            break;
          }
          case RN_API.SET_FILE: {
            console.log(RN_API.SET_FILE);
            const {contents, pincode} = req?.data;
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            const filepath = filedir + '/' + filename;
            console.log(contents);
            const result = await createFile(
              filepath,
              JSON.stringify(contents),
              pincode,
            );
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.SET_FILE,
                data: result ? contents : false,
              }),
            );
            break;
          }
          case RN_API.DELETE_FILE: {
            console.log(RN_API.DELETE_FILE);
            const {filename} = req?.data;
            const filepath = filedir + '/' + filename;
            const result = await deleteFile(filepath);
            const curFilename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            if (curFilename === filename) {
              AsyncStorage.setItem('filename', '');
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
