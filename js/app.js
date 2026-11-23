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

/* ---------- Server Storage (PHP API) ---------- */

async function fetchPortfoliosFromServer() {
    try {
        const res = await fetch("api.php", { cache: "no-store" });
        if (!res.ok) throw new Error("โหลดข้อมูลจาก Server ไม่สำเร็จ");
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        if (typeof showToast === "function") {
            showToast("เชื่อมต่อ PHP Server ไม่สำเร็จ กรุณาเปิดใช้งานผ่าน Web Server ที่รองรับ PHP (เช่น AWS EC2 หรือ localhost)", true);
        }
        return [];
    }
}

async function savePortfoliosToServer(list) {
    try {
        const res = await fetch("api.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(list)
        });
        const result = await res.json();
        if (!res.ok || result.status !== "success") {
            showToast(result.message || "บันทึกข้อมูลลง Server ไม่สำเร็จ", true);
            return false;
        }
        return true;
    } catch (e) {
        if (typeof showToast === "function") {
            showToast("เชื่อมต่อ PHP Server ไม่สำเร็จ กรุณาเปิดใช้งานผ่าน Web Server ที่รองรับ PHP (เช่น AWS EC2 หรือ localhost)", true);
        }
        return false;
    }
}

if (typeof document !== "undefined") {
    let portfolios = [];
    let selectedId = null;
    let pendingImportedItem = null;

    try { selectedId = localStorage.getItem(SELECTED_KEY); } catch (e) { selectedId = null; }

    const $ = function (sel) { return document.querySelector(sel); };

    /* สร้าง Modal แก้ไขให้อัตโนมัติ (ทำงานได้ทันทีโดยไม่ต้องแก้ index.html) */
    function ensureEditModal() {
        if ($("#editItemModal")) return;
        const modalHtml = `
        <div class="modal fade" id="editItemModal" tabindex="-1" aria-labelledby="editItemModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <form id="edit-item-form" class="needs-validation" novalidate>
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold" id="editItemModalLabel">แก้ไข Portfolio Item</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <input type="hidden" id="edit-item-id">
                            <div class="row g-3 mb-3">
                                <div class="col-md-6">
                                    <label for="edit-title" class="form-label small fw-semibold">Title *</label>
                                    <input type="text" class="form-control" id="edit-title" name="title" required>
                                    <div class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-3">
                                    <label for="edit-type" class="form-label small fw-semibold">Type *</label>
                                    <select class="form-select" id="edit-type" name="type" required>
                                        <option value="">-- เลือกประเภท --</option>
                                        <option value="Course Assignment">Course Assignment</option>
                                        <option value="Project">Project</option>
                                        <option value="Activity">Activity</option>
                                        <option value="Self-Learning">Self-Learning</option>
                                    </select>
                                    <div class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-3">
                                    <label for="edit-date" class="form-label small fw-semibold">Date *</label>
                                    <input type="date" class="form-control" id="edit-date" name="date" required>
                                    <div class="invalid-feedback"></div>
                                </div>
                            </div>
                            <div class="row g-3 mb-3">
                                <div class="col-md-6">
                                    <label for="edit-role" class="form-label small fw-semibold">Role *</label>
                                    <input type="text" class="form-control" id="edit-role" name="role" required>
                                    <div class="invalid-feedback"></div>
                                </div>
                                <div class="col-md-6">
                                    <label for="edit-skills" class="form-label small fw-semibold">Skills * (คั่นด้วยเครื่องหมายจุลภาค ,)</label>
                                    <input type="text" class="form-control" id="edit-skills" name="skills" required>
                                    <div class="invalid-feedback"></div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label for="edit-description" class="form-label small fw-semibold">Description *</label>
                                <textarea class="form-control" id="edit-description" name="description" rows="2" required></textarea>
                                <div class="invalid-feedback"></div>
                            </div>
                            <div class="p-3 bg-light rounded-3 mb-3">
                                <h6 class="small fw-bold text-secondary mb-3">Reflection</h6>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <label for="edit-whatIDid" class="form-label small text-muted">What I did *</label>
                                        <input type="text" class="form-control" id="edit-whatIDid" name="whatIDid" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="edit-whatILearned" class="form-label small text-muted">What I learned *</label>
                                        <input type="text" class="form-control" id="edit-whatILearned" name="whatILearned" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="edit-challenge" class="form-label small text-muted">Challenge *</label>
                                        <input type="text" class="form-control" id="edit-challenge" name="challenge" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="edit-nextStep" class="form-label small text-muted">Next step *</label>
                                        <input type="text" class="form-control" id="edit-nextStep" name="nextStep" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-2">
                                <label for="edit-evidence" class="form-label small fw-semibold">Evidence URL * (ลิงก์หลักฐาน)</label>
                                <textarea class="form-control" id="edit-evidence" name="evidence" rows="2" required></textarea>
                                <div class="invalid-feedback"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">ยกเลิก</button>
                            <button type="submit" class="btn btn-warning btn-sm fw-semibold">บันทึกการแก้ไข</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML("beforeend", modalHtml);
    }
    ensureEditModal();

    function showToast(message, isError) {
        const el = document.createElement("div");
        el.className = "toast-msg" + (isError ? " error" : "");
        el.textContent = message;
        $("#toast-area").appendChild(el);
        setTimeout(function () { el.remove(); }, 3500);
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

    function openEditItemModal(item) {
        ensureEditModal();
        const form = $("#edit-item-form");
        clearErrors(form);

        $("#edit-item-id").value = item.id;
        $("#edit-title").value = item.title || "";
        $("#edit-type").value = item.type || "";
        $("#edit-date").value = item.date || "";
        $("#edit-role").value = item.role || "";
        $("#edit-skills").value = Array.isArray(item.skills) ? item.skills.join(", ") : "";
        $("#edit-description").value = item.description || "";

        const ref = item.reflection || {};
        $("#edit-whatIDid").value = ref.whatIDid || "";
        $("#edit-whatILearned").value = ref.whatILearned || "";
        $("#edit-challenge").value = ref.challenge || "";
        $("#edit-nextStep").value = ref.nextStep || "";

        $("#edit-evidence").value = Array.isArray(item.evidence) ? item.evidence.join("\n") : "";

        const modalEl = $("#editItemModal");
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();
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

        const btnGroup = el("div", "d-flex flex-wrap gap-2 mt-3");

        const copyItemBtn = el("button", "btn btn-sm btn-outline-primary", "คัดลอก Item JSON");
        copyItemBtn.type = "button";
        copyItemBtn.addEventListener("click", function () {
            const jsonStr = JSON.stringify(item, null, 2);
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(jsonStr).then(function () {
                    showToast("คัดลอก Item JSON สำหรับส่งต่อแล้ว");
                });
            }
        });
        btnGroup.appendChild(copyItemBtn);

        const editBtn = el("button", "btn btn-sm btn-outline-warning", "แก้ไข");
        editBtn.type = "button";
        editBtn.addEventListener("click", function () { openEditItemModal(item); });
        btnGroup.appendChild(editBtn);

        const del = el("button", "btn btn-sm btn-outline-danger", "ลบ Item");
        del.type = "button";
        del.addEventListener("click", function () { deleteItem(item.id); });
        btnGroup.appendChild(del);

        card.appendChild(btnGroup);
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
            list.appendChild(el("p", "text-body-secondary mb-0 col-12 text-center py-3 small", "ยังไม่มี Item ใน Portfolio นี้ ลองเพิ่มจากฟอร์มด้านล่าง หรือนำเข้าจากบูธเพื่อน"));
        }
        p.items.forEach(function (it) { list.appendChild(renderItem(it)); });
        $("#json-text").value = JSON.stringify(p, null, 2);
    }

    async function deleteItem(itemId) {
        const p = currentPortfolio();
        if (!p) return;
        const backup = [...p.items];
        p.items = p.items.filter(function (it) { return it.id !== itemId; });
        if (await savePortfoliosToServer(portfolios)) {
            render();
            showToast("ลบ Item และอัปเดตบน Server แล้ว");
        } else {
            p.items = backup;
        }
    }

    /* Create New Portfolio */
    $("#portfolio-form").addEventListener("submit", async function (event) {
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
        if (await savePortfoliosToServer(portfolios)) {
            form.reset();
            selectPortfolio(p.id);
            showToast("สร้าง Portfolio และบันทึกลง Server แล้ว");
        } else {
            portfolios.pop();
        }
    });

    /* Add Item */
    $("#item-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = event.currentTarget;
        const p = currentPortfolio();
        if (!p) return;
        const values = formValues(form);
        const errors = validateItem(values);
        showErrors(form, errors);
        if (Object.keys(errors).length > 0) {
            showToast("ข้อมูลไม่ถูกต้อง ยังไม่ได้บันทึก กรุณาตรวจสอบช่องที่แจ้งเตือน", true);
            return;
        }
        const item = buildItem(values, nextItemId(p.items));
        p.items.push(item);
        if (await savePortfoliosToServer(portfolios)) {
            form.reset();
            clearErrors(form);
            render();
            showToast("บันทึก Item ลง Server แล้ว");
        } else {
            p.items.pop();
        }
    });

    /* Edit Item */
    $("#edit-item-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        const form = event.currentTarget;
        const p = currentPortfolio();
        if (!p) return;

        const itemId = $("#edit-item-id").value;
        const idx = p.items.findIndex(function (it) { return it.id === itemId; });
        if (idx === -1) {
            showToast("ไม่พบ Item ที่ต้องการแก้ไข", true);
            return;
        }

        const values = formValues(form);
        const errors = validateItem(values);
        showErrors(form, errors);
        if (Object.keys(errors).length > 0) {
            showToast("ข้อมูลไม่ถูกต้อง ยังไม่ได้บันทึก กรุณาตรวจสอบช่องที่แจ้งเตือน", true);
            return;
        }

        const backup = p.items[idx];
        p.items[idx] = buildItem(values, itemId);

        if (await savePortfoliosToServer(portfolios)) {
            const modalEl = $("#editItemModal");
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            render();
            showToast("แก้ไขและบันทึกข้อมูลลง Server แล้ว");
        } else {
            p.items[idx] = backup;
        }
    });

    $("#item-reset").addEventListener("click", function () {
        setTimeout(function () { clearErrors($("#item-form")); }, 0);
    });

    document.addEventListener("input", function (e) {
        if (e.target.classList && e.target.classList.contains("is-invalid")) {
            e.target.classList.remove("is-invalid");
        }
    });

    /* Delete Portfolio */
    let deleteArmed = false;
    $("#btn-delete-portfolio").addEventListener("click", async function (e) {
        const btn = e.currentTarget;
        if (!deleteArmed) {
            deleteArmed = true;
            btn.textContent = "กดอีกครั้งเพื่อยืนยันลบ";
            setTimeout(function () { deleteArmed = false; btn.textContent = "ลบ Portfolio"; }, 3000);
            return;
        }
        deleteArmed = false;
        btn.textContent = "ลบ Portfolio";
        const backup = [...portfolios];
        portfolios = portfolios.filter(function (p) { return p.id !== selectedId; });
        selectedId = portfolios.length ? portfolios[0].id : null;
        if (await savePortfoliosToServer(portfolios)) {
            render();
            showToast("ลบ Portfolio บน Server แล้ว");
        } else {
            portfolios = backup;
        }
    });

    /* JSON view, copy & download my-portfolio.json */
    $("#btn-export").addEventListener("click", function () {
        const box = $("#json-box");
        box.hidden = !box.hidden;
    });

    $("#btn-copy").addEventListener("click", function () {
        const ta = $("#json-text");
        ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(ta.value).then(
                function () { showToast("คัดลอก JSON แล้ว"); },
                function () { showToast("เลือกข้อความแล้ว กด Ctrl+C เพื่อคัดลอก"); }
            );
        }
    });

    $("#btn-download-my-portfolio").addEventListener("click", function () {
        const p = currentPortfolio();
        if (!p) return;
        const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-portfolio.json";
        a.click();
        URL.revokeObjectURL(url);
        showToast("ดาวน์โหลดไฟล์ my-portfolio.json สำเร็จ");
    });

    /* ---------- Import Portfolio Item JSON Modal ---------- */
    $("#btn-import").addEventListener("click", function () {
        $("#import-json-input").value = "";
        $("#import-preview-section").hidden = true;
        $("#btn-confirm-import").disabled = true;
        pendingImportedItem = null;

        const select = $("#import-target-portfolio");
        select.replaceChildren();
        portfolios.forEach(function (p) {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name + " (" + p.id + ")";
            if (p.id === selectedId) opt.selected = true;
            select.appendChild(opt);
        });
    });

    $("#btn-parse-json").addEventListener("click", function () {
        const raw = $("#import-json-input").value.trim();
        if (!raw) {
            showToast("กรุณาวางข้อความ JSON ก่อนตรวจสอบ", true);
            return;
        }

        let obj;
        try {
            obj = JSON.parse(raw);
        } catch (e) {
            showToast("JSON ผิดรูปแบบ (Syntax Error) กรุณาตรวจสอบเครื่องหมายปีกกาหรือลูกน้ำ", true);
            return;
        }

        if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
            showToast("ข้อมูลต้องเป็น JSON Object ของ Portfolio Item 1 รายการ", true);
            return;
        }
        if (!obj.id || !obj.title || !obj.type || !obj.date || !obj.role || !obj.description) {
            showToast("ข้อมูลไม่ครบ: ต้องมี id, title, type, date, role และ description", true);
            return;
        }
        if (!obj.reflection || typeof obj.reflection !== "object") {
            showToast("ข้อมูลไม่ครบ: ไม่พบส่วน reflection", true);
            return;
        }
        if (!Array.isArray(obj.evidence) || obj.evidence.length === 0 || !obj.evidence.every(isValidUrl)) {
            showToast("ข้อมูลไม่ถูกต้อง: evidence ต้องมีลิงก์ URL อย่างน้อย 1 ลิงก์", true);
            return;
        }

        pendingImportedItem = obj;
        $("#import-item-summary").textContent = "พบรายการ: " + obj.title + " (" + obj.type + " | ID: " + obj.id + ")";
        $("#imp-whatIDid").value = obj.reflection.whatIDid || "";
        $("#imp-whatILearned").value = obj.reflection.whatILearned || "";
        $("#imp-challenge").value = obj.reflection.challenge || "";
        $("#imp-nextStep").value = obj.reflection.nextStep || "";

        $("#import-preview-section").hidden = false;
        $("#btn-confirm-import").disabled = false;
    });

    $("#btn-confirm-import").addEventListener("click", async function () {
        if (!pendingImportedItem) return;
        const targetId = $("#import-target-portfolio").value;
        const targetPortfolio = portfolios.find(function (p) { return p.id === targetId; });

        if (!targetPortfolio) {
            showToast("ไม่พบ Portfolio ปลายทาง", true);
            return;
        }

        const isDuplicate = targetPortfolio.items.some(function (it) { return it.id === pendingImportedItem.id; });
        if (isDuplicate) {
            showToast("ไม่สามารถนำเข้าได้: มีรายการ ID '" + pendingImportedItem.id + "' อยู่ใน Portfolio นี้แล้ว", true);
            return;
        }

        const wDid = $("#imp-whatIDid").value.trim();
        const wLearned = $("#imp-whatILearned").value.trim();
        const chal = $("#imp-challenge").value.trim();
        const nextS = $("#imp-nextStep").value.trim();

        if (!wDid || !wLearned || !chal || !nextS) {
            showToast("กรุณากรอก Reflection ให้ครบทั้ง 4 ช่องก่อนบันทึก", true);
            return;
        }

        const itemToSave = JSON.parse(JSON.stringify(pendingImportedItem));
        itemToSave.reflection = {
            whatIDid: wDid,
            whatILearned: wLearned,
            challenge: chal,
            nextStep: nextS
        };

        targetPortfolio.items.push(itemToSave);
        if (await savePortfoliosToServer(portfolios)) {
            const modalEl = $("#importModal");
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();

            selectPortfolio(targetPortfolio.id);
            showToast("นำเข้าและบันทึก Item ลง Server สำเร็จ!");
        } else {
            targetPortfolio.items.pop();
        }
    });

    /* Sample */
    $("#btn-sample").addEventListener("click", async function () {
        const existing = new Set(portfolios.map(function (p) { return p.id; }));
        let added = false;
        if (window.SAMPLE_PORTFOLIOS) {
            window.SAMPLE_PORTFOLIOS.forEach(function (s) {
                if (!existing.has(s.id)) {
                    portfolios.push(JSON.parse(JSON.stringify(s)));
                    added = true;
                }
            });
        }
        if (!added) {
            showToast("ข้อมูลตัวอย่างถูกโหลดไว้แล้ว");
            return;
        }
        if (await savePortfoliosToServer(portfolios)) {
            if (window.SAMPLE_PORTFOLIOS && window.SAMPLE_PORTFOLIOS.length > 0) {
                selectPortfolio(window.SAMPLE_PORTFOLIOS[0].id);
            } else {
                render();
            }
            showToast("โหลดข้อมูลตัวอย่างและบันทึกลง Server แล้ว");
        }
    });

    /* Clear data */
    let clearArmed = false;
    $("#btn-clear").addEventListener("click", async function (e) {
        const btn = e.currentTarget;
        if (!clearArmed) {
            clearArmed = true;
            btn.textContent = "กดอีกครั้งเพื่อยืนยัน";
            setTimeout(function () { clearArmed = false; btn.textContent = "ล้างข้อมูลทั้งหมด"; }, 3000);
            return;
        }
        clearArmed = false;
        btn.textContent = "ล้างข้อมูลทั้งหมด";
        const backup = [...portfolios];
        portfolios = [];
        selectedId = null;
        if (await savePortfoliosToServer(portfolios)) {
            render();
            showToast("ล้างข้อมูลบน Server แล้ว");
        } else {
            portfolios = backup;
        }
    });

    // เริ่มต้นโหลดข้อมูลจาก Server ทันทีที่เปิดหน้าเว็บ
    (async function init() {
        portfolios = await fetchPortfoliosFromServer();
        render();
    })();
}