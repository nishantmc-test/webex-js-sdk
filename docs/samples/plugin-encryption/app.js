/* eslint-env browser */

/* global Webex */

/* eslint-disable no-console */
/* eslint-disable require-jsdoc */

// Declare some globals that we'll need throughout.
let webex;
let enableProd = true;
let subscribedUserIds = [];

// Global variables for storing downloaded data
let downloadedKmsKey = null;
let downloadedJwe = null;
let decryptedAudioBuffer = null;

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

// DOM elements for the new download sections
const kmsKeyUriTextarea = document.querySelector('#kms-key-uri');
const downloadKmsKeyBtn = document.querySelector('#download-kms-key-btn');
const jweUrlTextarea = document.querySelector('#jwe-url');
const downloadJweBtn = document.querySelector('#download-jwe-btn');
const decryptJweBtn = document.querySelector('#decrypt-jwe-btn');
const downloadAudioBtn = document.querySelector('#download-audio-btn');
const playAudioBtn = document.querySelector('#play-audio-btn');
const audioPlayer = document.querySelector('#audio-player');

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

// =====================================================
// Upload and Encrypt File Section
// =====================================================

function addEncryptLog(message) {
  const logElm = document.querySelector('#encrypt-log');
  const timestamp = new Date().toLocaleTimeString();
  logElm.textContent = `[${timestamp}] ${message}\n` + logElm.textContent;
}

async function encryptUploadedFile() {
  const kmsKeyUri = document.querySelector('#encrypt-kms-key-uri').value;
  const fileInput = document.querySelector('#encrypt-file-input');
  const jweOutput = document.querySelector('#encrypt-jwe-output');

  addEncryptLog('Starting encryption...');

  if (!kmsKeyUri) {
    addEncryptLog('ERROR: KMS Key URI is required');
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    addEncryptLog('ERROR: Please select a file to encrypt');
    return;
  }

  const file = fileInput.files[0];
  addEncryptLog(`File selected: ${file.name} (${file.size} bytes, type: ${file.type})`);

  try {
    addEncryptLog('Reading file...');
    const arrayBuffer = await file.arrayBuffer();
    addEncryptLog(`File read successfully (${arrayBuffer.byteLength} bytes)`);

    addEncryptLog('Encrypting with KMS key...');
    const jweString = await webex.internal.encryption.encryptBinaryData(kmsKeyUri, arrayBuffer);
    addEncryptLog('Encryption successful!');

    jweOutput.value = jweString;
    addEncryptLog(`JWE generated (${jweString.length} characters)`);
  } catch (error) {
    console.error('Error encrypting file:', error);
    addEncryptLog(`ERROR: ${error.message || error}`);
    jweOutput.value = '';
  }
}

function copyJweToClipboard() {
  const jweOutput = document.querySelector('#encrypt-jwe-output');
  if (!jweOutput.value) {
    addEncryptLog('No JWE to copy');
    return;
  }

  navigator.clipboard.writeText(jweOutput.value).then(() => {
    addEncryptLog('JWE copied to clipboard!');
  }).catch((err) => {
    addEncryptLog(`Failed to copy: ${err}`);
  });

  // Handle audio playback
  playAudioBtn.addEventListener('click', function() {
    if (!decryptedAudioBuffer) {
      return; // Button should be disabled, but just in case
    }

    try {
      // Create a Blob from the audio buffer with proper MIME type
      // Try multiple MIME types in case the browser is picky
      let audioBlob;
      
      // First, check if the buffer already has WAV headers
      const bufferView = new Uint8Array(decryptedAudioBuffer);
      const hasWavHeader = bufferView[0] === 0x52 && bufferView[1] === 0x49 && 
                          bufferView[2] === 0x46 && bufferView[3] === 0x46; // "RIFF"
      
      if (hasWavHeader) {
        console.log('Audio buffer already has WAV headers');
        audioBlob = new Blob([decryptedAudioBuffer], { type: 'audio/wav' });
      } else {
        console.log('Audio buffer missing WAV headers - trying as raw audio');
        // Try different MIME types
        audioBlob = new Blob([decryptedAudioBuffer], { type: 'audio/wav' });
      }
      
      // Create object URL for the audio player
      const audioUrl = URL.createObjectURL(audioBlob);
      
      console.log('Audio blob created:', {
        size: audioBlob.size,
        type: audioBlob.type,
        hasWavHeader: hasWavHeader,
        bufferSize: decryptedAudioBuffer.byteLength
      });
      
      // Set the audio source and show the player
      audioPlayer.src = audioUrl;
      audioPlayer.style.display = 'block';
      audioPlayer.load(); // Explicitly load the audio
      
      // Play the audio
      audioPlayer.play().then(() => {
        console.log('Audio playback started successfully');
      }).catch((error) => {
        console.error('Error playing audio:', error);
        console.error('Audio element state:', {
          readyState: audioPlayer.readyState,
          networkState: audioPlayer.networkState,
          error: audioPlayer.error
        });
        
        // Try alternative approach - use AudioContext
        tryAudioContextPlayback(decryptedAudioBuffer);
        
        // Clean up the object URL on error
        URL.revokeObjectURL(audioUrl);
      });
      
      // Clean up object URL when audio ends
      audioPlayer.addEventListener('ended', function cleanupEnded() {
        URL.revokeObjectURL(audioUrl);
        audioPlayer.removeEventListener('ended', cleanupEnded);
      });
      
    } catch (error) {
      console.error('Error setting up audio playback:', error);
    }
  });

  // Alternative playback method using Web Audio API
  function tryAudioContextPlayback(buffer) {
    console.log('Trying AudioContext playback...');
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Try to decode the audio data
      audioContext.decodeAudioData(buffer.slice(0), 
        (decodedData) => {
          console.log('Audio decoded successfully:', {
            duration: decodedData.duration,
            sampleRate: decodedData.sampleRate,
            numberOfChannels: decodedData.numberOfChannels
          });
          
          const source = audioContext.createBufferSource();
          source.buffer = decodedData;
          source.connect(audioContext.destination);
          source.start(0);
          console.log('AudioContext playback started');
          
          // Hide the HTML audio player and show a message
          audioPlayer.style.display = 'none';
          const playbackMsg = document.createElement('div');
          playbackMsg.textContent = 'Playing audio via Web Audio API...';
          playbackMsg.style.color = 'green';
          playbackMsg.style.marginTop = '0.5rem';
          playbackMsg.id = 'audiocontext-playback-msg';
          
          // Remove any existing message
          const existingMsg = document.getElementById('audiocontext-playback-msg');
          if (existingMsg) existingMsg.remove();
          
          playAudioBtn.parentNode.appendChild(playbackMsg);
          
          source.onended = () => {
            console.log('AudioContext playback ended');
            playbackMsg.textContent = 'Playback finished';
          };
        },
        (error) => {
          console.error('Error decoding audio data:', error);
          alert('Unable to play audio. The file format may not be supported by your browser.');
        }
      );
    } catch (error) {
      console.error('Error with AudioContext:', error);
      alert('Unable to play audio. Your browser may not support the Web Audio API.');
    }
  }
}

async function generateKeyAndKro() {
  const resourceUriInput = document.querySelector('#new-kro-resource-uri');
  const statusElm = document.querySelector('#generate-key-status');
  const kmsKeyUriInput = document.querySelector('#encrypt-kms-key-uri');

  statusElm.textContent = 'Generating key and KRO...';

  try {
    // Create a new unbound key
    statusElm.textContent = 'Creating unbound key...';
    const key = await webex.internal.encryption.kms.createUnboundKeys({count: 1});
    const unboundKey = key[0];
    statusElm.textContent = `Unbound key created: ${unboundKey.uri}`;

    // If resource URI is provided, create a KRO and bind the key
    if (resourceUriInput.value) {
      statusElm.textContent = 'Creating KRO and binding key...';
      const kro = await webex.internal.encryption.kms.createResource({
        key: unboundKey,
        userIds: []
      });
      statusElm.textContent = `KRO created!\nKey URI: ${unboundKey.uri}\nKRO URI: ${kro.uri}`;
      kmsKeyUriInput.value = unboundKey.uri;
    } else {
      kmsKeyUriInput.value = unboundKey.uri;
      statusElm.textContent = `Key created!\nKey URI: ${unboundKey.uri}\n(No KRO created - resource URI not provided)`;
    }

    addEncryptLog(`Key generated: ${unboundKey.uri}`);
  } catch (error) {
    console.error('Error generating key/KRO:', error);
    statusElm.textContent = `Error: ${error.message || error}`;
  }
}
