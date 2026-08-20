/* =========================================================
   22d-goals-modal.js
   Hedefler — OLUŞTURMA / DÜZENLEME MODALI: tek bir modal,
   üç mod: "create" (tam sihirbaz), "editMinimal" (yalnızca
   başlık/ikon), "reconnect" (yalnızca görev seçimi, kopan
   bağlantıyı onarmak için).

   Bu dosya 22-goals.js'ten CUT → MOVE edilmiştir; mantık
   DEĞİŞMEMİŞTİR.
   ========================================================= */

/* =========================================================
   HEDEF — GEÇİCİ (OTURUM İÇİ) DURUM

   Bunlar kalıcı veri DEĞİLDİR — yalnızca modal akışı için
   kullanılır.
   ========================================================= */

let editingGoalId = null;
let goalFormMode = "create";
/* "create" | "editMinimal" | "reconnect" */

let selectedGoalSource = "linked";
let selectedGoalPeriod = "weekly";

function renderGoalTaskSelect() {

    const select = $("#goal-task-select");

    if (!select) {
        return;
    }

    if (tasks.length === 0) {

        select.innerHTML =
            `<option value="">Önce bir görev oluştur</option>`;

    } else {

        select.innerHTML =
            tasks.map(
                task => `
                    <option value="${escapeHtml(task.id)}">
                        ${escapeHtml(task.title)}
                    </option>
                `
            ).join("");

    }

    updateGoalTaskPreview();

}

function updateGoalTaskPreview() {

    const preview = $("#goal-task-preview");
    const select = $("#goal-task-select");

    if (!preview || !select) {
        return;
    }

    /*
     * Kullanıcı seçimi değiştirdiğinde (ya da modal her
     * açıldığında, renderGoalTaskSelect() bu fonksiyonu
     * zaten çağırdığı için) önceki validasyon hatası varsa
     * temizlenir — bkz. showGoalTaskValidationError().
     */
    select.classList.remove("is-invalid");
    preview.classList.remove("is-error");

    const task =
        tasks.find(item => item.id === select.value);

    if (!task) {

        preview.textContent = "";
        return;

    }

    let bounds;

    if (selectedGoalPeriod === "weekly") {

        bounds = getWeekBounds(effectiveDate());

    } else if (selectedGoalPeriod === "monthly") {

        bounds = getMonthBounds(effectiveDate());

    } else {

        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        if (startInput) {
            startInput.setCustomValidity("");
        }

        if (endInput) {
            endInput.setCustomValidity("");
        }

        if (
            !startInput || !startInput.value ||
            !endInput || !endInput.value
        ) {

            preview.textContent = "";
            return;

        }

        bounds = {
            start: startInput.value,
            end: endInput.value
        };

    }

    const count =
        task.completedDates.filter(
            date =>
                date >= bounds.start &&
                date <= bounds.end
        ).length;

    preview.textContent =
        `Bu dönemde şu ana kadar: ${count} gün`;

}

/*
 * HEDEF — GÖREV SEÇİMİ VALİDASYONU
 * Yeni bir hata/validasyon bileşeni İCAT EDİLMEDİ — mevcut
 * #goal-task-preview (.field-hint) elemanı geçici olarak
 * hata mesajını taşır (.is-error class'ı yalnızca rengini
 * değiştirir, bkz. goals.css), select kutusu .is-invalid
 * ile vurgulanır ve odak/scroll ile kullanıcının dikkatine
 * sunulur.
 */
function showGoalTaskValidationError(message) {

    const select = $("#goal-task-select");
    const preview = $("#goal-task-preview");

    if (preview) {

        preview.textContent = message;
        preview.classList.add("is-error");

    }

    if (select) {

        select.classList.add("is-invalid");

        select.focus();

        select.scrollIntoView({
            block: "center",
            behavior: "smooth"
        });

    }

}

function updateGoalSourceUI() {

    $$("#goal-source-picker .category-chip").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.source === selectedGoalSource
        );

    });

    const taskWrap = $("#goal-task-picker-wrap");

    if (taskWrap) {
        taskWrap.hidden = selectedGoalSource !== "linked";
    }

    updateGoalTaskPreview();

}

function updateGoalPeriodUI() {

    $$("#goal-period-picker .category-chip").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.period === selectedGoalPeriod
        );

    });

    const customDates = $("#goal-custom-dates");

    if (customDates) {
        customDates.hidden = selectedGoalPeriod !== "custom";
    }

    updateGoalTaskPreview();

}

function openGoalModal(mode = "create", goal = null) {

    goalFormMode = mode;
    editingGoalId = goal ? goal.id : null;

    const titleEl = $("#goal-modal-title");
    const titleInput = $("#goal-title");
    const iconInput = $("#goal-icon-input");

    const sourceSection = $("#goal-source-section");
    const targetSection = $("#goal-target-section");
    const periodSection = $("#goal-period-section");
    const sourcePicker = $("#goal-source-picker");
    const taskWrap = $("#goal-task-picker-wrap");

    if (mode === "create") {

        if (titleEl) titleEl.textContent = "Yeni hedef";
        if (titleInput) titleInput.value = "";
        if (iconInput) iconInput.value = "";

        selectedGoalSource = "linked";
        selectedGoalPeriod = "weekly";

        if (sourceSection) sourceSection.hidden = false;
        if (targetSection) targetSection.hidden = false;
        if (periodSection) periodSection.hidden = false;
        if (sourcePicker) sourcePicker.hidden = false;

        const amountInput = $("#goal-target-amount");
        const unitInput = $("#goal-target-unit");
        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        if (amountInput) amountInput.value = "1";
        if (unitInput) unitInput.value = "";
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";

        renderGoalTaskSelect();
        updateGoalSourceUI();
        updateGoalPeriodUI();

    } else if (mode === "editMinimal") {

        if (titleEl) titleEl.textContent = "Hedefi düzenle";
        if (titleInput) titleInput.value = goal.title;
        if (iconInput) iconInput.value = goal.icon || "";

        if (sourceSection) sourceSection.hidden = true;
        if (targetSection) targetSection.hidden = true;
        if (periodSection) periodSection.hidden = true;

    } else if (mode === "reconnect") {

        if (titleEl) titleEl.textContent = "Hedefi yeniden bağla";
        if (titleInput) titleInput.value = goal.title;
        if (iconInput) iconInput.value = goal.icon || "";

        if (sourceSection) sourceSection.hidden = false;
        if (targetSection) targetSection.hidden = true;
        if (periodSection) periodSection.hidden = true;
        if (sourcePicker) sourcePicker.hidden = true;
        if (taskWrap) taskWrap.hidden = false;

        selectedGoalSource = "linked";

        renderGoalTaskSelect();

    }

    openModal($("#goal-modal"));

    if (titleInput && mode !== "reconnect") {

        setTimeout(() => {
            titleInput.focus();
        }, 30);

    }

}

function closeGoalModal() {

    closeModal($("#goal-modal"));

    const form = $("#goal-form");

    if (form) {
        form.reset();
    }

    editingGoalId = null;
    goalFormMode = "create";
    selectedGoalSource = "linked";
    selectedGoalPeriod = "weekly";

    const sourcePicker = $("#goal-source-picker");

    if (sourcePicker) {
        sourcePicker.hidden = false;
    }

}

function handleGoalSubmit(event) {

    event.preventDefault();

    const titleInput = $("#goal-title");
    const iconInput = $("#goal-icon-input");

    const title =
        titleInput ? titleInput.value.trim() : "";

    const icon =
        iconInput ? iconInput.value.trim().slice(0, 4) : "";

    if (!title) {
        return;
    }

    if (goalFormMode === "editMinimal") {

        const goal =
            goals.find(item => item.id === editingGoalId);

        if (goal) {

            goal.title = title;
            goal.icon = icon || goal.icon;

            saveGoals();

        }

        closeGoalModal();
        renderGoalsPage();

        return;

    }

    if (goalFormMode === "reconnect") {

        const select = $("#goal-task-select");
        const goal = goals.find(item => item.id === editingGoalId);

        if (tasks.length === 0) {

            showGoalTaskValidationError(
                "Önce yeni bir görev oluştur."
            );

            return;

        }

        if (!select || !select.value) {

            showGoalTaskValidationError(
                "Önce bir görev seç."
            );

            return;

        }

        if (goal) {

            goal.source.taskId = select.value;
            goal.linkBroken = false;

            saveGoals();

        }

        closeGoalModal();
        renderGoalsPage();

        return;

    }

    /* create modu */

    const amountInput = $("#goal-target-amount");
    const unitInput = $("#goal-target-unit");

    const target =
        amountInput
            ? Math.max(1, parseInt(amountInput.value, 10) || 1)
            : 1;

    const unit =
        unitInput ? unitInput.value.trim().slice(0, 20) : "";

    if (!unit) {
        return;
    }

    const periodType = selectedGoalPeriod;

    let startDate = null;
    let endDate = null;

    if (periodType === "custom") {

        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        startDate = startInput ? startInput.value : "";
        endDate = endInput ? endInput.value : "";

        if (!startDate || !endDate || startDate > endDate) {

            const invalidInput =
                !startDate
                    ? startInput
                    : endInput;

            if (invalidInput) {

                invalidInput.setCustomValidity(
                    startDate > endDate
                        ? "Bitiş tarihi başlangıç tarihinden önce olamaz."
                        : "Tarih aralığının iki tarihini de seç."
                );

                invalidInput.reportValidity();
                invalidInput.focus();

            }

            return;
        }

    }

    let source = {
        mode: "manual",
        taskId: null
    };

    if (selectedGoalSource === "linked") {

        const select = $("#goal-task-select");

        if (tasks.length === 0) {

            showGoalTaskValidationError(
                "Önce yeni bir görev oluştur."
            );

            return;

        }

        if (!select || !select.value) {

            showGoalTaskValidationError(
                "Önce bir görev seç."
            );

            return;

        }

        source = {
            mode: "linked",
            taskId: select.value
        };

    }

    const goal = normalizeGoal({
        id: createId(),
        title,
        icon: icon || "🎯",
        unit,
        target,
        periodType,
        startDate,
        endDate,
        source,
        linkBroken: false,
        manualLog: [],
        createdAt: new Date().toISOString(),
        archived: false
    });

    goals.push(goal);

    saveGoals();

    closeGoalModal();
    renderGoalsPage();

}
