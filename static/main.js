// ===== result.html: Print =====
document.addEventListener('DOMContentLoaded', () => {
  const printBtn = document.getElementById('printBtn');
  if (!printBtn) return;
  printBtn.addEventListener('click', (e) => {
    e.preventDefault();
    document.activeElement?.blur?.();
    setTimeout(() => window.print(), 50);
  });
});

// ===== index.html: form =====
document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.getElementById('tbody');
  const addRowBtn = document.getElementById('addRow');
  const monthInput = document.getElementById('monthInput');
  const yearInput = document.getElementById('year');

  if (!tbody || !addRowBtn) return;

  // Месяц по умолчанию = текущий
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toLocaleString('en-US', { month: 'long' });
  }

  // Вспомогалки
  const pad = (n) => String(n).padStart(2, '0');
  const toAmPm = (hhmm) => {
    // hhmm = "23:05" -> "11:05 pm"
    const [h, m] = hhmm.split(':').map(Number);
    const ap = h >= 12 ? 'pm' : 'am';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${pad(m)} ${ap}`;
  };

  // Попытка открыть системный пикер программно
  const openPicker = (input) => {
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.focus();
  };

  function addRow() {
    const tr = document.createElement('tr');

    // Date cell
    const tdDate = document.createElement('td');
    const dateWrap = document.createElement('div'); dateWrap.className = 'picker-wrap';
    const dateInput = document.createElement('input');
    dateInput.name = 'date[]';
    dateInput.type = 'date';
    dateInput.required = true;
    dateInput.className = 'date-input';
    const dateBtn = document.createElement('button');
    dateBtn.type = 'button'; dateBtn.className = 'picker-btn'; dateBtn.textContent = '📅';
    dateBtn.addEventListener('click', () => openPicker(dateInput));
    dateWrap.append(dateInput, dateBtn);
    tdDate.appendChild(dateWrap);

    // Start time
    const tdStart = document.createElement('td');
    const startWrap = document.createElement('div'); startWrap.className = 'picker-wrap';
    const startInput = document.createElement('input');
    startInput.type = 'time'; startInput.step = '60'; // минутные шаги
    startInput.required = true; startInput.className = 'time-input start';
    const startBtn = document.createElement('button');
    startBtn.type = 'button'; startBtn.className = 'picker-btn'; startBtn.textContent = '🕒';
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
    endBtn.addEventListener('click', () => openPicker(endInput));
    endWrap.append(endInput, endBtn);
    tdEnd.appendChild(endWrap);

    // Preview + hidden range
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
      const s = startInput.value; // "HH:MM" или ""
      const e = endInput.value;
      const sLabel = s ? toAmPm(s) : '—';
      const eLabel = e ? toAmPm(e) : '—';
      preview.textContent = (s && e) ? `${sLabel} – ${eLabel}` : '';
      hiddenRange.value   = (s && e) ? `${sLabel} - ${eLabel}` : '';
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