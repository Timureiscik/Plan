/* =========================================================
   10-task-actions.js
   Görev tamamlama, tamamlama sesi, tamamlandı glow, görev modalı, görev sil, görev sırası.
   ========================================================= */

/* =========================================================
   GÖREV TAMAMLAMA
   ========================================================= */

function toggleCompleteToday(taskId) {

    const task =
        tasks.find(
            item =>
                item.id === taskId
        );

    if (!task) {
        return;
    }

    const key =
        effectiveDateKey();

    const index =
        task.completedDates.indexOf(key);

    let justCompleted = false;

    if (index >= 0) {

        task.completedDates.splice(
            index,
            1
        );

    } else {

        task.completedDates.push(
            key
        );

        justCompleted = true;

    }

    saveData();

    renderAll();

    if (justCompleted) {

        playCompleteSound();

        triggerGlow(taskId);

    }

}

/* =========================================================
   TAMAMLAMA SESİ
   ========================================================= */

function playCompleteSound() {

    if (!settings.soundEnabled) {
        return;
    }

    try {

        audioCtx =
            audioCtx ||
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

        const ctx =
            audioCtx;

        const now =
            ctx.currentTime;

        const osc =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        osc.type = "sine";

        osc.frequency.setValueAtTime(
            660,
            now
        );

        osc.frequency.exponentialRampToValueAtTime(
            990,
            now + 0.09
        );

        gain.gain.setValueAtTime(
            0.0001,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.18,
            now + 0.012
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.28
        );

        osc
            .connect(gain)
            .connect(ctx.destination);

        osc.start(now);

        osc.stop(
            now + 0.3
        );

    } catch (error) {

        console.warn(
            "Ses çalınamadı:",
            error
        );

    }

}

/* =========================================================
   TAMAMLANDI GLOW
   ========================================================= */

function triggerGlow(taskId) {

    $$(
        "[data-task-id]"
    ).forEach(element => {

        if (
            element.dataset.taskId !==
            String(taskId)
        ) {
            return;
        }

        if (
            !element.classList.contains(
                "task-row"
            ) &&
            !element.classList.contains(
                "task-card"
            )
        ) {
            return;
        }

        element.classList.remove(
            "just-completed"
        );

        void element.offsetWidth;

        element.classList.add(
            "just-completed"
        );

        setTimeout(
            () => {

                element.classList.remove(
                    "just-completed"
                );

            },
            750
        );

    });

}

/* =========================================================
   GÖREV MODALI
   ========================================================= */

function openTaskModal(
    task = null
) {

    editingTaskId =
        task
            ? task.id
            : null;

    selectedCategory =
        task
            ? task.category
            : DEFAULT_CATEGORY;

    const modalTitle =
        $("#task-modal-title");

    const titleInput =
        $("#task-title");

    const descInput =
        $("#task-description");

    if (modalTitle) {

        modalTitle.textContent =
            task
                ? "Görevi düzenle"
                : "Yeni görev";

    }

    if (titleInput) {

        titleInput.value =
            task
                ? task.title
                : "";

    }

    if (descInput) {

        descInput.value =
            task
                ? task.description
                : "";

    }

    renderCategoryPicker();

    openModal(
        $("#task-modal")
    );

    if (titleInput) {

        setTimeout(
            () => {
                titleInput.focus();
            },
            30
        );

    }

}

function closeTaskModal() {

    closeModal(
        $("#task-modal")
    );

    const form =
        $("#task-form");

    if (form) {
        form.reset();
    }

    editingTaskId = null;

    selectedCategory =
        DEFAULT_CATEGORY;

}

function handleTaskSubmit(
    event
) {

    event.preventDefault();

    const titleInput =
        $("#task-title");

    const descInput =
        $("#task-description");

    const title =
        titleInput
            ? titleInput.value.trim()
            : "";

    const description =
        descInput
            ? descInput.value.trim()
            : "";

    if (!title) {
        return;
    }

    if (editingTaskId) {

        const task =
            tasks.find(
                item =>
                    item.id ===
                    editingTaskId
            );

        if (task) {

            task.title =
                title;

            task.description =
                description;

            task.category =
                selectedCategory;

        }

    } else {

        tasks.push(
            normalizeTask({
                id: createId(),
                title,
                description,
                category:
                    selectedCategory,
                completedDates: [],
                createdAt:
                    new Date().toISOString()
            })
        );

    }

    saveData();

    closeTaskModal();

    renderAll();

}

/* =========================================================
   GÖREV SİL
   ========================================================= */

function deleteTask(taskId) {

    const task =
        tasks.find(
            item =>
                item.id === taskId
        );

    if (!task) {
        return;
    }

    openConfirmModal({
        title: "Görevi sil",
        message:
            `"${task.title}" görevini silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => {

            tasks =
                tasks.filter(
                    item =>
                        item.id !== taskId
                );

            saveData();

            /*
             * Bu göreve bağlı (linked) hedefler varsa, hedef
             * sessizce manuel moda GEÇİRİLMEZ — yalnızca
             * linkBroken=true işaretlenir ve kullanıcıya
             * "Bağlantı koptu" uyarısıyla gösterilir (bkz.
             * 22-goals.js — ONAYLANMIŞ MİMARİ madde 8).
             */
            markGoalsForDeletedTask(taskId);

            renderAll();

        }
    });

}

/* =========================================================
   GÖREV SIRASI
   ========================================================= */

function moveTask(
    taskId,
    direction
) {

    const index =
        tasks.findIndex(
            task =>
                task.id === taskId
        );

    if (index === -1) {
        return;
    }

    const targetIndex =
        index + direction;

    if (
        targetIndex < 0 ||
        targetIndex >= tasks.length
    ) {
        return;
    }

    const [task] =
        tasks.splice(
            index,
            1
        );

    tasks.splice(
        targetIndex,
        0,
        task
    );

    saveData();

    renderAll();

}

