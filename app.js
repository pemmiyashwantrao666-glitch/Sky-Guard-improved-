/**
 * SKYGUARD AI — Shared Application JavaScript
 * Handles: date display, offline detection, navigation, form interactions
 */

(function () {
  'use strict';

  // ---------- Current Date ----------
  function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (!dateEl) return;
    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    dateEl.textContent = now.toLocaleDateString('en-IN', options);
  }

  // ---------- Offline Detection ----------
  function setupOfflineDetection() {
    const bar = document.getElementById('offlineBar');
    if (!bar) return;

    function update() {
      bar.style.display = navigator.onLine ? 'none' : 'flex';
    }

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
  }

  // ---------- Navigation Scroll Effect ----------
  function setupNavScroll() {
    const nav = document.getElementById('navbar');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          if (window.scrollY > 10) {
            nav.classList.add('scrolled');
          } else {
            nav.classList.remove('scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // ---------- Form Autosave ----------
  function setupAutosave() {
    const form = document.getElementById('anomalyForm');
    const autosaveIndicator = document.querySelector('.autosave');
    if (!form || !autosaveIndicator) return;

    const STORAGE_KEY = 'skyguard_anomaly_draft';

    function save() {
      const data = {
        station: form.station?.value,
        date: form.date?.value,
        temperature: form.temperature?.value,
        humidity: form.humidity?.value,
        pressure: form.pressure?.value,
        category: form.category?.value,
        description: form.description?.value,
        savedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        // Storage full or unavailable
      }
    }

    function restore() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data.station && form.station) form.station.value = data.station;
        if (data.date && form.date) form.date.value = data.date;
        if (data.temperature && form.temperature) form.temperature.value = data.temperature;
        if (data.humidity && form.humidity) form.humidity.value = data.humidity;
        if (data.pressure && form.pressure) form.pressure.value = data.pressure;
        if (data.category && form.category) form.category.value = data.category;
        if (data.description && form.description) form.description.value = data.description;
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Debounced save
    let timeout;
    form.addEventListener('input', function () {
      clearTimeout(timeout);
      timeout = setTimeout(save, 800);
    });

    // Restore on load
    restore();

    // Clear on successful submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      localStorage.removeItem(STORAGE_KEY);
      alert('Anomaly report submitted successfully!');
    });
  }

  // ---------- File Upload Interaction ----------
  function setupFileUpload() {
    const uploads = document.querySelectorAll('.file-upload');
    uploads.forEach(function (upload) {
      upload.addEventListener('click', function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.csv,.json,image/*';
        input.onchange = function (e) {
          if (e.target.files.length > 0) {
            upload.querySelector('.file-upload-text').textContent =
              e.target.files.length + ' file(s) selected';
          }
        };
        input.click();
      });

      // Drag and drop
      upload.addEventListener('dragover', function (e) {
        e.preventDefault();
        upload.style.borderColor = 'var(--accent)';
        upload.style.background = 'var(--accent-light)';
      });

      upload.addEventListener('dragleave', function () {
        upload.style.borderColor = '';
        upload.style.background = '';
      });

      upload.addEventListener('drop', function (e) {
        e.preventDefault();
        upload.style.borderColor = '';
        upload.style.background = '';
        if (e.dataTransfer.files.length > 0) {
          upload.querySelector('.file-upload-text').textContent =
            e.dataTransfer.files.length + ' file(s) selected';
        }
      });
    });
  }

  // ---------- Mobile Bottom Nav ----------
  function setupBottomNav() {
    const items = document.querySelectorAll('.bottom-nav-item');
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        items.forEach(function (i) { i.classList.remove('active'); });
        item.classList.add('active');
      });
    });
  }

  // ---------- Initialize ----------
  function init() {
    updateDate();
    setupOfflineDetection();
    setupNavScroll();
    setupAutosave();
    setupFileUpload();
    setupBottomNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
