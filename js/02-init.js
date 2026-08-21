/* =========================================================
   02-init.js
   Uygulama başlangıcı (DOMContentLoaded) — tüm setup çağrıları burada.
   ========================================================= */

/* =========================================================
   BAŞLANGIÇ
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    /*
     * Kategoriler, görevlerden ÖNCE yüklenmeli: loadData()
     * içinde tasks normalizeTask() ile normalize edilirken
     * her görevin category id'si mevcut `categories`
     * listesine göre doğrulanıyor. Sıra tersine çevrilirse
     * (categories henüz boşken tasks normalize edilirse)
     * kayıtlı tüm görevler yanlışlıkla varsayılan kategoriye
     * düşer.
     *
     * loadIcsCache() da aynı nedenle ilk render'dan ÖNCE
     * çalışmalı: renderAll() → renderCalendar() →
     * buildCalendarEventsForYear() zaten icsEvents'i okuyor;
     * cache önce yüklenmezse ilk açılışta (ağ isteği daha
     * dönmeden) önbellekteki özel günler bir an için
     * gösterilmemiş olur.
     */
    loadCategories();
    loadIcsCache();
    loadData();
    loadDailyData();
    loadGoals();
    loadQuickNotes();
    applyTheme();
    setupNavigation();
    setupGlobalButtons();
    setupDayPanel();
    setupKeyboardShortcuts();
    setupCategoryManagement();
    setupMediaPage();
    setupMediaRecording();
    setupGoalsPage();
    setupQuickNotes();
    setupConfirmModal();
    setupFactoryReset();

    renderAll();
    updateClock();

    requestAnimationFrame(() => {
        renderCalendar();
    });

    selectedDayKey = effectiveDateKey();
    lastKnownDayKey = selectedDayKey;
    selectDay(selectedDayKey);

    setInterval(updateClock, 1000);

    /*
     * Takvim için genel ICS özel gün beslemesini arka planda
     * yükle. Sabit/hesaplanan özel günler (bkz.
     * getComputedSpecialDaysForYear()) senkron üretildiğinden
     * ayrıca bir yükleme çağrısına ihtiyaç duymaz.
     */
    fetchIcsCalendar();

    /*
     * Medya (fotoğraf/ses) metadata'sı IndexedDB'den
     * asenkron yüklenir; ilk karede boş/yükleniyor
     * durumundaki grid, veri gelince kendini günceller
     * (fetchIcsCalendar ile aynı desen).
     */
    loadMediaIndex().then(() => {

        renderMediaPage();
        renderDayPanelMedia();

    });

});
