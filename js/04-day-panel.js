/* =========================================================
   04-day-panel.js
   Gece kuşu/etkin gün mantığı + Gün Paneli (seçim, veri işlemleri, render, olay dinleyicileri).
   ========================================================= */

/* =========================================================
   GECE KUŞU / ETKİN GÜN
   ========================================================= */

function effectiveDate(date = new Date()) {

    const shifted = new Date(date);

    if (
        shifted.getHours() <
        settings.dayResetHour
    ) {

        shifted.setDate(
            shifted.getDate() - 1
        );

    }

    return shifted;

}

function effectiveDateKey() {

    return dateKey(effectiveDate());

}

function isCompletedOn(task, key) {

    return task.completedDates.includes(key);

}

function isCompletedToday(task) {

    return isCompletedOn(
        task,
        effectiveDateKey()
    );

}

/* =========================================================
   GÜN PANELİ — SEÇİM
   ========================================================= */

function selectDay(key) {

    if (
        typeof key !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(key)
    ) {

        key = effectiveDateKey();

    }

    selectedDayKey = key;

    const grid = $("#calendar-grid");

    if (grid) {

        $$(".calendar-day", grid).forEach(cell => {

            cell.classList.toggle(
                "is-selected",
                cell.dataset.date === key
            );

        });

    }

    renderDayPanel();

}

function goToTodayInPanel() {

    /*
     * "Bugün" merkezi effectiveDate sistemine göre
     * belirlenir; ay görünümü de aynı tarihe göre
     * açılmalı.
     */
    calendarDate = effectiveDate();

    renderCalendar();
    selectDay(effectiveDateKey());

}

/* =========================================================
   GÜN PANELİ — VERİ İŞLEMLERİ
   ========================================================= */

function addDailyNote(key, text) {

    const trimmed = text.trim().slice(0, 200);

    if (!trimmed) {
        return;
    }

    const entry = getDayEntry(key, true);

    entry.notes.push({
        id: createId(),
        text: trimmed,
        createdAt: new Date().toISOString()
    });

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function deleteDailyNote(key, id) {

    const entry = getDayEntry(key, true);

    const note =
        entry.notes.find(
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

            entry.notes =
                entry.notes.filter(
                    item => item.id !== id
                );

            saveDailyData();
            renderDayPanel();
            renderCalendar();

        }
    });

}

function addHomework(key, title) {

    const trimmed = title.trim().slice(0, 120);

    if (!trimmed) {
        return;
    }

    const entry = getDayEntry(key, true);

    entry.homeworks.push({
        id: createId(),
        title: trimmed,
        done: false,
        createdAt: new Date().toISOString()
    });

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function toggleHomework(key, id) {

    const entry = getDayEntry(key, true);

    const item =
        entry.homeworks.find(
            homework => homework.id === id
        );

    if (item) {
        item.done = !item.done;
    }

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function deleteHomework(key, id) {

    const entry = getDayEntry(key, true);

    const homework =
        entry.homeworks.find(
            item => item.id === id
        );

    if (!homework) {
        return;
    }

    openConfirmModal({
        title: "Ödevi sil",
        message:
            `"${homework.title}" ödevini silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => {

            entry.homeworks =
                entry.homeworks.filter(
                    item => item.id !== id
                );

            saveDailyData();
            renderDayPanel();
            renderCalendar();

        }
    });

}

function addProject(key, title) {

    const trimmed = title.trim().slice(0, 120);

    if (!trimmed) {
        return;
    }

    const entry = getDayEntry(key, true);

    entry.projects.push({
        id: createId(),
        title: trimmed,
        createdAt: new Date().toISOString()
    });

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function deleteProject(key, id) {

    const entry = getDayEntry(key, true);

    const project =
        entry.projects.find(
            item => item.id === id
        );

    if (!project) {
        return;
    }

    openConfirmModal({
        title: "Projeyi sil",
        message:
            `"${project.title}" projesini silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => {

            entry.projects =
                entry.projects.filter(
                    item => item.id !== id
                );

            saveDailyData();
            renderDayPanel();
            renderCalendar();

        }
    });

}

function addPlanItem(key, time, title) {

    const trimmedTitle = title.trim().slice(0, 80);

    if (!trimmedTitle) {
        return;
    }

    const safeTime =
        /^\d{2}:\d{2}$/.test(time)
            ? time
            : "00:00";

    const entry = getDayEntry(key, true);

    entry.dailyPlan.push({
        id: createId(),
        time: safeTime,
        title: trimmedTitle,
        done: false,
        createdAt: new Date().toISOString()
    });

    entry.dailyPlan.sort(
        (a, b) => a.time.localeCompare(b.time)
    );

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function togglePlanItem(key, id) {

    const entry = getDayEntry(key, true);

    const item =
        entry.dailyPlan.find(
            plan => plan.id === id
        );

    if (item) {
        item.done = !item.done;
    }

    saveDailyData();
    renderDayPanel();
    renderCalendar();

}

function deletePlanItem(key, id) {

    const entry = getDayEntry(key, true);

    const plan =
        entry.dailyPlan.find(
            item => item.id === id
        );

    if (!plan) {
        return;
    }

    openConfirmModal({
        title: "Planı sil",
        message:
            `"${plan.title}" planını silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => {

            entry.dailyPlan =
                entry.dailyPlan.filter(
                    item => item.id !== id
                );

            saveDailyData();
            renderDayPanel();
            renderCalendar();

        }
    });

}

/* =========================================================
   GÜN PANELİ — RENDER
   ========================================================= */

function renderDayPanel() {

    const dateEl = $("#day-panel-date");

    if (!dateEl) {
        return;
    }

    const key =
        selectedDayKey ||
        effectiveDateKey();

    const date = parseDate(key);

    const todayKey = effectiveDateKey();

    const weekdayEl = $("#day-panel-weekday");
    const badgeEl = $("#day-panel-badge");
    const specialEl = $("#day-panel-special");

    dateEl.textContent =
        date.toLocaleDateString(
            "tr-TR",
            {
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );

    if (weekdayEl) {

        weekdayEl.textContent =
            date.toLocaleDateString(
                "tr-TR",
                { weekday: "long" }
            );

    }

    if (badgeEl) {

        badgeEl.classList.remove(
            "is-past",
            "is-future"
        );

        if (key === todayKey) {

            badgeEl.textContent = "Bugün";

        } else if (key < todayKey) {

            badgeEl.textContent = "Geçmiş gün";
            badgeEl.classList.add("is-past");

        } else {

            badgeEl.textContent = "Gelecek gün";
            badgeEl.classList.add("is-future");

        }

    }

    if (specialEl) {

        const events = getEventsForDate(date);
        const isNov10 =
            date.getMonth() === 10 &&
            date.getDate() === 10;

        specialEl.classList.toggle(
            "is-november-10",
            isNov10
        );

        if (isNov10) {

            specialEl.hidden = false;

            specialEl.textContent =
                "10 Kasım — Atatürk'ü Anma Günü";

        } else if (events.length > 0) {

            specialEl.hidden = false;

            specialEl.textContent =
                events
                    .map(event => event.title)
                    .join(" • ");

        } else {

            specialEl.hidden = true;
            specialEl.textContent = "";

        }

    }

    const entry = getDayEntry(key);

    renderDayPanelList(
        "#daily-plan-list",
        entry.dailyPlan,
        item => `
            <span class="day-panel-item-time">
                ${escapeHtml(item.time)}
            </span>
            <span class="day-panel-item-text">
                ${escapeHtml(item.title)}
            </span>
            <button
                type="button"
                class="day-panel-item-check ${item.done ? "checked" : ""}"
                data-action="toggle-plan"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Tamamlandı işaretle"
                aria-label="Tamamlandı işaretle"
            >${item.done ? "✓" : ""}</button>
            <button
                type="button"
                class="day-panel-item-delete"
                data-action="delete-plan"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `,
        item => item.done,
        "Bu gün için henüz plan yok."
    );

    renderDayPanelList(
        "#day-notes-list",
        entry.notes,
        item => `
            <span class="day-panel-item-text">
                ${escapeHtml(item.text)}
            </span>
            <button
                type="button"
                class="day-panel-item-delete"
                data-action="delete-note"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `,
        () => false,
        "Bu gün için not yok."
    );

    renderDayPanelList(
        "#day-homework-list",
        entry.homeworks,
        item => `
            <span class="day-panel-item-text">
                ${escapeHtml(item.title)}
            </span>
            <button
                type="button"
                class="day-panel-item-check ${item.done ? "checked" : ""}"
                data-action="toggle-homework"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Tamamlandı işaretle"
                aria-label="Tamamlandı işaretle"
            >${item.done ? "✓" : ""}</button>
            <button
                type="button"
                class="day-panel-item-delete"
                data-action="delete-homework"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `,
        item => item.done,
        "Bu gün için ödev yok."
    );

    renderDayPanelList(
        "#day-projects-list",
        entry.projects,
        item => `
            <span class="day-panel-item-text">
                ${escapeHtml(item.title)}
            </span>
            <button
                type="button"
                class="day-panel-item-delete"
                data-action="delete-project"
                data-day="${escapeHtml(key)}"
                data-item-id="${escapeHtml(item.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `,
        () => false,
        "Bu gün için proje yok."
    );

    const tasksContainer = $("#day-panel-tasks");

    if (tasksContainer) {

        const completedTasks =
            tasks.filter(
                task => isCompletedOn(task, key)
            );

        tasksContainer.innerHTML = "";

        if (completedTasks.length === 0) {

            tasksContainer.innerHTML =
                `<div class="day-panel-empty">Bu gün tamamlanan görev yok.</div>`;

        } else {

            completedTasks.forEach(task => {

                const category =
                    getCategory(task.category);

                const item =
                    document.createElement("div");

                item.className =
                    "day-panel-item is-done";

                item.innerHTML = `
                    <span
                        class="task-row-category-dot"
                        style="background:${category.color}"
                    ></span>
                    <span class="day-panel-item-text">
                        ${escapeHtml(task.title)}
                    </span>
                `;

                tasksContainer.appendChild(item);

            });

        }

    }

    renderDayPanelMedia();

}

function renderDayPanelList(
    selector,
    items,
    template,
    isDone,
    emptyText
) {

    const container = $(selector);

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!items || items.length === 0) {

        container.innerHTML =
            `<div class="day-panel-empty">${escapeHtml(emptyText)}</div>`;

        return;

    }

    items.forEach(item => {

        const row =
            document.createElement("div");

        row.className =
            "day-panel-item" +
            (
                isDone(item)
                    ? " is-done"
                    : ""
            );

        row.innerHTML = template(item);

        container.appendChild(row);

    });

}

/* =========================================================
   GÜN PANELİ — OLAY DİNLEYİCİLERİ
   ========================================================= */

function setupDayPanel() {

    on(
        "#day-panel-today-button",
        "click",
        goToTodayInPanel
    );

    on(
        "#daily-plan-form",
        "submit",
        event => {

            event.preventDefault();

            const timeInput = $("#daily-plan-time");
            const titleInput = $("#daily-plan-title");

            addPlanItem(
                selectedDayKey || effectiveDateKey(),
                timeInput ? timeInput.value : "",
                titleInput ? titleInput.value : ""
            );

            if (titleInput) {
                titleInput.value = "";
            }

            if (timeInput) {
                timeInput.value = "";
            }

        }
    );

    on(
        "#day-notes-form",
        "submit",
        event => {

            event.preventDefault();

            const input = $("#day-note-text");

            addDailyNote(
                selectedDayKey || effectiveDateKey(),
                input ? input.value : ""
            );

            if (input) {
                input.value = "";
            }

        }
    );

    on(
        "#day-homework-form",
        "submit",
        event => {

            event.preventDefault();

            const input = $("#day-homework-title");

            addHomework(
                selectedDayKey || effectiveDateKey(),
                input ? input.value : ""
            );

            if (input) {
                input.value = "";
            }

        }
    );

    on(
        "#day-projects-form",
        "submit",
        event => {

            event.preventDefault();

            const input = $("#day-project-title");

            addProject(
                selectedDayKey || effectiveDateKey(),
                input ? input.value : ""
            );

            if (input) {
                input.value = "";
            }

        }
    );

    delegate(
        document.body,
        "click",
        "[data-action]",
        element => {

            const action = element.dataset.action;
            const day = element.dataset.day;
            const itemId = element.dataset.itemId;

            if (!day || !itemId) {
                return;
            }

            if (action === "toggle-plan") {
                togglePlanItem(day, itemId);
            } else if (action === "delete-plan") {
                deletePlanItem(day, itemId);
            } else if (action === "delete-note") {
                deleteDailyNote(day, itemId);
            } else if (action === "toggle-homework") {
                toggleHomework(day, itemId);
            } else if (action === "delete-homework") {
                deleteHomework(day, itemId);
            } else if (action === "delete-project") {
                deleteProject(day, itemId);
            }

        }
    );

}
