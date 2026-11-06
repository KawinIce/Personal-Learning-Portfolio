const STORAGE_KEY = "powerup.portfolios";
const SELECTED_KEY = "powerup.selectedPortfolio";

/* ---------- Validation Function ---------- */

function isValidUrl(text) {
    try {
        const u = new URL(text);
        return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
    } catch (e) {
        return false;
    }
}

function isValidDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    const [y, m, d] = text.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function splitList(text, separator) {
    return text.split(separator).map(function (s) { return s.trim(); }).filter(Boolean);
}

function validatePortfolio(values) {
    const errors = {};
    if (!values.name.trim()) errors.name = "กรุณากรอกชื่อที่ต้องการแสดง";
    if (!values.enjoy.trim()) errors.enjoy = "กรุณากรอกสิ่งที่ชอบทำ";
    if (!values.tried.trim()) errors.tried = "กรุณากรอกสิ่งที่เคยลองทำ";
    if (!values.curious.trim()) errors.curious = "กรุณากรอกสิ่งที่สนใจหรืออยากรู้เพิ่ม";
    return errors;
}

function validateItem(values) {
    const errors = {};
    if (!values.title.trim()) errors.title = "กรุณากรอกชื่อผลงาน";
    if (!values.type) errors.type = "กรุณาเลือกประเภท";
    if (!values.date) errors.date = "กรุณาเลือกวันที่";
    else if (!isValidDate(values.date)) errors.date = "วันที่ไม่ถูกต้อง ใช้รูปแบบ YYYY-MM-DD เช่น 2026-10-18";
    if (!values.role.trim()) errors.role = "กรุณากรอกบทบาทของคุณ";
    if (!values.description.trim()) errors.description = "กรุณากรอกรายละเอียด";
    if (splitList(values.skills, ",").length === 0) errors.skills = "กรุณากรอกทักษะอย่างน้อย 1 อย่าง";
    if (!values.whatIDid.trim()) errors.whatIDid = "กรุณากรอก What I did";
    if (!values.whatILearned.trim()) errors.whatILearned = "กรุณากรอก What I learned";
    if (!values.challenge.trim()) errors.challenge = "กรุณากรอก Challenge";
    if (!values.nextStep.trim()) errors.nextStep = "กรุณากรอก Next step";

    const links = splitList(values.evidence, "\n");
    if (links.length === 0) {
        errors.evidence = "กรุณาใส่ลิงก์หลักฐานอย่างน้อย 1 ลิงก์";
    } else {
        const bad = links.filter(function (l) { return !isValidUrl(l); });
        if (bad.length > 0) {
            errors.evidence = "ลิงก์ไม่ถูกต้อง: " + bad[0] + " (ต้องขึ้นต้นด้วย http:// หรือ https://)";
        }
    }
    return errors;
}

function buildItem(values, id) {
    return {
        id: id,
        title: values.title.trim(),
        type: values.type,
        date: values.date,
        role: values.role.trim(),
        description: values.description.trim(),
        skills: splitList(values.skills, ","),
        reflection: {
            whatIDid: values.whatIDid.trim(),
            whatILearned: values.whatILearned.trim(),
            challenge: values.challenge.trim(),
            nextStep: values.nextStep.trim()
        },
        evidence: splitList(values.evidence, "\n")
    };
}

function nextItemId(items) {
    let max = 0;
    items.forEach(function (it) {
        const m = /^item(\d+)$/.exec(it.id);
        if (m) max = Math.max(max, Number(m[1]));
    });
    return "item" + String(max + 1).padStart(3, "0");
}

if (typeof module !== "undefined") {
    module.exports = { isValidUrl, isValidDate, validatePortfolio, validateItem, buildItem, nextItemId };
}

/* ---------- Storage ---------- */

function loadPortfolios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function savePortfolios(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    showToast("บันทึกไม่สำเร็จ: Browser ไม่อนุญาตให้ใช้ localStorage", true);
    return false;
  }
}