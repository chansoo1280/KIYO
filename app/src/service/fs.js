import * as RNFS from 'react-native-fs';
import CryptoJS from 'react-native-crypto-js';

//readDir(dirpath: string)
const filetype = 'utf8';

export const readDir = dirpath => {
  console.log(dirpath);
  return RNFS.readDir(dirpath)
    .then(files => {
      return files;
    })
    .catch(err => {
      console.log(err.message, err.code);
      return [];
    });
};
export const readFile = (filepath, pincode) => {
  console.log(filepath, pincode);
  return RNFS.readFile(filepath, filetype)
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
export const createFile = (filepath, contents, pincode) => {
  return RNFS.writeFile(
    filepath,
    CryptoJS.AES.encrypt(contents, pincode).toString(),
    filetype,
  )
    .then(success => {
      console.log('FILE CREATED!');
      return true;
    })
    .catch(err => {
      console.log(err.message);
      return false;
    });
};

export const deleteFile = filepath => {
  return RNFS.unlink(filepath)
    .then(success => {
      console.log('FILE DELETED!');
      return true;
    })
    .catch(err => {
      console.log(err.message);
      return false;
    });
};
