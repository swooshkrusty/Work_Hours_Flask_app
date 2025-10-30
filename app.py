from __future__ import annotations

import os
import re
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

TIME_RGX = re.compile(
    r"^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$",
    re.IGNORECASE,
)

MONTH_ALIASES = {
    "1": 1, "01": 1, "jan": 1, "january": 1,
    "2": 2, "02": 2, "feb": 2, "february": 2,
    "3": 3, "03": 3, "mar": 3, "march": 3,
    "4": 4, "04": 4, "apr": 4, "april": 4,
    "5": 5, "05": 5, "may": 5,                 # (remove duplicate "may": 5)
    "6": 6, "06": 6, "jun": 6, "june": 6,
    "7": 7, "07": 7, "jul": 7, "july": 7,
    "8": 8, "08": 8, "aug": 8, "august": 8,
    "9": 9, "09": 9, "sep": 9, "sept": 9, "september": 9,
    "10": 10, "oct": 10, "october": 10,
    "11": 11, "nov": 11, "november": 11,
    "12": 12, "dec": 12, "december": 12,
}

def parse_month(s: str) -> int:
    key = s.strip().lower()
    if key not in MONTH_ALIASES:
        raise ValueError(f"Unrecognized month: {s}")
    return MONTH_ALIASES[key]

def to_24h(hour12: int, minute: int, ampm: str) -> tuple[int, int]:
    ampm = ampm.lower()
    h = hour12 % 12
    if ampm == "pm":
        h += 12
    return h, minute

def parse_range(date_obj: datetime, rng: str) -> tuple[datetime, datetime, int, int]:
    m = TIME_RGX.match(rng)
    if not m:
        raise ValueError("Time range must be like '3:52 pm - 1:11 am'")
    sh, sm, sa, eh, em, ea = m.groups()
    sh, sm, eh, em = int(sh), int(sm), int(eh), int(em)
    sh24, sm = to_24h(sh, sm, sa)
    eh24, em = to_24h(eh, em, ea)

    start = date_obj.replace(hour=sh24, minute=sm, second=0, microsecond=0)
    end = date_obj.replace(hour=eh24, minute=em, second=0, microsecond=0)
    if end <= start:
        end += timedelta(days=1)

    minutes_total = int((end - start).total_seconds() // 60)
    h, m = divmod(minutes_total, 60)
    return start, end, h, m

def day_name(dt: datetime) -> str:
    return dt.strftime("%A")

# ---------- ADD THIS: the form page ----------
@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

# ---------- Builder ----------
@app.route("/build", methods=["GET", "POST"])
def build():
    if request.method == "GET":
        # Refreshing /build directly? Send back to the form instead of 404.
        return redirect(url_for("index"))

    last_name = request.form.get("last_name", "").strip()
    first_name = request.form.get("first_name", "").strip()
    month_raw = request.form.get("month", "").strip()
    year = int(request.form.get("year", "0") or 0)

    dates = request.form.getlist("date[]")
    ranges = request.form.getlist("range[]")

    mon = parse_month(month_raw)
    month_name = datetime(2000, mon, 1).strftime("%B")

    rows = []
    total_minutes = 0

    for d_str, r_str in zip(dates, ranges):
        d_str = (d_str or "").strip()
        r_str = (r_str or "").strip()
        if not d_str or not r_str:
            continue

        # HTML5 <input type="date">  -> YYYY-MM-DD
        base_date = None
        if re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
            try:
                base_date = datetime.strptime(d_str, "%Y-%m-%d")
            except ValueError:
                base_date = None

        # Fallbacks: MM/DD, MM/DD/YYYY, or DD (use Month/Year from form)
        if base_date is None:
            d_str_clean = d_str.replace("-", "/")
            parts = [p for p in d_str_clean.split("/") if p]
            try:
                if len(parts) == 1:
                    day = int(parts[0])
                    base_date = datetime(year, mon, day)
                elif len(parts) == 2:
                    m_in = int(parts[0]); day = int(parts[1])
                    base_date = datetime(year, m_in, day)
                elif len(parts) == 3:
                    m_in = int(parts[0]); day = int(parts[1]); y_in = int(parts[2])
                    base_date = datetime(y_in, m_in, day)
                else:
                    continue
            except ValueError:
                continue

        try:
            start, end, hh, mm = parse_range(base_date, r_str)
        except ValueError:
            continue

        total_minutes += hh * 60 + mm
        rows.append({
            "date": base_date.strftime("%m/%d/%Y"),
            "day": day_name(base_date),
            # use %I (01-12) then strip leading 0 for cross-platform portability
            "time_label": f"{start.strftime('%I:%M %p').lstrip('0').lower()} – {end.strftime('%I:%M %p').lstrip('0').lower()}",
            "h": hh,
            "m": f"{mm:02d}",
        })

    # сортировка
    rows.sort(key=lambda r: datetime.strptime(r["date"], "%m/%d/%Y"))

    # --- NEW: subtotal и total ---
    # Суммируем по колонкам отдельно
    subtotal_h = sum(r["h"] for r in rows)
    subtotal_m = sum(int(r["m"]) for r in rows)

    # Конвертируем минуты в часы+минуты
    m_to_h, m_rem = divmod(subtotal_m, 60)

    # Итоговые Total (часов и минут)
    total_h = subtotal_h + m_to_h
    total_m = m_rem

    context = {
        "title": f"{first_name} {last_name} — Work Hours ({month_name} {year})",
        "last_name": last_name,
        "first_name": first_name,
        "month_name": month_name,
        "year": year,
        "rows": rows,

        # Subtotal (раздельные суммы)
        "subtotal_h": subtotal_h,
        "subtotal_m": subtotal_m,
        "subtotal_m_as_h": m_to_h,  # сколько часов в сумме минут
        "subtotal_m_rem": m_rem,     # остаток минут после конвертации

        # Total (после конвертации)
        "total_h": total_h,
        "total_m": f"{total_m:02d}",

        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    return render_template(
        "result.html", **context)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)