const tbody = document.getElementById('tbody');
document.getElementById('addRow').addEventListener('click', () => addRow());

document.addEventListener("DOMContentLoaded", () => {
  const monthInput = document.getElementById("monthInput");
  const currentMonthName = new Date().toLocaleString("en-US", { month: "long" });
  if (!monthInput.value) {
    monthInput.value = currentMonthName; // Пример: November
  }
});

function opt(val, text){ 
  const o = document.createElement('option'); 
  o.value = val; 
  o.textContent = text ?? val; 
  return o; 
}

function makeSelectHour(){ 
  const s = document.createElement('select'); 
  for(let h = 1; h <= 12; h++) s.appendChild(opt(h)); 
  return s; 
}

function makeSelectMinute(step = 1){
  const s = document.createElement('select');
  for(let m = 0; m < 60; m += step) 
    s.appendChild(opt(m.toString().padStart(2,'0')));
  return s;
}

function makeSelectAmPm(){ 
  const s = document.createElement('select'); 
  s.appendChild(opt('am','AM')); 
  s.appendChild(opt('pm','PM')); 
  return s; 
}

function fmt(h, m, ap){ 
  return `${h}:${m} ${ap}`; 
}

function addRow(){
  const tr = document.createElement('tr');

  // 📅 Date picker
  const tdDate = document.createElement('td');
  const dateInput = document.createElement('input');
  dateInput.name = 'date[]';
  dateInput.type = 'date';
  dateInput.required = true;
  dateInput.className = 'date-input';
  tdDate.appendChild(dateInput);

  // Start shift pickers
  const tdStart = document.createElement('td');
  const sHour = makeSelectHour(), sMin = makeSelectMinute(), sAP = makeSelectAmPm();
  const startWrap = document.createElement('div'); 
  startWrap.className = 'pickers';
  startWrap.append(sHour, sMin, sAP); 
  tdStart.appendChild(startWrap);

  // End shift pickers
  const tdEnd = document.createElement('td');
  const eHour = makeSelectHour(), eMin = makeSelectMinute(), eAP = makeSelectAmPm();
  const endWrap = document.createElement('div'); 
  endWrap.className = 'pickers';
  endWrap.append(eHour, eMin, eAP); 
  tdEnd.appendChild(endWrap);

  // Preview + hidden range
  const tdPreview = document.createElement('td');
  const preview = document.createElement('div'); 
  preview.className = 'range-preview';
  const hiddenRange = document.createElement('input'); 
  hiddenRange.type = 'hidden'; 
  hiddenRange.name = 'range[]';
  tdPreview.append(preview, hiddenRange);

  // Remove button
  const tdDel = document.createElement('td'); 
  tdDel.className = 'noprint';
  const delBtn = document.createElement('button'); 
  delBtn.type = 'button'; 
  delBtn.className = 'btn danger'; 
  delBtn.textContent = '×';
  delBtn.onclick = () => tr.remove();
  tdDel.appendChild(delBtn);

  function update(){
    const startLabel = fmt(sHour.value, sMin.value, sAP.value);
    const endLabel = fmt(eHour.value, eMin.value, eAP.value);
    preview.textContent = `${startLabel} – ${endLabel}`;
    hiddenRange.value = `${startLabel} - ${endLabel}`; // for backend
  }

  [sHour,sMin,sAP,eHour,eMin,eAP].forEach(el => el.addEventListener('change', update));
  update();

  tr.append(tdDate, tdStart, tdEnd, tdPreview, tdDel);
  tbody.appendChild(tr);
}

// Add one default row
addRow();

// Optional: when Month or Year changes, set the month/year on empty date fields
['monthInput', 'year'].forEach(id => {
  const el = document.getElementById(id) || document.querySelector(`input[name="${id}"]`);
  if (!el) return;
  el.addEventListener('change', () => {
    const y = currentYear();
    const m = selectedMonth();
    [...tbody.querySelectorAll('input[type="date"]')].forEach(inp => {
      if (!inp.value) inp.value = yyyyMmDd(y, m, 1);
    });
  });
});