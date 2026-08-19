/* =========================================================
   11-settings.js
   Ayarlar modalı + genel modal aç/kapat yardımcıları.
   ========================================================= */

/* =========================================================
   AYARLAR MODALI
   ========================================================= */

function openSettingsModal() {

    const hourSelect =
        $("#day-reset-hour");

    const soundCheckbox =
        $("#sound-enabled");

    const themeSelect =
        $("#theme-select");

    const paletteSelect =
        $("#palette-select");

    if (hourSelect) {

        hourSelect.value =
            String(
                settings.dayResetHour
            );

    }

    if (soundCheckbox) {

        soundCheckbox.checked =
            settings.soundEnabled;

    }

    if (themeSelect) {

        themeSelect.value =
            settings.theme;

    }

    if (paletteSelect) {

        paletteSelect.value =
            settings.palette;

    }

    editingCategoryId = null;

    renderCategoryManageList();

    openModal(
        $("#settings-modal")
    );

}

function closeSettingsModal() {

    editingCategoryId = null;

    closeModal(
        $("#settings-modal")
    );

}

function handleSettingsSubmit(
    event
) {

    event.preventDefault();

    const hourSelect =
        $("#day-reset-hour");

    const soundCheckbox =
        $("#sound-enabled");

    const themeSelect =
        $("#theme-select");

    const paletteSelect =
        $("#palette-select");

    if (hourSelect) {

        settings.dayResetHour =
            Number(
                hourSelect.value
            ) || 0;

    }

    if (soundCheckbox) {

        settings.soundEnabled =
            soundCheckbox.checked;

    }

    if (
        themeSelect &&
        (
            themeSelect.value === "dark" ||
            themeSelect.value === "light"
        )
    ) {

        settings.theme =
            themeSelect.value;

    }

    if (
        paletteSelect &&
        PALETTES.includes(
            paletteSelect.value
        )
    ) {

        settings.palette =
            paletteSelect.value;

    }

    saveData();

    applyTheme();

    closeSettingsModal();

    renderAll();

}

/* =========================================================
   MODAL AÇ / KAPAT
   ========================================================= */

function openModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.add("open");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

}

function closeModal(modal) {

    if (!modal) {
        return;
    }

    modal.classList.remove("open");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}

/* =========================================================
   ONAY MODALI (silme/arşivleme gibi destructive action'lar)

   Native window.confirm() yerine kullanılan, tek amaçlı,
   genel bir onay modalı. Yeni bir component sistemi veya
   state-management katmanı İCAT EDİLMEDİ — mevcut
   openModal()/closeModal() aynen kullanılıyor; yalnızca
   "onaylanınca ne çalışacak" bilgisini tutan tek bir
   geçici (oturum içi) değişken var.

   Kullanım (bkz. 09-categories.js / 10-task-actions.js /
   22-goals.js / 23-quick-notes.js):

       openConfirmModal({
           title: "Görevi sil",
           message: `"${task.title}" görevini silmek istediğine emin misin?`,
           confirmLabel: "Sil",
           onConfirm: () => { ... asıl silme işlemi ... }
       });
   ========================================================= */

let confirmModalCallback = null;

function openConfirmModal({
    title,
    message,
    confirmLabel = "Sil",
    danger = true,
    onConfirm
} = {}) {

    const titleEl = $("#confirm-modal-title");
    const messageEl = $("#confirm-modal-message");
    const confirmBtn = $("#confirm-modal-confirm");

    if (titleEl) {
        titleEl.textContent = title || "Emin misin?";
    }

    if (messageEl) {
        messageEl.textContent = message || "";
    }

    if (confirmBtn) {

        confirmBtn.textContent = confirmLabel;

        confirmBtn.classList.toggle(
            "confirm-modal-danger",
            danger
        );

    }

    confirmModalCallback =
        typeof onConfirm === "function"
            ? onConfirm
            : null;

    openModal(
        $("#confirm-modal")
    );

}

function closeConfirmModal() {

    closeModal(
        $("#confirm-modal")
    );

    confirmModalCallback = null;

}

function setupConfirmModal() {

    on(
        "#close-confirm-modal",
        "click",
        closeConfirmModal
    );

    on(
        "#confirm-modal-cancel",
        "click",
        closeConfirmModal
    );

    on(
        "#confirm-modal-confirm",
        "click",
        () => {

            const callback = confirmModalCallback;

            closeConfirmModal();

            if (callback) {
                callback();
            }

        }
    );

    document.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("#confirm-modal")
            ) {

                closeConfirmModal();

            }

        }
    );

}

