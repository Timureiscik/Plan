/* =========================================================
   05-navigation.js
   Navigation, sayfa başlığı, mobil menü, global butonlar, event helpers.
   ========================================================= */

/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    $$(".nav-item").forEach(button => {

        button.addEventListener("click", () => {

            const page = button.dataset.page;

            if (!page) {
                return;
            }

            navigateTo(page);
            closeMobileSidebar();

        });

    });

}

function navigateTo(page) {

    currentPage = page;
    focusedTaskIndex = -1;

    $$(".nav-item").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.page === page
        );

    });

    $$(".page").forEach(section => {

        section.classList.toggle(
            "active",
            section.id === `page-${page}`
        );

    });

    updatePageTitle();
    renderAll();

    if (page === "calendar") {

        /*
         * Takvim sayfası "display:none" durumundan
         * "display:block" durumuna geçtiği anda bazı
         * tarayıcılar grid hücrelerini ilk karede
         * doğru boyutlandırmayabilir. Görünür hale
         * geldikten hemen sonra bir kare daha
         * yeniden çizerek bunu garantiye alıyoruz.
         */

        requestAnimationFrame(() => {
            renderCalendar();
        });

    }

}

/* =========================================================
   SAYFA BAŞLIĞI
   ========================================================= */

function updatePageTitle() {

    const titles = {

        home: {
            title: "Ana Sayfa",
            subtitle: "Bugün ne yapacaksın?"
        },

        tasks: {
            title: "Görevler",
            subtitle: "Görevlerini düzenle ve tamamla."
        },

        calendar: {
            title: "Takvim",
            subtitle: "Resmi tatilleri ve önemli günleri takip et."
        },

        streaks: {
            title: "Seriler",
            subtitle: "Devamlılığını ve ilerlemeni gör."
        },

        goals: {
            title: "Hedefler",
            subtitle: "Haftalık, aylık ve özel dönem hedeflerini takip et."
        },

        notes: {
            title: "Notlar",
            subtitle: "Aklına gelenleri hızlıca kaydet."
        },

        media: {
            title: "Fotoğraflar",
            subtitle: "Fotoğraflarını ve ses kayıtlarını ay ay arşivle."
        }

    };

    const data =
        titles[currentPage] ||
        titles.home;

    const title = $("#page-title");
    const subtitle = $("#page-subtitle");

    if (title) {
        title.textContent = data.title;
    }

    if (subtitle) {
        subtitle.textContent = data.subtitle;
    }

}

/* =========================================================
   MOBİL MENÜ
   ========================================================= */

function openMobileSidebar() {

    document.body.classList.add(
        "sidebar-open"
    );

}

function closeMobileSidebar() {

    document.body.classList.remove(
        "sidebar-open"
    );

}

/* =========================================================
   GLOBAL BUTONLAR
   ========================================================= */

function setupGlobalButtons() {

    document.addEventListener("click", event => {

        if (
            event.target.closest(".add-task-button") ||
            event.target.closest("#topbar-add-task")
        ) {

            openTaskModal();

        }

    });

    on(
        "#close-task-modal",
        "click",
        closeTaskModal
    );

    on(
        "#cancel-task",
        "click",
        closeTaskModal
    );

    on(
        "#task-form",
        "submit",
        handleTaskSubmit
    );

    on(
        "#open-settings",
        "click",
        openSettingsModal
    );

    on(
        "#close-settings-modal",
        "click",
        closeSettingsModal
    );

    on(
        "#cancel-settings",
        "click",
        closeSettingsModal
    );

    on(
        "#settings-form",
        "submit",
        handleSettingsSubmit
    );

    delegate(
        "#category-picker",
        "click",
        "[data-category]",
        element => {

            selectedCategory =
                element.dataset.category;

            renderCategoryPicker();

        }
    );

    delegate(
        "#category-filter",
        "click",
        "[data-category]",
        element => {

            activeCategoryFilter =
                element.dataset.category;

            renderCategoryFilter();
            renderTaskList(
                getSearchValue()
            );

        }
    );

    delegate(
        document.body,
        "click",
        "[data-action]",
        (element, event) => {

            const action =
                element.dataset.action;

            const taskId =
                element.dataset.taskId;

            if (
                action === "toggle-complete" &&
                taskId
            ) {

                toggleCompleteToday(taskId);

            } else if (
                action === "toggle-desc" &&
                taskId
            ) {

                toggleDescription(taskId);

            } else if (
                action === "edit-task" &&
                taskId
            ) {

                const task =
                    tasks.find(
                        task => task.id === taskId
                    );

                if (task) {
                    openTaskModal(task);
                }

            } else if (
                action === "delete-task" &&
                taskId
            ) {

                deleteTask(taskId);

            } else if (
                action === "move-up" &&
                taskId
            ) {

                moveTask(taskId, -1);

            } else if (
                action === "move-down" &&
                taskId
            ) {

                moveTask(taskId, 1);

            }

        }
    );

    on(
        "#previous-month",
        "click",
        () => changeMonth(-1)
    );

    on(
        "#next-month",
        "click",
        () => changeMonth(1)
    );

    on(
        "#calendar-today",
        "click",
        goToTodayInPanel
    );

    delegate(
        "#calendar-grid",
        "click",
        ".calendar-day",
        element => {

            if (element.dataset.date) {
                selectDay(element.dataset.date);
            }

        }
    );

    const search = $("#task-search");

    if (search) {

        search.addEventListener(
            "input",
            () => {

                renderTaskList(
                    getSearchValue()
                );

            }
        );

    }

    on(
        "#mobile-menu",
        "click",
        openMobileSidebar
    );

    on(
        "#sidebar-overlay",
        "click",
        closeMobileSidebar
    );

    document.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                $("#task-modal")
            ) {

                closeTaskModal();

            }

            if (
                event.target ===
                $("#settings-modal")
            ) {

                closeSettingsModal();

            }

        }
    );

}

/* =========================================================
   EVENT HELPERS
   ========================================================= */

function on(selector, type, handler) {

    const element = $(selector);

    if (element) {

        element.addEventListener(
            type,
            handler
        );

    }

}

function delegate(
    scopeOrSelector,
    type,
    childSelector,
    handler
) {

    const scope =
        typeof scopeOrSelector === "string"
            ? $(scopeOrSelector)
            : scopeOrSelector;

    if (!scope) {
        return;
    }

    scope.addEventListener(
        type,
        event => {

            const target =
                event.target instanceof Element
                    ? event.target
                    : null;

            if (!target) {
                return;
            }

            const match =
                target.closest(
                    childSelector
                );

            if (
                match &&
                scope.contains(match)
            ) {

                handler(match, event);

            }

        }
    );

}

