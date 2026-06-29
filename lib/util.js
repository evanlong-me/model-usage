const https = require('https');

function cwdToProjectName(cwd) {
  if (!cwd) return null;
  const normalized = require('path').resolve(cwd);
  if (normalized === require('path').resolve(require('os').homedir())) return '~';
  return require('path').basename(normalized);
}

function getDateStr(timestamp) {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    request.on('error', (error) => {
      reject(new Error(`Network request failed: ${error.message}`));
    });
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

module.exports = { cwdToProjectName, getDateStr, fetchJson };
