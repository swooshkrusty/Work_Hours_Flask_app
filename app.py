from __future__ import annotations
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import os
import re
import io
import fitz  # PyMuPDF
from datetime import datetime, timedelta, date
from flask import Flask, render_template, request, redirect, url_for, send_file, jsonify
from io import BytesIO

app = Flask(__name__)

TIME_RGX = re.compile(
    r"^\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*[-–—]\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*$",
    re.IGNORECASE,
)


def to_24h(hour12: int, minute: int, ampm: str) -> tuple[int, int]:
    ampm = ampm.lower()
    h = hour12 % 12
    if ampm == "pm":
        h += 12
    return h, minute


def parse_range(date_obj: datetime, rng: str, tz: ZoneInfo) -> tuple[datetime, datetime, int, int, bool]:
    m = TIME_RGX.match(rng)
    if not m:
        raise ValueError("Time range must be like '3:52 pm - 1:11 am'")
    sh, sm, sa, eh, em, ea = m.groups()
    sh, sm, eh, em = int(sh), int(sm), int(eh), int(em)
    sh24, sm = to_24h(sh, sm, sa)
    eh24, em = to_24h(eh, em, ea)

    start_local = datetime(date_obj.year, date_obj.month, date_obj.day, sh24, sm, tzinfo=tz)
    end_local   = datetime(date_obj.year, date_obj.month, date_obj.day, eh24, em, tzinfo=tz)
    if end_local <= start_local:
        end_local += timedelta(days=1)

    minutes_total = int(
        (end_local.astimezone(ZoneInfo("UTC")) - start_local.astimezone(ZoneInfo("UTC"))).total_seconds() // 60
    )
    h, m = divmod(minutes_total, 60)

    dst_adjusted = start_local.utcoffset() != end_local.utcoffset()
    return start_local, end_local, h, m, dst_adjusted


def day_name(dt: datetime) -> str:
    return dt.strftime("%A")


def _fmt_month_day(d: date) -> str:
    return f"{d.strftime('%B')} {d.strftime('%d').lstrip('0')}"


def make_period_title(dates: list[date]) -> str:
    """
    'October 25 – 31, 2025' | 'October 25 – November 3, 2025' | 'October 25, 2025 – November 3, 2026'
    """
    lo, hi = min(dates), max(dates)
    if lo.year == hi.year:
        if lo.month == hi.month:
            return f"{_fmt_month_day(lo)} – {hi.strftime('%d').lstrip('0')}, {lo.year}"
        return f"{_fmt_month_day(lo)} – {_fmt_month_day(hi)}, {lo.year}"
    return f"{_fmt_month_day(lo)}, {lo.year} – {_fmt_month_day(hi)}, {hi.year}"

def _make_context_from_draft(draft: dict) -> dict:
    """Собираем context так же, как в /build, из приходящего draft"""
    last_name  = (draft.get("last_name") or "").strip()
    first_name = (draft.get("first_name") or "").strip()
    year       = int(draft.get("year") or 0)
    tz_name    = (draft.get("tz") or "").strip() or os.environ.get("DEFAULT_TZ", "America/Chicago")
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("America/Chicago")

    rows_src = draft.get("rows") or []
    rows = []
    for row in rows_src:
        d_str = (row.get("date") or "").strip()
        s_str = (row.get("start") or "").strip()
        e_str = (row.get("end") or "").strip()
        if not (d_str and s_str and e_str):
            continue
        # формируем скрытое поле range в точности как на форме
        rng = f"{_to_ampm(s_str)} - {_to_ampm(e_str)}"
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
            continue
        base_date = datetime.strptime(d_str, "%Y-%m-%d")
        try:
            start, end, hh, mm, dst_adjusted = parse_range(base_date, rng, tz)
        except ValueError:
            continue
        rows.append({
            "date": base_date.strftime("%m/%d/%Y"),
            "day":  day_name(base_date),
            "time_label": f"{start.strftime('%I:%M %p').lstrip('0').lower()} – {end.strftime('%I:%M %p').lstrip('0').lower()}",
            "h": hh,
            "m": f"{mm:02d}",
            "dst": dst_adjusted,
        })

    rows.sort(key=lambda r: datetime.strptime(r["date"], "%m/%d/%Y"))
    dates_for_title = [datetime.strptime(r["date"], "%m/%d/%Y").date() for r in rows]
    if dates_for_title:
        period_title = make_period_title(dates_for_title)
        title_str = f"{first_name} {last_name} — Work Hours ({period_title})"
    else:
        title_str = f"{first_name} {last_name} — Work Hours ({year})"

    subtotal_h = sum(r["h"] for r in rows)
    subtotal_m = sum(int(r["m"]) for r in rows)
    m_to_h, m_rem = divmod(subtotal_m, 60)
    total_h = subtotal_h + m_to_h
    total_m = m_rem
    dst_note = any(r["dst"] for r in rows)

    return {
        "title": title_str,
        "last_name": last_name,
        "first_name": first_name,
        "year": year,
        "rows": rows,
        "subtotal_h": subtotal_h,
        "subtotal_m": subtotal_m,
        "subtotal_m_as_h": m_to_h,
        "subtotal_m_rem": m_rem,
        "total_h": total_h,
        "total_m": f"{total_m:02d}",
        "dst_note": dst_note,
        "tz_name": tz_name,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

def _to_ampm(hhmm: str) -> str:
    h, m = map(int, hhmm.split(":"))
    ap = "pm" if h >= 12 else "am"
    h12 = ((h + 11) % 12) + 1
    return f"{h12}:{str(m).zfill(2)} {ap}"

@app.route("/export-image", methods=["POST"])
def export_image():
    html = request.form.get("html")
    if not html:
        return jsonify({"error": "missing_html"}), 400

    # Вставим <base>, чтобы относительные url (CSS/картинки) работали
    base = request.url_root
    html_with_base = html.replace("<head>", f"<head><base href='{base}'>", 1)

    pdf_bytes = None
    weasy_err = None

    # 1) Пытаемся WeasyPrint
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_with_base).write_pdf()
    except Exception as e:
        weasy_err = str(e)

    # 2) Фолбэк на Playwright, если WeasyPrint не сработал
    if pdf_bytes is None:
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.set_content(html_with_base, wait_until="load")
                pdf_bytes = page.pdf(
                    format="Letter",
                    print_background=True,
                    prefer_css_page_size=True
                )
                browser.close()
        except Exception as e:
            return jsonify({
                "error": "render_failed",
                "weasyprint": weasy_err,
                "playwright": str(e)
            }), 500

    # 3) PDF -> PNG через PyMuPDF
    try:
        
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(dpi=200)  # можно 300 для еще резче
        img_bytes = pix.tobytes("png")
    except Exception as e:
        return jsonify({"error": "pdf_to_png_failed", "detail": str(e)}), 500

    return send_file(
        io.BytesIO(img_bytes),
        mimetype="image/jpg",
        as_attachment=True,
        download_name="work-hours.jpg",
    )
# ---------- export (PDF / JPG) ----------
@app.route("/export", methods=["POST"])
def export():
    html = request.form.get("html")
    fmt  = (request.form.get("format") or "pdf").lower()  # "pdf" | "jpg"

    if not html:
        return jsonify({"error": "missing_html"}), 400

    # чтобы относительные ссылки на CSS/картинки работали
    base = request.url_root
    html_with_base = html.replace("<head>", f"<head><base href='{base}'>", 1)

    pdf_bytes = None
    weasy_err = None

    # 1) Пытаемся через WeasyPrint (если установлены зависимости)
    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_with_base).write_pdf()
    except Exception as e:
        weasy_err = str(e)

    # 2) Фолбэк: Playwright, если WeasyPrint недоступен
    if pdf_bytes is None:
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page()
                page.set_content(html_with_base, wait_until="load")
                pdf_bytes = page.pdf(
                    format="Letter",
                    print_background=True,
                    prefer_css_page_size=True,
                )
                browser.close()
        except Exception as e:
            return jsonify({
                "error": "render_failed",
                "weasyprint": weasy_err,
                "playwright": str(e),
            }), 500

    # 3) Возвращаем в нужном формате
    if fmt == "jpg":
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page = doc[0]
            pix = page.get_pixmap(dpi=200)  # 300 для ещё резче
            img_bytes = pix.tobytes("jpeg")  # именно JPEG
        except Exception as e:
            return jsonify({"error": "pdf_to_jpg_failed", "detail": str(e)}), 500

        return send_file(
            io.BytesIO(img_bytes),
            mimetype="image/jpeg",
            as_attachment=True,
            download_name="work-hours.jpg",
        )

    # по умолчанию — PDF
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name="work-hours.pdf",
    )

# ---------- form ----------
@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


# ---------- builder ----------
@app.route("/build", methods=["GET", "POST"])
def build():
    if request.method == "GET":
        return redirect(url_for("index"))

    last_name  = request.form.get("last_name", "").strip()
    first_name = request.form.get("first_name", "").strip()
    year       = int(request.form.get("year", "0") or 0)

    # ❶ тайм-зона из формы + безопасный фолбэк
    tz_name = (request.form.get("tz") or "").strip() or os.environ.get("DEFAULT_TZ", "America/Chicago")
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("America/Chicago")  # последний фолбэк

    dates  = request.form.getlist("date[]")
    ranges = request.form.getlist("range[]")

    rows = []
    total_minutes = 0

    for d_str, r_str in zip(dates, ranges):
        d_str = (d_str or "").strip()
        r_str = (r_str or "").strip()
        if not d_str or not r_str:
            continue

        if not re.match(r"^\d{4}-\d{2}-\d{2}$", d_str):
            continue
        try:
            base_date = datetime.strptime(d_str, "%Y-%m-%d")
        except ValueError:
            continue

        # ❷ ТУТ передаём tz в parse_range
        try:
            start, end, hh, mm, dst_adjusted = parse_range(base_date, r_str, tz)
        except ValueError:
            continue

        total_minutes += hh * 60 + mm
        rows.append({
            "date": base_date.strftime("%m/%d/%Y"),
            "day":  day_name(base_date),
            "time_label": f"{start.strftime('%I:%M %p').lstrip('0').lower()} – {end.strftime('%I:%M %p').lstrip('0').lower()}",
            "h": hh,
            "m": f"{mm:02d}",
            "dst": dst_adjusted,
        })

    rows.sort(key=lambda r: datetime.strptime(r["date"], "%m/%d/%Y"))

    dates_for_title = [datetime.strptime(r["date"], "%m/%d/%Y").date() for r in rows]
    if dates_for_title:
        period_title = make_period_title(dates_for_title)
        title_str = f"{first_name} {last_name} — Work Hours ({period_title})"
    else:
        title_str = f"{first_name} {last_name} — Work Hours ({year})"

    subtotal_h = sum(r["h"] for r in rows)
    subtotal_m = sum(int(r["m"]) for r in rows)
    m_to_h, m_rem = divmod(subtotal_m, 60)
    total_h = subtotal_h + m_to_h
    total_m = m_rem

    dst_note = any(r["dst"] for r in rows)

    context = {
        "title": title_str,
        "last_name": last_name,
        "first_name": first_name,
        "year": year,
        "rows": rows,
        "subtotal_h": subtotal_h,
        "subtotal_m": subtotal_m,
        "subtotal_m_as_h": m_to_h,
        "subtotal_m_rem": m_rem,
        "total_h": total_h,
        "total_m": f"{total_m:02d}",
        "dst_note": dst_note,
        "tz_name": tz_name,              # ← полезно показать в отчёте
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }

    return render_template("result.html", **context)




if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)


