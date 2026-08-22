/* =========================================================
   22b-goals-active.js
   Hedefler — AKTİF SEKME: manuel ilerleme (ekle/geri al),
   arşivleme, aktif hedefler listesi render.

   Bu dosya 22-goals.js'ten CUT → MOVE edilmiştir; mantık
   DEĞİŞMEMİŞTİR.
   ========================================================= */

/*
 * goalId -> { date, amount } — bir sonraki manuel eklemeye
 * kadar geçerli, yalnızca "son girişi geri al" için.
 * Sayfa yenilendiğinde sıfırlanır (kalıcı veri değildir).
 */
let goalUndoStack = {};

/* =========================================================
   HEDEF — MANUEL İLERLEME
   ========================================================= */

function addManualProgress(goalId, amount) {

    const goal =
        goals.find(item => item.id === goalId);

    if (
        !goal ||
        goal.source.mode !== "manual" ||
        !Number.isFinite(amount) ||
        amount <= 0
    ) {
        return;
    }

    const key = effectiveDateKey();

    const existing =
        goal.manualLog.find(
            entry => entry.date === key
        );

    if (existing) {
        existing.amount += amount;
    } else {

        goal.manualLog.push({
            date: key,
            amount
        });

        goal.manualLog.sort(
            (a, b) => a.date.localeCompare(b.date)
        );

    }

    goalUndoStack[goalId] = {
        date: key,
        amount
    };

    saveGoals();
    renderGoalsPage();

}

function undoLastManualEntry(goalId) {

    const last = goalUndoStack[goalId];

    if (!last) {
        return;
    }

    const goal =
        goals.find(item => item.id === goalId);

    if (!goal) {
        return;
    }

    const entry =
        goal.manualLog.find(
            item => item.date === last.date
        );

    if (entry) {

        entry.amount -= last.amount;

        if (entry.amount <= 0) {

            goal.manualLog =
                goal.manualLog.filter(
                    item => item !== entry
                );

        }

    }

    delete goalUndoStack[goalId];

    saveGoals();
    renderGoalsPage();

}

function handleGoalQuickAdd(goalId) {

    addManualProgress(goalId, 1);

}

function handleGoalCustomAdd(goalId) {

    const input =
        window.prompt(
            "Ne kadar eklemek istersin?",
            "1"
        );

    if (input === null) {
        return;
    }

    const amount =
        parseInt(input, 10);

    if (!Number.isFinite(amount) || amount <= 0) {
        return;
    }

    addManualProgress(goalId, amount);

}

/* =========================================================
   HEDEF — ARŞİVLE
   ========================================================= */

function archiveGoal(goalId) {

    const goal =
        goals.find(item => item.id === goalId);

    if (!goal) {
        return;
    }

    openConfirmModal({
        title: "Hedefi arşivle",
        message:
            `"${goal.title}" hedefini arşivlemek istediğine emin misin?`,
        confirmLabel: "Arşivle",
        danger: false,
        onConfirm: () => {

            goal.archived = true;

            saveGoals();
            renderGoalsPage();

            showShortcutHint("Hedef arşivlendi");

        }
    });

}

/* =========================================================
   HEDEF — SAYFA RENDER (AKTİF)
   ========================================================= */

function renderActiveGoals() {

    const container = $("#goals-active-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    const active =
        goals.filter(
            goal =>
                !goal.archived &&
                isGoalCurrentlyActive(goal)
        );

    if (active.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <h3>Henüz hedef yok</h3>
                <p>İlk hedefini oluşturarak başlayabilirsin.</p>
                <button
                    id="goal-empty-add-button"
                    class="primary-button"
                    type="button"
                >
                    + Yeni hedef
                </button>
            </div>
        `;

        return;

    }

    active.forEach(goal => {

        container.appendChild(
            createGoalCard(goal)
        );

    });

}

function createGoalCard(goal) {

    const card = document.createElement("div");

    card.className = "goal-card";
    card.dataset.goalId = goal.id;

    const {
        start,
        end,
        progress,
        status
    } = getGoalStatus(goal);

    const percent =
        goal.target > 0
            ? Math.min(
                100,
                Math.round((progress / goal.target) * 100)
            )
            : 0;

    const periodLabel =
        formatPeriodLabel(goal, { start, end });

    let actionsHtml = "";

    if (goal.linkBroken) {

        actionsHtml = `
            <button
                class="secondary-button"
                type="button"
                data-action="reconnect-goal"
                data-goal-id="${escapeHtml(goal.id)}"
            >
                Yeniden bağla
            </button>

            <button
                class="icon-mini-button danger"
                type="button"
                data-action="archive-goal"
                data-goal-id="${escapeHtml(goal.id)}"
                title="Arşivle"
                aria-label="Arşivle"
            >
                🗄
            </button>
        `;

    } else {

        if (goal.source.mode === "manual") {

            actionsHtml += `
                <button
                    class="secondary-button"
                    type="button"
                    data-action="goal-quick-add"
                    data-goal-id="${escapeHtml(goal.id)}"
                >
                    +1
                </button>

                <button
                    class="icon-mini-button"
                    type="button"
                    data-action="goal-custom-add"
                    data-goal-id="${escapeHtml(goal.id)}"
                    title="Miktar gir"
                    aria-label="Miktar gir"
                >
                    ±
                </button>

                <button
                    class="icon-mini-button"
                    type="button"
                    data-action="goal-undo"
                    data-goal-id="${escapeHtml(goal.id)}"
                    title="Son girişi geri al"
                    aria-label="Son girişi geri al"
                >
                    ↺
                </button>
            `;

        }

        actionsHtml += `
            <button
                class="icon-mini-button"
                type="button"
                data-action="edit-goal"
                data-goal-id="${escapeHtml(goal.id)}"
                title="Düzenle"
                aria-label="Düzenle"
            >
                ✎
            </button>

            <button
                class="icon-mini-button danger"
                type="button"
                data-action="archive-goal"
                data-goal-id="${escapeHtml(goal.id)}"
                title="Arşivle"
                aria-label="Arşivle"
            >
                🗄
            </button>
        `;

    }

    const badges = [];

    if (goal.linkBroken) {

        badges.push(
            `<div class="goal-broken-badge">⚠ Bağlantı koptu</div>`
        );

    } else {

        if (goal.source.mode === "linked") {

            badges.push(
                `<div class="goal-linked-badge">🔗 ${escapeHtml(getTaskTitleSafe(goal.source.taskId))}</div>`
            );

        }

        if (status === "completed") {

            badges.push(
                `<div class="goal-linked-badge goal-status-complete">✓ Hedefe ulaşıldı</div>`
            );

        }

    }

    const badgeHtml = badges.join("");

    card.innerHTML = `
        <div class="goal-card-top">

            <div class="goal-card-icon">
                ${escapeHtml(goal.icon || "🎯")}
            </div>

            <div class="goal-card-info">

                <div class="goal-card-title">
                    ${escapeHtml(goal.title)}
                </div>

                <div class="goal-card-meta">
                    ${escapeHtml(periodLabel)} ·
                    ${progress}/${goal.target}
                    ${escapeHtml(goal.unit)}
                </div>

            </div>

            <div class="goal-card-actions">
                ${actionsHtml}
            </div>

        </div>

        <div class="progress-track small">
            <div
                class="progress-fill"
                style="width:${percent}%"
            ></div>
        </div>

        ${badgeHtml}
    `;

    return card;

}
