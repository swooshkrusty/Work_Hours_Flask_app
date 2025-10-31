// ========= result.html: печать =========
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', (e) => {
      e.preventDefault();
      document.activeElement?.blur?.();
      setTimeout(() => window.print(), 80); // маленькая задержка для iOS
    });
  }
});

// ========= index.html: форма =========
document.addEventListener('DOMContentLoaded', () => {
  const tbody      = document.getElementById('tbody');
  const addRowBtn  = document.getElementById('addRow');
  const monthInput = document.getElementById('monthInput');
  const yearInput  = document.getElementById('year'); // <input id="year">

  // Если мы не на странице формы — выходим тихо.
  if (!tbody || !addRowBtn) return;

  // Месяц по умолчанию — текущий, если пусто.
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toLocaleString('en-US', { month: 'long' });
  }

  // ===== helpers =====
  const pad = (n) => String(n).padStart(2, '0');
  const toAmPm = (hhmm) => {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${pad(m)} ${ap}`;
  };
  const openPicker = (input) => {
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };

  // ===== одна функция — добавляет строку =====
  function addRow() {
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
    const dateBtn = document.createElement('button');
    dateBtn.type = 'button'; dateBtn.className = 'picker-btn'; dateBtn.textContent = '📅';
    dateBtn.setAttribute('aria-label','Pick date');
    dateBtn.addEventListener('click', () => openPicker(dateInput));
    dateWrap.append(dateInput, dateBtn);
    tdDate.appendChild(dateWrap);

    // Start time
    const tdStart = document.createElement('td');
    const startWrap = document.createElement('div'); startWrap.className = 'picker-wrap';
    const startInput = document.createElement('input');
    startInput.type = 'time'; startInput.step = '60';
    startInput.required = true; startInput.className = 'time-input start';
    const startBtn = document.createElement('button');
    startBtn.type = 'button'; startBtn.className = 'picker-btn'; startBtn.textContent = '🕒';
    startBtn.setAttribute('aria-label','Pick start time');
    startBtn.addEventListener('click', () => openPicker(startInput));
    startWrap.append(startInput, startBtn);
    tdStart.appendChild(startWrap);

    // End time
    const tdEnd = document.createElement('td');
    const endWrap = document.createElement('div'); endWrap.className = 'picker-wrap';
    const endInput = document.createElement('input');
    endInput.type = 'time'; endInput.step = '60';
    endInput.required = true; endInput.className = 'time-input end';
    const endBtn = document.createElement('button');
    endBtn.type = 'button'; endBtn.className = 'picker-btn'; endBtn.textContent = '🕒';
    endBtn.setAttribute('aria-label','Pick end time');
    endBtn.addEventListener('click', () => openPicker(endInput));
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
    delBtn.addEventListener('click', () => tr.remove());
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