/* eslint-env browser */

/* global Webex */

/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

// Declare some globals that we'll need throughout.
let webex;
let enableProd = true;
let subscribedUserIds = [];

const credentialsFormElm = document.querySelector('#credentials');
const tokenElm = document.querySelector('#access-token');
const saveElm = document.querySelector('#access-token-save');
const registerBtn = document.querySelector('#register-btn');
const deregisterBtn = document.querySelector('#deregister-btn');
const authStatusElm = document.querySelector('#access-token-status');
const encryptedFileUrlInput = document.querySelector('#encrypted-file-url');
const useFileServiceCheckbox = document.querySelector('#use-file-service');
const encryptedFileJweInput = document.querySelector('#encrypted-file-jwe');
const encryptedFileKeyURIInput = document.querySelector('#encrypted-file-keyURI');
const decryptedFileNameInput = document.querySelector('#decrypted-file-name');
const decryptFileBtn = document.querySelector('#decrypt-my-file-btn');
const decryptFileResult = document.querySelector('#decrypt-file-result');
const mimeTypeDropdown = document.querySelector('#mime-types');
const kmsKeyUriInput = document.querySelector('#kms-key-uri');
const downloadKmsKeyBtn = document.querySelector('#download-kms-key-btn');
const kmsKeyStatus = document.querySelector('#kms-key-status');

// Store and Grab `access-token` from localstorage
if (localStorage.getItem('date') > new Date().getTime()) {
  tokenElm.value = localStorage.getItem('access-token');
} else {
  localStorage.removeItem('access-token');
}

tokenElm.addEventListener('change', (event) => {
  const token = event.target.value;
  if (!token) {
    localStorage.removeItem('access-token');
    localStorage.removeItem('date');
    return;
  }
  localStorage.setItem('access-token', event.target.value);
  localStorage.setItem('date', new Date().getTime() + 12 * 60 * 60 * 1000);
});

function changeEnv() {
  enableProd = !enableProd;
  enableProduction.innerHTML = enableProd ? 'In Production' : 'In Integration';
}

function updateStatus(enabled) {
  decryptFileResult.innerText = '';
  decryptFileBtn.disabled = !enabled;
}

async function initWebex(e) {
  e.preventDefault();
  console.log('Authentication#initWebex()');

  tokenElm.disabled = true;
  saveElm.disabled = true;

  decryptFileBtn.disabled = true;
  authStatusElm.innerText = 'initializing...';

  const webexConfig = {
    config: {
      logger: {
        level: 'debug', // set the desired log level
      },
    },
    credentials: {
      access_token: tokenElm.value
    }
  };

  if (!enableProd) {
    webexConfig.config.services = {
      discovery: {
        u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1',
        hydra: 'https://hydra-intb.ciscospark.com/v1/',
      },
    };
  }

  webex = window.webex = Webex.init(webexConfig);

  webex.once('ready', () => {
    console.log('Authentication#initWebex() :: Webex Ready');
    authStatusElm.innerText = 'Webex is ready. Saved access token!';
    registerBtn.disabled = false;
  });
  e.stopPropagation();
}

credentialsFormElm.addEventListener('submit', initWebex);

encryptedFileUrlInput.addEventListener('input', () => {
  decryptFileResult.innerText = '';
});


async function register(){
  webex.cypher.register().then(() => {
    console.log('Authentication#initWebex() :: Webex Registered');
    authStatusElm.innerText = 'Webex is ready and registered!';
    updateStatus(true);
    registerBtn.disabled = true;
    deregisterBtn.disabled = false;
  }).catch((err) => {
    console.error(`error registering webex: ${err}`);
    authStatusElm.innerText = 'Error registering Webex. Check access token!';
  });
}

async function deregister(){
  webex.cypher.deregister().then(() => {
    console.log('Authentication#initWebex() :: Webex Deregistered');
    authStatusElm.innerText = 'Webex is ready, but not registered!';
    updateStatus(false);
    registerBtn.disabled = false;
    deregisterBtn.disabled = true;
  }).catch((err) => {
    console.error(`error deregistering webex: ${err}`);
    authStatusElm.innerText = 'Error deregistering Webex. Check access token!';
  });
}

async function decryptFile() {
  decryptFileResult.innerText = '';
  const fileUrl = encryptedFileUrlInput.value;
  const encryptedFileName = decryptedFileNameInput.value;
  const mimeType = mimeTypeDropdown.value;

  if (!fileUrl) {
    decryptFileResult.innerText = ': error - Invalid file URL';
    return;
  }

  if (!mimeType) {
    decryptFileResult.innerText = ': error - Invalid MIME type';
    return;
  }

  let objectUrl;
  try {
    let decryptedBuf;
    const options = {
      useFileService: useFileServiceCheckbox.checked,
      jwe: encryptedFileJweInput.value,
      keyUri: encryptedFileKeyURIInput.value,
    };

    decryptedBuf = await webex.cypher.downloadAndDecryptFile(fileUrl, options);
    const file = new File([decryptedBuf], encryptedFileName, {type: mimeType});
    objectUrl = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = file.name || "download";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    decryptFileResult.innerText = ': success';
  }
  catch (error) {
    console.error('error decrypting file', error);
    decryptFileResult.innerText = ': error';
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function downloadKmsKey() {
  const kmsKeyUri = kmsKeyUriInput.value;

  if (!kmsKeyUri) {
    kmsKeyStatus.innerText = 'Status: Error - KMS Key URI is required';
    return;
  }

  if (!webex) {
    kmsKeyStatus.innerText = 'Status: Error - Webex not initialized. Please initialize Webex first.';
    return;
  }

  if (!tokenElm.value) {
    kmsKeyStatus.innerText = 'Status: Error - Access token is required. Please authenticate first.';
    return;
  }

  kmsKeyStatus.innerText = 'Status: Downloading KMS key...';
  downloadKmsKeyBtn.disabled = true;

  try {
    const key = await webex.cypher.getKey(kmsKeyUri);
    console.log('KMS Key downloaded successfully:', key);
    kmsKeyStatus.innerText = `Status: Success - KMS key downloaded successfully!\n\nKey URI: ${key.uri || kmsKeyUri}\nKey ID: ${key.keyId || 'N/A'}\nKey Type: ${key.jwk?.kty || 'N/A'}`;
  } catch (error) {
    console.error('Error downloading KMS key:', error);
    kmsKeyStatus.innerText = `Status: Failure - ${error.message || 'Failed to download KMS key'}`;
  } finally {
    downloadKmsKeyBtn.disabled = false;
  }
}
