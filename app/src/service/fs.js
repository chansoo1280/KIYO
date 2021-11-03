// import * as RNFS from 'react-native-fs';
import CryptoJS from 'react-native-crypto-js';
import {StorageAccessFramework} from 'expo-file-system';

//readDir(dirpath: string)
const filetype = 'utf8';

export const readDir = directoryUri => {
  console.log(directoryUri);
  return StorageAccessFramework.readDirectoryAsync(directoryUri)
    .then(files => {
      return files;
    })
    .catch(err => {
      console.log(err);
      return [];
    });
};
export const readFile = (filepath, pincode) => {
  console.log(filepath, pincode);
  // return RNFS.readFile(filepath, filetype)
  return StorageAccessFramework.readAsStringAsync(filepath, {
    encoding: filetype,
  })
    .then(contents => {
      console.log(contents);
      const originalText = CryptoJS.AES.decrypt(contents, pincode).toString(
        CryptoJS.enc.Utf8,
      );
      console.log('originalText : ' + originalText);
      return JSON.parse(originalText);
    })
    .catch(err => {
      console.log(err);
      return false;
    });
};
export const editFilename = async (
  directoryUri,
  filepath,
  newFilename,
  pincode,
) => {
  const contents = await readFile(filepath, pincode);
  console.log(contents);
  console.log(directoryUri, filepath, newFilename, pincode);
  const newFilepath = await createFile(
    directoryUri,
    newFilename,
    JSON.stringify(contents),
    pincode,
  );
  if (newFilepath) {
    await deleteFile(filepath);
  }
  return newFilepath;
};
export const editPincode = async (filepath, pincode, newPincode) => {
  const contents = await readFile(filepath, pincode);
  const newFilepath = await modifyFile(
    filepath,
    JSON.stringify(contents),
    newPincode,
  );
  return newFilepath;
};
export const createFile = (directoryUri, fileName, contents, pincode) => {
  console.log(directoryUri, fileName, contents, pincode);
  return StorageAccessFramework.createFileAsync(
    directoryUri,
    fileName,
    'text/plain',
  )
    .then(filepath => {
      return StorageAccessFramework.writeAsStringAsync(
        filepath,
        CryptoJS.AES.encrypt(contents, pincode).toString(),
        {encoding: filetype},
      ).then(() => {
        return filepath;
      });
    })
    .then(filepath => {
      console.log('FILE CREATED!');
      return filepath;
    })
    .catch(err => {
      console.log(err.message);
      return false;
    });
};
export const modifyFile = (filepath, contents, pincode) => {
  // console.log(filepath, contents, pincode);
  return StorageAccessFramework.writeAsStringAsync(
    filepath,
    CryptoJS.AES.encrypt(contents, pincode).toString(),
    {encoding: filetype},
  )
    .then(() => {
      console.log('FILE MODIFIED!');
      return filepath;
    })
    .catch(err => {
      console.log(err.message);
      return false;
    });
};

export const deleteFile = filepath => {
  return StorageAccessFramework.deleteAsync(filepath)
    .then(success => {
      console.log('FILE DELETED!');
      return true;
    })
    .catch(err => {
      console.log(err.message);
      return false;
    });
};
