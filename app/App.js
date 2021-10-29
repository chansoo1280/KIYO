import React, {useEffect, useRef, useState} from 'react';
import Share from 'react-native-share';
import * as RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  WebViewWrapper,
  readDir,
  readFile,
  createFile,
  deleteFile,
} from '@Service';

const RN_API = {
  GET_FILENAME: 'GET_FILENAME',
  GET_FILE: 'GET_FILE',
  SHARE_FILE: 'SHARE_FILE',
  GET_FILE_LIST: 'GET_FILE_LIST',
  CREATE_FILE: 'CREATE_FILE',
  SET_FILE: 'SET_FILE',
  DELETE_FILE: 'DELETE_FILE',
};
const extension = '.ACJSON';
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
          case RN_API.GET_FILENAME: {
            console.log(RN_API.GET_FILENAME);
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            console.log(filename);
            const files = await readDir(RNFS.DocumentDirectoryPath);
            const isExist = files.find(file => file.name === filename);
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
            const files = await readDir(RNFS.DocumentDirectoryPath);
            webview.current.postMessage(
              JSON.stringify({
                type: RN_API.GET_FILE_LIST,
                data: files,
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
            const filepath = RNFS.DocumentDirectoryPath + '/' + filename;
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
            const filepath = RNFS.DocumentDirectoryPath + '/' + filename;
            console.log(filepath);
            const result = await Share.open({
              url: 'file://' + filepath,
              title: 'React Native FILE SHARE',
              message:
                'React Native | A framework for building native apps using React',
              type: 'text/plain',
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
            const filepath = RNFS.DocumentDirectoryPath + '/' + filename;
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
            const filepath = RNFS.DocumentDirectoryPath + '/' + filename;
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
            const filename = await AsyncStorage.getItem(
              'filename',
              (err, result) => result,
            );
            const filepath = RNFS.DocumentDirectoryPath + '/' + filename;
            const result = await deleteFile(filepath);
            AsyncStorage.removeItem('filename');
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
