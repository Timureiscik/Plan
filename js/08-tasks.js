/* =========================================================
   08-tasks.js
   Görev listesi, tam görev kartı, açıklama render.
   ========================================================= */

/* =========================================================
   GÖREV LİSTESİ
   ========================================================= */

function renderTaskList(
    searchText = ""
) {

    const container =
        $("#task-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    let filtered =
        [...tasks];

    if (
        activeCategoryFilter !== "all"
    ) {

        filtered =
            filtered.filter(
                task =>
                    task.category ===
                    activeCategoryFilter
            );

    }

    if (searchText) {

        const query =
            searchText.toLocaleLowerCase(
                "tr-TR"
            );

        filtered =
            filtered.filter(task => {

                const title =
                    task.title.toLocaleLowerCase(
                        "tr-TR"
                    );

                const description =
                    task.description.toLocaleLowerCase(
                        "tr-TR"
                    );

                return (
                    title.includes(query) ||
                    description.includes(query)
                );

            });

    }

    updateTaskCounter();

    if (filtered.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">○</div>

                <h3>
                    ${
                        searchText ||
                        activeCategoryFilter !== "all"
                            ? "Sonuç bulunamadı"
                            : "Henüz görev yok"
                    }
                </h3>

                <p>
                    ${
                        searchText ||
                        activeCategoryFilter !== "all"
                            ? "Farklı bir arama veya kategori deneyebilirsin."
                            : "Yeni bir görev ekleyerek başlayabilirsin."
                    }
                </p>
            </div>
        `;

        return;

    }

    filtered.forEach(
        (task, filteredIndex) => {

            const realIndex =
                tasks.findIndex(
                    item =>
                        item.id === task.id
                );

            container.appendChild(
                createFullTaskCard(
                    task,
                    realIndex,
                    filteredIndex === 0,
                    filteredIndex ===
                        filtered.length - 1
                )
            );

        }
    );

    if (focusedTaskIndex >= 0) {

        const cards =
            $$(".task-card");

        focusedTaskIndex =
            Math.min(
                focusedTaskIndex,
                cards.length - 1
            );

        if (
            focusedTaskIndex >= 0
        ) {

            focusTaskCard(cards);

        }

    }

}

/* =========================================================
   TAM GÖREV KARTI
   ========================================================= */

function createFullTaskCard(
    task,
    realIndex,
    isFirst,
    isLast
) {

    const card =
        document.createElement("div");

    card.className =
        "task-card";

    card.dataset.taskId =
        task.id;

    card.style.setProperty(
        "--category-color",
        getCategory(task.category).color
    );

    card.tabIndex = -1;

    const completed =
        isCompletedToday(task);

    const category =
        getCategory(task.category);

    const hasDescription =
        task.description &&
        task.description.trim().length > 0;

    card.innerHTML = `
        <div class="task-card-main">

            <button
                class="task-check ${completed ? "checked" : ""}"
                type="button"
                data-action="toggle-complete"
                data-task-id="${escapeHtml(task.id)}"
                title="Bugünü tamamlandı olarak işaretle"
                aria-label="Bugünü tamamla"
            >
                ${completed ? "✓" : ""}
            </button>

            <div class="task-card-info">

                <div class="task-card-title-row">

                    <span
                        class="task-card-title ${completed ? "completed" : ""}"
                    >
                        ${escapeHtml(task.title)}
                    </span>

                    <span
                        class="task-category-tag"
                        style="--category-color:${category.color}"
                    >
                        ${category.icon}
                        ${escapeHtml(category.name)}
                    </span>

                </div>

                <div class="task-card-meta">
                    ${getCurrentStreak(task)} günlük seri
                    •
                    Son 7 günde ${getLast7DaysCount(task)}/7
                    •
                    En iyi seri ${getBestStreak(task)}
                </div>

            </div>

            <div class="task-card-actions">

                <button
                    class="icon-mini-button desc-toggle"
                    type="button"
                    data-action="toggle-desc"
                    data-task-id="${escapeHtml(task.id)}"
                    title="Açıklamayı göster"
                    aria-label="Açıklamayı göster"
                >
                    ⌄
                </button>

                <div class="reorder-group">

                    <button
                        class="icon-mini-button"
                        type="button"
                        data-action="move-up"
                        data-task-id="${escapeHtml(task.id)}"
                        title="Yukarı taşı"
                        ${realIndex === 0 ? "disabled" : ""}
                    >
                        ▲
                    </button>

                    <button
                        class="icon-mini-button"
                        type="button"
                        data-action="move-down"
                        data-task-id="${escapeHtml(task.id)}"
                        title="Aşağı taşı"
                        ${
                            realIndex === tasks.length - 1
                                ? "disabled"
                                : ""
                        }
                    >
                        ▼
                    </button>

                </div>

                <button
                    class="icon-mini-button"
                    type="button"
                    data-action="edit-task"
                    data-task-id="${escapeHtml(task.id)}"
                    title="Düzenle"
                    aria-label="Düzenle"
                >
                    ✎
                </button>

                <button
                    class="icon-mini-button danger"
                    type="button"
                    data-action="delete-task"
                    data-task-id="${escapeHtml(task.id)}"
                    title="Sil"
                    aria-label="Sil"
                >
                    ✕
                </button>

            </div>

        </div>

        <div
            class="task-description-panel"
            data-panel-for="${escapeHtml(task.id)}"
        >
            <p class="${hasDescription ? "" : "empty"}">
                ${
                    hasDescription
                        ? escapeHtml(task.description)
                        : "Bu görev için açıklama eklenmemiş."
                }
            </p>
        </div>
    `;

    return card;

}

/* =========================================================
   GÖREV KARTI — TARGETED GÜNCELLEME (P0-1A)

   createFullTaskCard() ile AYNI metin/CLASS hesaplama
   mantığını (getCurrentStreak, getLast7DaysCount,
   getBestStreak, isCompletedToday) kullanır — yeni bir
   hesaplama sistemi İCAT EDİLMEDİ. Fark: kartın TAMAMI
   yeniden yaratılmıyor; #task-list içinde ZATEN VAR OLAN
   `.task-card[data-task-id]` node'u bulunup yalnızca
   checkbox/title/meta güncelleniyor.

   Kart mevcut değilse (arama/kategori filtresi nedeniyle
   o an DOM'da yoksa) SESSİZCE hiçbir şey yapılmaz — kart
   asla listeye zorla eklenmiyor. Aynı nedenle
   task-card-actions (sil/düzenle/sırala butonları,
   realIndex'e bağlı disabled state) ve açıklama paneli
   (.task-description-panel) BURADA HİÇ DOKUNULMUYOR —
   bunlar tamamlanma durumundan etkilenmez ve açık/kapalı
   state'i (bkz. toggleDescription) böylece korunur.
   ========================================================= */

function updateTaskCardUI(taskId) {

    const card =
        document.querySelector(
            `.task-card[data-task-id="${taskId}"]`
        );

    if (!card) {
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

    const checkButton =
        card.querySelector(".task-check");

    if (checkButton) {

        checkButton.classList.toggle(
            "checked",
            completed
        );

        checkButton.textContent =
            completed ? "✓" : "";

    }

    const titleEl =
        card.querySelector(".task-card-title");

    if (titleEl) {

        titleEl.classList.toggle(
            "completed",
            completed
        );

    }

    const metaEl =
        card.querySelector(".task-card-meta");

    if (metaEl) {

        metaEl.textContent =
            `${getCurrentStreak(task)} günlük seri • ` +
            `Son 7 günde ${getLast7DaysCount(task)}/7 • ` +
            `En iyi seri ${getBestStreak(task)}`;

    }

}

/* =========================================================
   AÇIKLAMA
   ========================================================= */

function toggleDescription(taskId) {

    const panel =
        findDescriptionPanel(taskId);

    const toggle =
        findTaskDescriptionButton(taskId);

    if (!panel) {
        return;
    }

    const open =
        panel.classList.toggle("open");

    if (toggle) {

        toggle.classList.toggle(
            "open",
            open
        );

    }

}

function findDescriptionPanel(taskId) {

    return $$(
        ".task-description-panel"
    ).find(
        element =>
            element.dataset.panelFor ===
            String(taskId)
    ) || null;

}

function findTaskDescriptionButton(
    taskId
) {

    return $$(
        ".desc-toggle"
    ).find(
        element =>
            element.dataset.taskId ===
            String(taskId)
    ) || null;

}
