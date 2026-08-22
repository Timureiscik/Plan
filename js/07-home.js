/* =========================================================
   07-home.js
   Tüm ekranları yenile, günün sözü, ana sayfa render, arama değeri.
   ========================================================= */

/* =========================================================
   TÜM EKRANLARI YENİLE
   ========================================================= */

function renderAll() {

    updatePageTitle();

    renderHome();
    renderQuoteOfDay();
    renderDailySummary();
    renderQuickNotes();

    renderCategoryFilter();

    renderTaskList(
        getSearchValue()
    );

    renderCalendar();

    renderDayPanel();

    renderStreaks();
    renderGoalsPage();
    renderBadges();

    renderMediaPage();

    updateStatsAndSidebar();

    updateClock();

}

/* =========================================================
   GÜNÜN SÖZÜ — RENDER
   ========================================================= */

function renderQuoteOfDay() {

    const textEl =
        $("#quote-of-day-text");

    if (!textEl) {
        return;
    }

    textEl.textContent =
        getQuoteOfTheDay();

}

/* =========================================================
   ANA SAYFA
   ========================================================= */

function renderHome() {

    const container =
        $("#home-task-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (tasks.length === 0) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">✓</div>
                <h3>Henüz görev yok</h3>
                <p>İlk görevini ekleyerek başlayabilirsin.</p>
                <button
                    class="primary-button add-task-button"
                    type="button"
                >
                    + Görev Ekle
                </button>
            </div>
        `;

        return;

    }

    tasks
        .slice(0, 6)
        .forEach(task => {

            container.appendChild(
                createTaskRow(task)
            );

        });

}

function createTaskRow(task) {

    const row =
        document.createElement("div");

    row.className = "task-row";

    row.dataset.taskId =
        task.id;

    const completed =
        isCompletedToday(task);

    const category =
        getCategory(task.category);

    /*
     * getLast7DaysCount(task) daha önce burada hem meta
     * satırında hem de progress badge'inde ayrı ayrı
     * çağrılıyordu (aynı render akışında aynı sonucu iki
     * kez hesaplıyordu). Değer artık bir kez hesaplanıp
     * her iki yerde de aynen kullanılıyor — görüntü/davranış
     * değişmedi.
     */
    const last7DaysCount =
        getLast7DaysCount(task);

    row.innerHTML = `
        <button
            class="task-check ${completed ? "checked" : ""}"
            type="button"
            data-action="toggle-complete"
            data-task-id="${escapeHtml(task.id)}"
            title="Bugünü tamamlandı olarak işaretle"
            aria-label="Bugünü tamamla"
        >${completed ? "✓" : ""}</button>

        <span
            class="task-row-category-dot"
            style="background:${category.color}"
        ></span>

        <div class="task-row-info">

            <div
                class="task-row-title ${completed ? "completed" : ""}"
            >
                ${escapeHtml(task.title)}
            </div>

            <div class="task-row-meta">
                ${getCurrentStreak(task)} günlük seri
                •
                ${last7DaysCount}/7
            </div>

        </div>

        <div class="task-row-progress">
            ${last7DaysCount}/7
        </div>
    `;

    return row;

}

/* =========================================================
   GÖREV SATIRI — TARGETED GÜNCELLEME (P0-1A)

   createTaskRow() ile AYNI görsel çıktıyı üretir, ama DOM
   node'unu SIFIRDAN yaratmak yerine #home-task-list içinde
   ZATEN VAR OLAN satırı yerinde günceller. Yeni bir template/
   render sistemi İCAT EDİLMEDİ — createTaskRow() içindeki
   metin/class hesaplama mantığı (getCurrentStreak,
   getLast7DaysCount, completed) BİREBİR aynı şekilde
   kullanılıyor; yalnızca hedef artık innerHTML atamak yerine
   mevcut alt elementlerin textContent/className'i.

   Node bulunamazsa (görev Ana Sayfanın ilk 6'sı DIŞINDaysa,
   ya da henüz hiç görev yoksa) SESSİZCE hiçbir şey yapılmaz —
   yeni bir satır asla EKLENMEZ (bkz. P0-1A kapsam sınırı:
   liste üyeliği/reordering bu değişikliğin işi değil).
   ========================================================= */

function updateTaskRowUI(taskId) {

    const row =
        document.querySelector(
            `.task-row[data-task-id="${taskId}"]`
        );

    if (!row) {
        return;
    }

    const task =
        tasks.find(
            item => item.id === taskId
        );

    if (!task) {
        return;
    }

    const completed =
        isCompletedToday(task);

    const last7DaysCount =
        getLast7DaysCount(task);

    const checkButton =
        row.querySelector(".task-check");

    if (checkButton) {

        checkButton.classList.toggle(
            "checked",
            completed
        );

        checkButton.textContent =
            completed ? "✓" : "";

    }

    const titleEl =
        row.querySelector(".task-row-title");

    if (titleEl) {

        titleEl.classList.toggle(
            "completed",
            completed
        );

    }

    const metaEl =
        row.querySelector(".task-row-meta");

    if (metaEl) {

        metaEl.textContent =
            `${getCurrentStreak(task)} günlük seri • ${last7DaysCount}/7`;

    }

    const progressEl =
        row.querySelector(".task-row-progress");

    if (progressEl) {

        progressEl.textContent =
            `${last7DaysCount}/7`;

    }

}

/* =========================================================
   ARAMA DEĞERİ

   #task-search inputunun güncel (trim edilmiş) değerini
   döndürür. renderAll() içinde renderTaskList() her
   çağrıldığında kullanılır; bu fonksiyon tanımsız olduğunda
   renderTaskList(getSearchValue()) satırı ReferenceError
   fırlatıyor ve renderAll() bu noktada durup altındaki tüm
   render adımlarını (renderTaskList, renderCalendar,
   renderDayPanel, renderStreaks, updateStatsAndSidebar,
   updateClock) atlıyordu. renderHome() bu satırdan ÖNCE
   çalıştığı için görev Ana Sayfada görünüyor ama Görevler
   sayfası hiç güncellenmiyordu.
   ========================================================= */

function getSearchValue() {

    const search =
        $("#task-search");

    return search
        ? search.value.trim()
        : "";

}
