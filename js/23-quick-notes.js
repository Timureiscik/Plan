/* =========================================================
   23-quick-notes.js
   Hızlı Not widget'ı: "Aklıma geldi → yazdım → kaydettim."
   Görev/alışkanlık/hedef sistemleriyle bağlantısız, kasıtlı
   olarak basit bir not listesi. dailyData.entries[key].notes
   (gün paneli notları) İLE KARIŞTIRILMAMALI — o, seçili
   takvim gününe bağlı ayrı bir sistemdir (bkz. 04-day-panel.js).
   ========================================================= */

/* =========================================================
   HIZLI NOT — VERİ YÜKLEME / KAYDETME
   ========================================================= */

function normalizeQuickNote(note) {

    if (!note || typeof note !== "object") {
        return null;
    }

    const id =
        typeof note.id === "string" && note.id.trim()
            ? note.id
            : createId();

    const text =
        typeof note.text === "string"
            ? note.text.trim().slice(0, 500)
            : "";

    if (!text) {
        return null;
    }

    const date =
        typeof note.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(note.date)
            ? note.date
            : effectiveDateKey();

    const createdAt =
        note.createdAt ||
        new Date().toISOString();

    return { id, text, date, createdAt };

}

function loadQuickNotes() {

    try {

        const saved =
            localStorage.getItem(NOTES_KEY);

        if (!saved) {
            quickNotes = [];
            return;
        }

        const parsed =
            JSON.parse(saved);

        quickNotes =
            Array.isArray(parsed)
                ? parsed.map(normalizeQuickNote).filter(Boolean)
                : [];

    } catch (error) {

        console.error(
            "Notlar yüklenemedi:",
            error
        );

        quickNotes = [];

    }

}

function saveQuickNotes() {

    try {

        localStorage.setItem(
            NOTES_KEY,
            JSON.stringify(quickNotes)
        );

        return true;

    } catch (error) {

        console.error(
            "Notlar kaydedilemedi:",
            error
        );

        return false;

    }

}

/* =========================================================
   HIZLI NOT — EKLE / SİL
   ========================================================= */

function addQuickNote(rawText) {

    const note =
        normalizeQuickNote({
            id: createId(),
            text: rawText,
            date: effectiveDateKey(),
            createdAt: new Date().toISOString()
        });

    if (!note) {
        return null;
    }

    quickNotes.unshift(note);

    saveQuickNotes();

    return note;

}

function deleteQuickNoteWithConfirm(id) {

    const note =
        quickNotes.find(
            item => item.id === id
        );

    if (!note) {
        return;
    }

    openConfirmModal({
        title: "Notu sil",
        message: "Bu notu silmek istediğine emin misin?",
        confirmLabel: "Sil",
        onConfirm: () => {

            quickNotes =
                quickNotes.filter(
                    item => item.id !== id
                );

            saveQuickNotes();

            renderQuickNotes();

        }
    });

}

function getSortedQuickNotes() {

    return [...quickNotes].sort(
        (a, b) =>
            b.createdAt.localeCompare(a.createdAt)
    );

}

/* =========================================================
   HIZLI NOT — RENDER (ANA SAYFA WIDGET + NOTLAR SAYFASI)
   ========================================================= */

function renderQuickNotes() {

    renderQuickNoteWidget();
    renderQuickNotesPage();

}

function renderQuickNoteWidget() {

    const list =
        $("#quick-note-widget-list");

    if (!list) {
        return;
    }

    const sorted =
        getSortedQuickNotes();

    const recent =
        sorted.slice(0, 3);

    list.innerHTML = "";

    if (recent.length === 0) {

        list.innerHTML =
            `<div class="day-panel-empty">Henüz not yok.</div>`;

    } else {

        recent.forEach(note => {

            const row =
                document.createElement("div");

            row.className =
                "day-panel-item";

            row.innerHTML = `
                <span class="day-panel-item-text quick-note-text">
                    ${escapeHtml(note.text)}
                </span>
                <button
                    type="button"
                    class="day-panel-item-delete"
                    data-action="delete-quick-note"
                    data-note-id="${escapeHtml(note.id)}"
                    title="Sil"
                    aria-label="Sil"
                >×</button>
            `;

            list.appendChild(row);

        });

    }

    const seeAllButton =
        $("#quick-note-see-all");

    if (seeAllButton) {

        seeAllButton.hidden =
            quickNotes.length === 0;

    }

}

function renderQuickNotesPage() {

    const container =
        $("#notes-page-list");

    if (!container) {
        return;
    }

    const sorted =
        getSortedQuickNotes();

    container.innerHTML = "";

    if (sorted.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <h3>Henüz not yok</h3>
                <p>
                    Ana sayfadaki widget'tan ya da
                    yukarıdan hızlıca not ekleyebilirsin.
                </p>
            </div>
        `;

        return;

    }

    sorted.forEach(note => {

        const row =
            document.createElement("div");

        row.className =
            "day-panel-item";

        row.innerHTML = `
            <span class="day-panel-item-time">
                ${escapeHtml(formatShortDayLabel(note.date))}
            </span>
            <span class="day-panel-item-text quick-note-text">
                ${escapeHtml(note.text)}
            </span>
            <button
                type="button"
                class="day-panel-item-delete"
                data-action="delete-quick-note"
                data-note-id="${escapeHtml(note.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `;

        container.appendChild(row);

    });

}

/* =========================================================
   HIZLI NOT — KAYDETME AKIŞI (Kaydet butonu + Ctrl/Cmd+Enter)
   ========================================================= */

function handleQuickNoteWidgetSave() {

    const textarea =
        $("#quick-note-input");

    if (!textarea) {
        return;
    }

    const note =
        addQuickNote(textarea.value);

    if (!note) {
        return;
    }

    textarea.value = "";

    renderQuickNotes();

    showShortcutHint("Not kaydedildi ✓");

}

function handleQuickNotePageSave() {

    const textarea =
        $("#notes-page-input");

    if (!textarea) {
        return;
    }

    const note =
        addQuickNote(textarea.value);

    if (!note) {
        return;
    }

    textarea.value = "";

    renderQuickNotes();

    showShortcutHint("Not kaydedildi ✓");

}

function setupQuickNoteTextarea(selector, saveHandler) {

    const textarea =
        $(selector);

    if (!textarea) {
        return;
    }

    textarea.addEventListener(
        "keydown",
        event => {

            const isSaveShortcut =
                (event.ctrlKey || event.metaKey) &&
                event.key === "Enter";

            if (isSaveShortcut) {

                event.preventDefault();

                saveHandler();

            }

            /*
             * Normal Enter'a dokunulmuyor — textarea'nın
             * varsayılan davranışı (yeni satır) korunuyor.
             */

        }
    );

}

/* =========================================================
   HIZLI NOT — OLAY DİNLEYİCİLERİ
   ========================================================= */

function setupQuickNotes() {

    on(
        "#quick-note-save",
        "click",
        handleQuickNoteWidgetSave
    );

    on(
        "#notes-page-save",
        "click",
        handleQuickNotePageSave
    );

    setupQuickNoteTextarea(
        "#quick-note-input",
        handleQuickNoteWidgetSave
    );

    setupQuickNoteTextarea(
        "#notes-page-input",
        handleQuickNotePageSave
    );

    on(
        "#quick-note-see-all",
        "click",
        () => navigateTo("notes")
    );

    delegate(
        document.body,
        "click",
        "[data-action]",
        element => {

            const action =
                element.dataset.action;

            const noteId =
                element.dataset.noteId;

            if (
                action === "delete-quick-note" &&
                noteId
            ) {

                deleteQuickNoteWithConfirm(noteId);

            }

        }
    );

}
