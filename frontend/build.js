const fs = require('fs-extra');

async function copy(src, dest) {
  try {
    await fs.copy(src, dest, { overwrite: true, errorOnExist: true });
    return true;
  } catch (error) {
    if (error.message.includes('already exists')) {
      return false;
    }
    throw error;
  }
}


const src = './out';
const dest = '../backend/static';

copy(src, dest)