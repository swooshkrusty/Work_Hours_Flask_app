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

// ========= ХЕЛПЕРЫ =========
const pad = (n) => String(n).padStart(2, '0');
const toAmPm = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${ap}`;
};

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
    // обычная печать
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.activeElement?.blur?.();
      setTimeout(() => { try { window.print(); } catch(_) {} }, 60);
    });
  }
});

// ========= ФОРМА (index.html) =========
document.addEventListener('DOMContentLoaded', () => {
  const tbody      = document.getElementById('tbody');
  const addRowBtn  = document.getElementById('addRow');
  const monthInput = document.getElementById('monthInput');
  const yearInput  = document.getElementById('year'); // у <input name="year"> должен быть id="year"

  if (!tbody || !addRowBtn) return; // мы не на index.html

  // месяц по умолчанию — текущий, если пусто
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toLocaleString('en-US', { month: 'long' });
  }

  // запретить отправку формы по Enter в любом input (особенно на iOS)
  document.getElementById('form')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });

  function addRow() {
    const tr = document.createElement('tr');
    tr.classList.add('scale-up-right');

    // ---- Date ----
    const tdDate = document.createElement('td');
    const dateWrap = document.createElement('div'); dateWrap.className = 'picker-wrap';
    const dateInput = document.createElement('input');
    dateInput.name = 'date[]';
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.className = 'date-input';
    dateInput.autocomplete = 'off';
    dateInput.inputMode = 'none'; // iOS не показывает клаву, только колесо
    const dateBtn = document.createElement('button');
    dateBtn.type = 'button'; dateBtn.className = 'picker-btn'; dateBtn.textContent = '📅';
    dateBtn.setAttribute('aria-label','Pick date');
    dateWrap.append(dateInput, dateBtn);
    tdDate.appendChild(dateWrap);

    // ---- Start time ----
    const tdStart = document.createElement('td');
    const startWrap = document.createElement('div'); startWrap.className = 'picker-wrap';
    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.step = '60';
    startInput.required = true;
    startInput.className = 'time-input start';
    startInput.autocomplete = 'off';
    startInput.inputMode = 'none';     // для iOS — колесо
    startInput.enterKeyHint = 'done';
    const startBtn = document.createElement('button');
    startBtn.type = 'button'; startBtn.className = 'picker-btn'; startBtn.textContent = '🕒';
    startBtn.setAttribute('aria-label','Pick start time');
    startWrap.append(startInput, startBtn);
    tdStart.appendChild(startWrap);

    // ---- End time ----
    const tdEnd = document.createElement('td');
    const endWrap = document.createElement('div'); endWrap.className = 'picker-wrap';
    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.step = '60';
    endInput.required = true;
    endInput.className = 'time-input end';
    endInput.autocomplete = 'off';
    endInput.inputMode = 'none';
    endInput.enterKeyHint = 'done';
    const endBtn = document.createElement('button');
    endBtn.type = 'button'; endBtn.className = 'picker-btn'; endBtn.textContent = '🕒';
    endBtn.setAttribute('aria-label','Pick end time');
    endWrap.append(endInput, endBtn);
    tdEnd.appendChild(endWrap);

    // ---- Preview + hidden ----
    const tdPreview = document.createElement('td');
    const preview = document.createElement('div'); preview.className = 'range-preview';
    const hiddenRange = document.createElement('input'); hiddenRange.type = 'hidden'; hiddenRange.name = 'range[]';
    tdPreview.append(preview, hiddenRange);

    // ---- Remove ----
    const tdDel = document.createElement('td'); tdDel.className = 'noprint';
    const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'btn danger'; delBtn.textContent = '×';
    delBtn.addEventListener('click', () => tr.remove());
    tdDel.appendChild(delBtn);

    // ---- Sync preview ----
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
    }
    startInput.addEventListener('change', update);
    endInput.addEventListener('change', update);
    update();

    tr.append(tdDate, tdStart, tdEnd, tdPreview, tdDel);
    tbody.appendChild(tr);
  }

  addRowBtn.addEventListener('click', addRow);
  addRow(); // первая строка
});