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

/* ---------- Browser App ---------- */

if (typeof document !== "undefined") {
    let portfolios = loadPortfolios();
    let selectedId = null;
    try { selectedId = localStorage.getItem(SELECTED_KEY); } catch (e) { selectedId = null; }

    const $ = function (sel) { return document.querySelector(sel); };

    function showToast(message, isError) {
        const el = document.createElement("div");
        el.className = "toast-msg" + (isError ? " error" : "");
        el.textContent = message;
        $("#toast-area").appendChild(el);
        setTimeout(function () { el.remove(); }, 3000);
    }
    window.showToast = showToast;

    function formValues(form) {
        const data = new FormData(form);
        const out = {};
        data.forEach(function (v, k) { out[k] = String(v); });
        return out;
    }

    function showErrors(form, errors) {
        form.querySelectorAll(".form-control, .form-select").forEach(function (el) {
            const msg = errors[el.name];
            el.classList.toggle("is-invalid", Boolean(msg));
            const fb = el.parentElement.querySelector(".invalid-feedback");
            if (fb) fb.textContent = msg || "";
        });
        const first = form.querySelector(".is-invalid");
        if (first) first.focus();
    }

    function clearErrors(form) { showErrors(form, {}); }

    function currentPortfolio() {
        return portfolios.find(function (p) { return p.id === selectedId; }) || null;
    }

    function selectPortfolio(id) {
        selectedId = id;
        try { localStorage.setItem(SELECTED_KEY, id || ""); } catch (e) { /* ignore */ }
        render();
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function renderList() {
        const box = $("#portfolio-list");
        box.replaceChildren();
        $("#portfolio-count").textContent = portfolios.length;
        portfolios.forEach(function (p) {
            const btn = el("button", "list-group-item list-group-item-action portfolio-item" + (p.id === selectedId ? " active" : ""));
            btn.type = "button";
            btn.appendChild(el("div", "fw-semibold", p.name));
            btn.appendChild(el("small", "", p.items.length + " items"));
            btn.addEventListener("click", function () { selectPortfolio(p.id); });
            box.appendChild(btn);
        });
    }

    function renderItem(item) {
        const col = el("div", "col-md-6");
        const card = el("article", "item-card");

        card.appendChild(el("h3", "h6 fw-bold mb-1", item.title));
        card.appendChild(el("div", "text-muted small mb-2", item.type + " · " + item.date + " · " + item.role));
        card.appendChild(el("p", "small text-secondary mb-2", item.description));

        const skills = el("div", "mb-2");
        if (Array.isArray(item.skills)) {
            item.skills.forEach(function (s) { skills.appendChild(el("span", "skill-chip", s)); });
        }
        card.appendChild(skills);

        const dl = el("dl", "reflection mb-2");
        const ref = item.reflection || {};
        [
            ["What I did", ref.whatIDid],
            ["What I learned", ref.whatILearned],
            ["Challenge", ref.challenge],
            ["Next step", ref.nextStep]
        ].forEach(function (pair) {
            if (pair[1]) {
                dl.appendChild(el("dt", "", pair[0]));
                dl.appendChild(el("dd", "", pair[1]));
            }
        });
        card.appendChild(dl);

        const ul = el("ul", "evidence-list");
        if (Array.isArray(item.evidence)) {
            item.evidence.forEach(function (url) {
                const li = el("li");
                const a = el("a", "", url);
                a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
                li.appendChild(a);
                ul.appendChild(li);
            });
        }
        card.appendChild(el("div", "text-muted small fw-semibold mt-2", "Evidence"));
        card.appendChild(ul);

        const del = el("button", "btn btn-sm btn-outline-danger mt-3", "ลบ Item");
        del.type = "button";
        del.addEventListener("click", function () { deleteItem(item.id); });
        card.appendChild(del);

        col.appendChild(card);
        return col;
    }

    function render() {
        if (!currentPortfolio() && portfolios.length > 0) {
            selectedId = portfolios[0].id;
        }
        renderList();
        const p = currentPortfolio();
        $("#empty-state").hidden = Boolean(p);
        $("#portfolio-view").style.display = p ? "block" : "none";
        if (!p) return;

        $("#v-name").textContent = p.name;
        $("#v-enjoy").textContent = p.enjoy;
        $("#v-tried").textContent = p.tried;
        $("#v-curious").textContent = p.curious;
        $("#item-count").textContent = p.items.length;

        const list = $("#item-list");
        list.replaceChildren();
        if (p.items.length === 0) {
            list.appendChild(el("p", "text-body-secondary mb-0 col-12 text-center py-3 small", "ยังไม่มี Item ใน Portfolio นี้ ลองเพิ่มจากฟอร์มด้านล่าง"));
        }
        p.items.forEach(function (it) { list.appendChild(renderItem(it)); });
        $("#json-text").value = JSON.stringify(p, null, 2);
    }

    function deleteItem(itemId) {
        const p = currentPortfolio();
        if (!p) return;
        p.items = p.items.filter(function (it) { return it.id !== itemId; });
        if (savePortfolios(portfolios)) { render(); showToast("ลบ Item แล้ว"); }
    }

    /* Create New Portfolio */
    $("#portfolio-form").addEventListener("submit", function (event) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = formValues(form);
        const errors = validatePortfolio(values);
        showErrors(form, errors);
        if (Object.keys(errors).length > 0) {
            showToast("กรอกข้อมูลไม่ครบ ยังไม่ได้บันทึก", true);
            return;
        }
        const p = {
            id: "p-" + Date.now().toString(36),
            name: values.name.trim(),
            enjoy: values.enjoy.trim(),
            tried: values.tried.trim(),
            curious: values.curious.trim(),
            items: []
        };
        portfolios.push(p);
        if (savePortfolios(portfolios)) {
            form.reset();
            selectPortfolio(p.id);
            showToast("สร้าง Portfolio แล้ว");
        } else {
            portfolios.pop();
        }
    });

    render();
}