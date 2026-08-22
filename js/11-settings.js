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

    showShortcutHint("Ayarlar kaydedildi");

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

/* =========================================================
   TÜM VERİLERİ SİL (FACTORY RESET)

   Yeni bir onay/silme sistemi İCAT EDİLMEDİ — yukarıdaki
   openConfirmModal() aynen kullanılıyor (bkz. Ayarlar
   modalı → "Tehlikeli Alan", Plan.html).

   localStorage.clear() KULLANILMIYOR — yalnızca Habitus'a
   ait BİLİNEN anahtarlar tek tek siliniyor; böylece aynı
   origin'de (aynı klasörden servis edilen) başka bir
   uygulamaya ait veri varsa ona dokunulmuyor.

   Fotoğraf/ses blob'ları ve metadata'sı localStorage'da
   DEĞİL, ayrı bir IndexedDB veritabanında tutuluyor (bkz.
   14-media-core.js — MEDIA_DB_NAME/MEDIA_META_STORE/
   MEDIA_BLOB_STORE); bu yüzden o veritabanı da ayrıca
   silinir (tek bir deleteDatabase() çağrısı, iki store'u
   da kapsar — ayrı ayrı silmeye gerek yok).

   Anahtar/veritabanı adları yalnızca burada TEKRAR
   YAZILMIYOR — 01-constants.js / 14-media-core.js'teki
   mevcut sabitler (STORAGE_KEY, GOALS_KEY, MEDIA_DB_NAME
   vb.) doğrudan kullanılıyor; bu referanslar fonksiyon
   gövdesi içinde (çağrı anında, sayfa tamamen yüklendikten
   sonra) okunduğu için script yükleme SIRASINDAN bağımsız
   ve güvenlidir.
   ========================================================= */

function getHabitusLocalStorageKeys() {

    return [
        STORAGE_KEY,
        LEGACY_STORAGE_KEY,
        SETTINGS_KEY,
        LEGACY_SETTINGS_KEY,
        DAILY_KEY,
        CATEGORIES_KEY,
        GOALS_KEY,
        NOTES_KEY,
        ICS_CACHE_KEY,
        BADGE_EARNED_KEY
    ];

}

function deleteHabitusMediaDatabase() {

    return new Promise((resolve, reject) => {

        if (!window.indexedDB) {

            /*
             * IndexedDB bu tarayıcıda hiç yoksa silinecek
             * bir şey de yok — hata değil, no-op.
             */
            resolve();

            return;

        }

        /*
         * Açık bir bağlantı varsa (mediaDb — bkz.
         * 14-media-core.js) önce kapatılır; aksi hâlde
         * deleteDatabase() tarayıcıda "blocked" durumuna
         * düşüp hiç tamamlanmayabilir.
         */
        if (
            typeof mediaDb !== "undefined" &&
            mediaDb
        ) {

            try {
                mediaDb.close();
            } catch (error) {
                /* zaten kapalı olabilir — yoksay */
            }

            mediaDb = null;

        }

        const request =
            indexedDB.deleteDatabase(MEDIA_DB_NAME);

        request.onsuccess = () => resolve();

        request.onerror = () =>
            reject(
                request.error ||
                new Error("Medya veritabanı silinemedi.")
            );

        request.onblocked = () =>
            reject(
                new Error(
                    "Medya veritabanı başka bir sekmede " +
                    "açık olduğu için silinemedi."
                )
            );

    });

}

async function performFactoryReset() {

    try {

        getHabitusLocalStorageKeys().forEach(key => {
            localStorage.removeItem(key);
        });

        await deleteHabitusMediaDatabase();

        /*
         * En güvenilir "temiz başlangıç durumu": onlarca
         * modülün bellek içi state'ini (tasks, goals,
         * quickNotes, mediaMetaList, dailyData, categories,
         * badgeEarnedAt, icsEvents vb.) tek tek elle
         * sıfırlamak yerine sayfayı yeniden yüklemek. Tüm
         * ilgili veri zaten storage'dan silindiği için
         * yeniden yükleme, uygulamanın normal "ilk açılış /
         * varsayılan durum" akışına (bkz. 02-init.js) düşer
         * — ayrı bir "reset state" mantığı İCAT EDİLMEDİ.
         */
        window.location.reload();

    } catch (error) {

        console.error(
            "Tüm veriler silinirken hata oluştu:",
            error
        );

        showShortcutHint(
            "Silme işlemi tamamlanamadı. Lütfen tekrar dene."
        );

    }

}

function setupFactoryReset() {

    on(
        "#factory-reset-button",
        "click",
        () => {

            openConfirmModal({
                title: "Tüm verileri sil",
                message:
                    "Habitus'a ait tüm görev, hedef, not, " +
                    "kategori, gün paneli, rozet ve medya " +
                    "(fotoğraf/ses) verileri bu cihazdan " +
                    "kalıcı olarak silinecek. Bu işlem geri " +
                    "alınamaz. Emin misin?",
                confirmLabel: "Tümünü sil",
                danger: true,
                onConfirm: performFactoryReset
            });

        }
    );

}
