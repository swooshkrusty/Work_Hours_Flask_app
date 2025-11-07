// ========= КНОПКИ-ПИКЕРЫ (📅/🕒) =========
// Делегирование: клик по .picker-btn открывает нативный picker у соседнего <input>
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.picker-btn');
  if (!btn) return;
  const input = btn.previousElementSibling;
  if (!input) return;
  if (typeof input.showPicker === 'function') input.showPicker();
  else input.focus();
});

document.addEventListener('DOMContentLoaded', () => {
  const editBtn = document.getElementById('editBtn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // localStorage уже сохранён; просто вернёмся назад
      if (history.length > 1) history.back();
      else window.location.href = editBtn.href;
    });
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const tzInput = document.getElementById('tz');
  if (tzInput && !tzInput.value) {
    try {
      tzInput.value = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (_) {}
  }
});

// ========= ХЕЛПЕРЫ =========
const pad   = (n) => String(n).padStart(2, '0');
const toAmPm = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${ap}`;
};

function uiConfirm({ title="Confirm", message="Are you sure?", okText="OK", cancelText="Cancel" } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    function cleanup(val) {
      root.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      root.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(val);
    }
    function onOk(){ cleanup(true); }
    function onCancel(){ cleanup(false); }
    function onBackdrop(e){ if (e.target === root) cleanup(false); }
    function onKey(e){ if (e.key === 'Escape') cleanup(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    root.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);

    root.hidden = false;
    okBtn.focus();
  });
}

function uiAlert({ title="Notice", message="Done", okText="OK" } = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modalRoot');
    const titleEl = document.getElementById('modalTitle');
    const msgEl = document.getElementById('modalMessage');
    const okBtn = document.getElementById('modalOk');
    const cancelBtn = document.getElementById('modalCancel');

    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.textContent = okText;
    cancelBtn.style.display = 'none';

    function cleanup() {
      root.hidden = true;
      okBtn.removeEventListener('click', onOk);
      root.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      cancelBtn.style.display = '';
      resolve();
    }
    function onOk(){ cleanup(); }
    function onBackdrop(e){ if (e.target === root) cleanup(); }
    function onKey(e){ if (e.key === 'Escape') cleanup(); }

    okBtn.addEventListener('click', onOk);
    root.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);

    root.hidden = false;
    okBtn.focus();
  });
}

// ========= ПЕЧАТЬ / IN-APP BROWSERS =========
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printBtn');
  const iabBox   = document.getElementById('iabNotice');
  if (!printBtn) return; // мы не на result.html

  const ua = navigator.userAgent || "";
  const isTelegram = /Telegram/i.test(ua) || !!window.TelegramWebviewProxy;
  const isFB_IAB   = /(FBAN|FB_IAB|FBAV|Instagram)/i.test(ua);
  const inApp = isTelegram || isFB_IAB;

  if (inApp) {
    iabBox?.removeAttribute('hidden');
    printBtn.textContent = 'Open in Browser to Print';
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const url = location.href;
      if (navigator.share) {
        navigator.share({ url }).catch(() => {
          navigator.clipboard?.writeText(url);
          alert('Link copied. Open in Safari/Chrome and print.');
        });
      } else {
        navigator.clipboard?.writeText(url);
        alert('Link copied. Open in Safari/Chrome and print.');
      }
    });

    const open = document.getElementById('openInBrowser');
    const copy = document.getElementById('copyLink');
    open?.addEventListener('click', (e) => {
      e.preventDefault();
      const url = location.href;
      if (navigator.share) navigator.share({ url }).catch(()=>{});
      else { navigator.clipboard?.writeText(url); alert('Link copied. Open in Safari/Chrome.'); }
    });
    copy?.addEventListener('click', () => {
      navigator.clipboard?.writeText(location.href);
      copy.textContent = 'Copied!';
      setTimeout(() => (copy.textContent = 'Copy link'), 1500);
    });
  } else {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.activeElement?.blur?.();
      setTimeout(() => { try { window.print(); } catch(_) {} }, 60);
    });
  }
});

// ========= ФОРМА (index.html) + АВТОСОХРАНЕНИЕ =========
document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('form');
  const tbody      = document.getElementById('tbody');
  const addRowBtn  = document.getElementById('addRow');
  const lastName   = document.querySelector('input[name="last_name"]');
  const firstName  = document.querySelector('input[name="first_name"]');
  const yearInput  = document.getElementById('year');

  if (!form || !tbody || !addRowBtn) return; // мы не на index.html

  // --- черновик ---
  const STORAGE_KEY = 'wh_draft_v1';

  const saveDraft = () => {
    const rows = [...tbody.querySelectorAll('tr')].map(tr => ({
      date:  tr.querySelector('.date-input')?.value || '',
      start: tr.querySelector('.time-input.start')?.value || '',
      end:   tr.querySelector('.time-input.end')?.value || '',
    })).filter(r => r.date || r.start || r.end);

    const draft = {
      last_name:  lastName?.value || '',
      first_name: firstName?.value || '',
      year:       yearInput?.value || '',
      rows
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (_) {}
  };

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  };

  const debounce = (fn, ms=300) => {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const saveDraftDebounced = debounce(saveDraft, 250);

  // --- построитель строки ---
  function addRow(prefill=null) {
    const tr = document.createElement('tr');
    tr.classList.add('scale-up-right');

    // Date
    const tdDate = document.createElement('td');
    const dateWrap = document.createElement('div'); dateWrap.className = 'picker-wrap';
    const dateInput = document.createElement('input');
    dateInput.name = 'date[]';
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.className = 'date-input';
    dateInput.autocomplete = 'off';
    dateInput.inputMode = 'none';
    const dateBtn = document.createElement('button');
    dateBtn.type = 'button'; dateBtn.className = 'picker-btn'; dateBtn.textContent = '📅';
    dateBtn.setAttribute('aria-label','Pick date');
    dateWrap.append(dateInput, dateBtn);
    tdDate.appendChild(dateWrap);

    // Start
    const tdStart = document.createElement('td');
    const startWrap = document.createElement('div'); startWrap.className = 'picker-wrap';
    const startInput = document.createElement('input');
    startInput.type = 'time'; startInput.step = '60'; startInput.required = true;
    startInput.className = 'time-input start'; startInput.autocomplete = 'off'; startInput.inputMode = 'none';
    const startBtn = document.createElement('button');
    startBtn.type = 'button'; startBtn.className = 'picker-btn'; startBtn.textContent = '🕒';
    startBtn.setAttribute('aria-label','Pick start time');
    startWrap.append(startInput, startBtn);
    tdStart.appendChild(startWrap);

    // End
    const tdEnd = document.createElement('td');
    const endWrap = document.createElement('div'); endWrap.className = 'picker-wrap';
    const endInput = document.createElement('input');
    endInput.type = 'time'; endInput.step = '60'; endInput.required = true;
    endInput.className = 'time-input end'; endInput.autocomplete = 'off'; endInput.inputMode = 'none';
    const endBtn = document.createElement('button');
    endBtn.type = 'button'; endBtn.className = 'picker-btn'; endBtn.textContent = '🕒';
    endBtn.setAttribute('aria-label','Pick end time');
    endWrap.append(endInput, endBtn);
    tdEnd.appendChild(endWrap);

    // Preview + hidden
    const tdPreview = document.createElement('td');
    const preview = document.createElement('div'); preview.className = 'range-preview';
    const hiddenRange = document.createElement('input'); hiddenRange.type = 'hidden'; hiddenRange.name = 'range[]';
    tdPreview.append(preview, hiddenRange);

    // Remove
    const tdDel = document.createElement('td'); tdDel.className = 'noprint';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'btn danger'; delBtn.textContent = '×';
    delBtn.addEventListener('click', () => { tr.remove(); saveDraftDebounced(); });
    tdDel.appendChild(delBtn);

    function update() {
      const sLabel = toAmPm(startInput.value);
      const eLabel = toAmPm(endInput.value);
      if (sLabel && eLabel) {
        preview.textContent = `${sLabel} – ${eLabel}`;
        hiddenRange.value   = `${sLabel} - ${eLabel}`;
      } else {
        preview.textContent = '';
        hiddenRange.value = '';
      }
      saveDraftDebounced();
    }
    dateInput.addEventListener('change', update);
    startInput.addEventListener('change', update);
    endInput.addEventListener('change', update);

    tr.append(tdDate, tdStart, tdEnd, tdPreview, tdDel);
    tbody.appendChild(tr);

    // префилл из черновика
    if (prefill) {
      if (prefill.date)  dateInput.value  = prefill.date;
      if (prefill.start) startInput.value = prefill.start;
      if (prefill.end)   endInput.value   = prefill.end;
    }
    update();
  }

  // Восстановление черновика
  const draft = loadDraft();
  if (draft) {
    if (lastName)  lastName.value  = draft.last_name || '';
    if (firstName) firstName.value = draft.first_name || '';
    if (yearInput) yearInput.value = draft.year || new Date().getFullYear();
    if (Array.isArray(draft.rows) && draft.rows.length) {
      draft.rows.forEach(r => addRow(r));
    } else {
      addRow();
    }
  } else {
    addRow();
  }

  // Сохранять при любом вводе
  form.addEventListener('input', saveDraftDebounced);

  // Не отправлять форму по Enter
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  // «+ Add day»
  addRowBtn.addEventListener('click', () => { addRow(); saveDraftDebounced(); });
  // ===== CLEAR ALL BUTTON =====
const clearBtn = document.getElementById('clearAll');
if (clearBtn) {
  clearBtn.addEventListener('click', async () => {
    const ok = await uiConfirm({
      title: "Clear all data",
      message: "This will delete all saved rows and fields. Continue?",
      okText: "Clear",
      cancelText: "Cancel"
    });
    if (!ok) return;

    localStorage.removeItem('wh_draft_v1');
    tbody.innerHTML = '';
    addRow();
    document.querySelector('input[name="last_name"]').value = '';
    document.querySelector('input[name="first_name"]').value = '';
    document.getElementById('year').value = new Date().getFullYear();

    await uiAlert({
      title: "Done",
      message: "All data has been cleared.",
      okText: "OK"
    });
  });
}
  // Если хочешь чистить черновик после успешного сабмита,
  // раскомментируй следующую строку:
  // form.addEventListener('submit', () => localStorage.removeItem(STORAGE_KEY));
});

document.addEventListener('DOMContentLoaded', () => {
  const btnPdf = document.getElementById('savePdfBtn');
  const btnJpg = document.getElementById('saveJpgBtn');

  async function exportFile(fmt) {
    const btn = fmt === 'pdf' ? btnPdf : btnJpg;
    if (!btn) return;

    // лёгкий индикатор
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing...';

    try {
      // Берём весь HTML текущей страницы. Можно ограничить область, если есть контейнер.
      const html = document.documentElement.outerHTML;

      const res = await fetch('/export', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ html, format: fmt })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);

      // Скачиваем файл (на iPhone для JPG будет «Сохранить изображение» → Photos)
      const a = document.createElement('a');
      a.href = url;
      a.download = fmt === 'pdf' ? 'work-hours.pdf' : 'work-hours.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Export failed: ' + (e.message || e));
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  }

  btnPdf?.addEventListener('click', (e) => { e.preventDefault(); exportFile('pdf'); });
  btnJpg?.addEventListener('click', (e) => { e.preventDefault(); exportFile('jpg'); });
});