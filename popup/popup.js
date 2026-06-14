;(function () {
  'use strict';

  function init() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
          const urlEl = document.getElementById('tab-url');
          if (urlEl) {
            urlEl.textContent = tabs[0].url || 'No URL';
          }
        }
      });
    } catch (err) {
      console.error('tabs.query error:', err);
    }

    try {
      chrome.runtime.sendMessage({ type: 'LICENSE_STATUS' }, function (response) {
        if (chrome.runtime.lastError) return;
        const line = document.getElementById('license-line');
        if (line && response) {
          line.textContent = 'License: ' + (response.tier === 'pro' ? 'Pro \u2713' : 'Free');
        }
      });
    } catch (err) {
      console.error('LICENSE_STATUS error:', err);
    }

    try {
      document.getElementById('btn-open-panel').addEventListener('click', function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (tabs && tabs[0]) {
            chrome.sidePanel.open({ tabId: tabs[0].id }).then(function () {
              window.close();
            }).catch(function () {
              window.close();
            });
          }
        });
      });
    } catch (err) {
      console.error('btn-open-panel error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
