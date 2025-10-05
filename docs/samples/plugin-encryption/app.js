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
const encryptedJweUrlInput = document.querySelector('#encrypted-jwe-url');
const downloadJweBtn = document.querySelector('#download-jwe-btn');
const downloadJweStatus = document.querySelector('#download-jwe-status');
const decryptContentBtn = document.querySelector('#decrypt-content-btn');
const saveDecryptedAudioBtn = document.querySelector('#save-decrypted-audio-btn');
const decryptContentStatus = document.querySelector('#decrypt-content-status');

// Store downloaded data for future use
let downloadedKmsKeyUri = null;
let downloadedJWE = null;
let decryptedContentBuffer = null;

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
    const key = await webex.internal.encryption.getKey(kmsKeyUri);
    console.log('KMS Key downloaded successfully:', key);
    downloadedKmsKeyUri = kmsKeyUri;
    kmsKeyStatus.innerText = `Status: Success - KMS key downloaded successfully!\n\nKey URI: ${key.uri || kmsKeyUri}\nKey ID: ${key.keyId || 'N/A'}\nKey Type: ${key.jwk?.kty || 'N/A'}`;
  } catch (error) {
    console.error('Error downloading KMS key:', error);
    downloadedKmsKeyUri = null;
    kmsKeyStatus.innerText = `Status: Failure - ${error.message || 'Failed to download KMS key'}`;
  } finally {
    downloadKmsKeyBtn.disabled = false;
  }
}

async function downloadEncryptedJWE() {
  const jweUrl = encryptedJweUrlInput.value;

  if (!jweUrl) {
    downloadJweStatus.innerText = 'Status: Error - JWE URL is required';
    return;
  }

  if (!webex) {
    downloadJweStatus.innerText = 'Status: Error - Webex not initialized. Please initialize Webex first.';
    return;
  }

  downloadJweStatus.innerText = 'Status: Downloading JWE content...';
  downloadJweBtn.disabled = true;

  try {
    const response = await fetch(jweUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenElm.value}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }

    const jweContent = await response.text();
    const contentSize = jweContent.length;
    const sizeInKB = (contentSize / 1024).toFixed(2);
    const sizeInBytes = new Blob([jweContent]).size;

    // Store the JWE for future use
    downloadedJWE = jweContent;

    console.log('JWE downloaded successfully:', {
      url: jweUrl,
      size: contentSize,
      sizeInKB: sizeInKB,
      sizeInBytes: sizeInBytes
    });

    downloadJweStatus.innerText = `Status: Success - JWE downloaded successfully!\n\nSize: ${contentSize} characters (${sizeInKB} KB / ${sizeInBytes} bytes)\n\nJWE stored for decryption.`;
  } catch (error) {
    console.error('Error downloading JWE:', error);
    downloadedJWE = null;
    downloadJweStatus.innerText = `Status: Failure - ${error.message || 'Failed to download JWE'}\n\nDetails: ${error.stack || 'No additional details available'}`;
  } finally {
    downloadJweBtn.disabled = false;
  }
}

async function decryptContent() {
  // Validate prerequisites
  if (!downloadedKmsKeyUri) {
    decryptContentStatus.innerText = 'Status: Error - Please download the KMS key first from the "Download KMS Key" section above.';
    return;
  }

  if (!downloadedJWE) {
    decryptContentStatus.innerText = 'Status: Error - Please download the encrypted content (JWE) first from the "Download Encrypted Content" section above.';
    return;
  }

  if (!webex) {
    decryptContentStatus.innerText = 'Status: Error - Webex not initialized. Please initialize Webex first.';
    return;
  }

  decryptContentStatus.innerText = 'Status: Decrypting content...';
  decryptContentBtn.disabled = true;
  saveDecryptedAudioBtn.style.display = 'none';

  try {
    // Use decryptBinaryData to decrypt the JWE content
    const decryptedBuffer = await webex.internal.encryption.decryptBinaryData(
      downloadedKmsKeyUri,
      downloadedJWE
    );

    // Store the decrypted content
    decryptedContentBuffer = decryptedBuffer;

    const decryptedSize = decryptedBuffer.byteLength || decryptedBuffer.length;
    const sizeInKB = (decryptedSize / 1024).toFixed(2);
    const sizeInMB = (decryptedSize / (1024 * 1024)).toFixed(2);

    console.log('Content decrypted successfully:', {
      size: decryptedSize,
      sizeInKB: sizeInKB,
      sizeInMB: sizeInMB,
      bufferType: Object.prototype.toString.call(decryptedBuffer)
    });

    decryptContentStatus.innerText = `Status: Success - Content decrypted successfully!\n\nDecrypted Size: ${decryptedSize} bytes (${sizeInKB} KB / ${sizeInMB} MB)\n\nClick the button below to download the decrypted audio file.`;
    
    // Show the download button
    saveDecryptedAudioBtn.style.display = 'block';
  } catch (error) {
    console.error('Error decrypting content:', error);
    decryptedContentBuffer = null;
    decryptContentStatus.innerText = `Status: Failure - Decryption failed\n\nError: ${error.message || 'Unknown error occurred'}\n\nDetails: ${error.stack || 'No additional details available'}`;
  } finally {
    decryptContentBtn.disabled = false;
  }
}

function saveDecryptedAudio() {
  if (!decryptedContentBuffer) {
    decryptContentStatus.innerText = 'Status: Error - No decrypted content available. Please decrypt the content first.';
    return;
  }

  try {
    // Create a Blob from the decrypted buffer for WAV audio
    const blob = new Blob([decryptedContentBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link and trigger download
    const timestamp = Date.now();
    const filename = `decrypted-audio-${timestamp}.wav`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('Decrypted audio file saved:', filename);
    decryptContentStatus.innerText = `Status: Success - Decrypted audio file downloaded!\n\nFilename: ${filename}\nSize: ${blob.size} bytes`;
  } catch (error) {
    console.error('Error saving decrypted audio:', error);
    decryptContentStatus.innerText = `Status: Error - Failed to save decrypted audio\n\nError: ${error.message || 'Unknown error occurred'}`;
  }
}
