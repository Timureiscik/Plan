/* =========================================================
   22-goals.js
   Hedefler (Haftalık / Aylık / Özel dönem): veri modeli,
   dönem/ilerleme hesaplama, sayfa render, oluşturma modalı,
   manuel ilerleme, bağlantı kopması, geçmiş.

   TASARIM NOTU: Bu dosya mevcut mimariye YENİ bir sistem
   yapıştırmıyor — mevcut desenleri yeniden kullanıyor:
   - Tarih hesapları: effectiveDate() / effectiveDateKey()
     (bkz. 04-day-panel.js) — paralel bir tarih mantığı YOK.
   - Kart tasarımı: .streak-item / .progress-track deseni
     (bkz. style.css, 12-stats.js).
   - Sekmeler: .media-tabs / .media-panel deseni
     (bkz. 17-media-render.js, style.css).
   - Modal: mevcut .modal / openModal() / closeModal()
     (bkz. 11-settings.js).
   - Tamamlama geri bildirimi: playCompleteSound() +
     showShortcutHint() + .just-completed glow (bkz.
     10-task-actions.js, 06-shortcuts.js).
   - Rozetler: BADGE_DEFINITIONS + türetilmiş kazanım
     (bkz. 20-badges.js) — ayrı bir storage YOK.

   `progress`, `status`, `isCompleted` HİÇBİR ZAMAN
   localStorage'a yazılmaz; her zaman tasks.completedDates /
   goal.manualLog üzerinden bu dosyadaki fonksiyonlarla
   canlı hesaplanır.
   ========================================================= */

/*
 * HEDEF — GEÇMİŞ SEKMESİ SABİTLERİ (yalnızca bu modüle özel)
 *
 * GOAL_HISTORY_MONTHS_PAGE_SIZE: "Geçmiş" sekmesi ilk
 * açıldığında kaç ay grubunun DOM'a basılacağı. Bu bir veri
 * kesme/silme değeri DEĞİLDİR — yalnızca ilk render'da
 * gösterilen miktarı sınırlar; "Daha eski ayları göster" bu
 * sayacı artırıp aynı tam veri kümesinden (bkz.
 * computeGoalHistoryRows()) yeniden render eder.
 *
 * GOAL_HISTORY_RECENT_CONTEXT_COUNT: Genel performans
 * özetindeki "Son N dönemin M'i tamamlandı" bağlam
 * cümlesinde kullanılan N.
 */
const GOAL_HISTORY_MONTHS_PAGE_SIZE = 3;
const GOAL_HISTORY_RECENT_CONTEXT_COUNT = 4;

/* =========================================================
   HEDEF — GEÇİCİ (OTURUM İÇİ) DURUM

   Bunlar kalıcı veri DEĞİLDİR — yalnızca modal akışı ve
   "son girişi geri al" / "bu dönem zaten kutlandı" gibi
   oturum içi UI durumları için kullanılır.
   ========================================================= */

let editingGoalId = null;
let goalFormMode = "create";
/* "create" | "editMinimal" | "reconnect" */

let selectedGoalSource = "linked";
let selectedGoalPeriod = "weekly";

/*
 * goalId -> { date, amount } — bir sonraki manuel eklemeye
 * kadar geçerli, yalnızca "son girişi geri al" için.
 * Sayfa yenilendiğinde sıfırlanır (kalıcı veri değildir).
 */
let goalUndoStack = {};

/*
 * goalId:periodStart anahtarlarıyla, bu oturumda zaten
 * kutlanmış hedef dönemlerini tutar — aynı tamamlanmış
 * dönem için sesi/toast'ı tekrar tekrar tetiklememek için.
 * Uygulama ilk açıldığında halihazırda tamamlanmış olan
 * dönemler "seedGoalCelebrations()" ile bu kümeye önceden
 * eklenir; böylece sayfa açılışında eski bir tamamlanma
 * için kutlama tetiklenmez — yalnızca YENİ bir tamamlanma
 * geçişinde tetiklenir.
 */
let goalCelebratedKeys = new Set();
let goalCelebrationSeeded = false;

/*
 * HEDEF — GEÇMİŞ SEKMESİ GÖRÜNÜM DURUMU (yalnızca UI)

 * goalHistoryHideMissed: true/false — hiçbir veriyi
 * silmez/değiştirmez, yalnızca listede tamamlanmamış
 * dönemlerin gizlenip gizlenmeyeceğini belirler
 * ("Gizlemek ≠ Silmek"). Geçmiş kayıtların kendisi (goals
 * dizisi, task.completedDates, goal.manualLog) bu
 * kontrolden tamamen bağımsız, olduğu gibi kalır — sayfa
 * yenilendiğinde de kaybolmaz.
 *
 * goalHistoryExpandedMonths: accordion açık/kapalı durumu.
 * Oturum içi state'tir, sayfa yenilendiğinde sıfırlanır;
 * ilk render'da en güncel ay otomatik olarak bu kümeye
 * eklenir (bkz. renderGoalHistory).
 *
 * goalHistoryVisibleMonthCount: kademeli gösterim sayacı
 * (bkz. GOAL_HISTORY_MONTHS_PAGE_SIZE) — yalnızca ilk
 * render'da kaç ay grubunun DOM'a basılacağını belirler,
 * veri kümesini asla küçültmez.
 */
let goalHistoryHideMissed = false;
let goalHistoryExpandedMonths = new Set();
let goalHistoryVisibleMonthCount = GOAL_HISTORY_MONTHS_PAGE_SIZE;

/*
 * KÖK NEDEN NOTU (mevcut ay kapanamıyor sorunu): Eskiden
 * renderGoalHistory() her çağrıldığında
 * "goalHistoryExpandedMonths.size === 0 ise en güncel ayı aç"
 * kontrolü yapılıyordu. Bu, yalnızca İLK render'da doğru
 * çalışıyordu; ama kullanıcı açık olan TEK ayı (genelde
 * varsayılan olarak açık gelen mevcut ay) kapattığında da
 * set tekrar boşalıyor ve bir SONRAKİ renderGoalHistory()
 * çağrısında aynı kontrol devreye girip o ayı anında yeniden
 * açıyordu — kullanıcıya "mevcut ay hiç kapanmıyor" gibi
 * görünüyordu. Bu bayrak, o varsayılan açma davranışının
 * yalnızca UYGULAMA ÖMRÜ BOYUNCA BİR KEZ (ilk render'da)
 * uygulanmasını sağlar; sonrasında kullanıcının açma/kapama
 * tercihine hiç müdahale edilmez — bkz. renderGoalHistory().
 */
let goalHistoryDefaultExpandApplied = false;

/* =========================================================
   HEDEF — VERİ YÜKLEME / KAYDETME
   ========================================================= */

function normalizeGoal(goal) {

    if (!goal || typeof goal !== "object") {
        return null;
    }

    const id =
        typeof goal.id === "string" && goal.id.trim()
            ? goal.id
            : createId();

    const title =
        typeof goal.title === "string" && goal.title.trim()
            ? goal.title.trim().slice(0, 60)
            : "İsimsiz hedef";

    const icon =
        typeof goal.icon === "string" && goal.icon.trim()
            ? goal.icon.trim().slice(0, 4)
            : "🎯";

    const unit =
        typeof goal.unit === "string"
            ? goal.unit.trim().slice(0, 20)
            : "";

    const target =
        Number.isFinite(goal.target) && goal.target >= 1
            ? Math.round(goal.target)
            : 1;

    const periodType =
        ["weekly", "monthly", "custom"].includes(goal.periodType)
            ? goal.periodType
            : "weekly";

    const isValidDate =
        value =>
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(value);

    const startDate =
        periodType === "custom" && isValidDate(goal.startDate)
            ? goal.startDate
            : null;

    const endDate =
        periodType === "custom" && isValidDate(goal.endDate)
            ? goal.endDate
            : null;

    const sourceMode =
        goal.source && goal.source.mode === "linked"
            ? "linked"
            : "manual";

    const source = {
        mode: sourceMode,
        taskId:
            sourceMode === "linked" &&
            goal.source &&
            typeof goal.source.taskId === "string"
                ? goal.source.taskId
                : null
    };

    const manualLog =
        Array.isArray(goal.manualLog)
            ? goal.manualLog
                .filter(
                    entry =>
                        entry &&
                        typeof entry === "object" &&
                        isValidDate(entry.date) &&
                        Number.isFinite(entry.amount) &&
                        entry.amount > 0
                )
                .map(entry => ({
                    date: entry.date,
                    amount: entry.amount
                }))
            : [];

    return {
        id,
        title,
        icon,
        unit,
        target,
        periodType,
        startDate,
        endDate,
        source,
        linkBroken: Boolean(goal.linkBroken),
        manualLog,
        createdAt:
            goal.createdAt ||
            new Date().toISOString(),
        archived: Boolean(goal.archived)
    };

}

function loadGoals() {

    try {

        const saved =
            localStorage.getItem(GOALS_KEY);

        if (!saved) {
            goals = [];
            return;
        }

        const parsed =
            JSON.parse(saved);

        goals =
            Array.isArray(parsed)
                ? parsed.map(normalizeGoal).filter(Boolean)
                : [];

    } catch (error) {

        console.error(
            "Hedefler yüklenemedi:",
            error
        );

        goals = [];

    }

}

function saveGoals() {

    try {

        localStorage.setItem(
            GOALS_KEY,
            JSON.stringify(goals)
        );

        return true;

    } catch (error) {

        console.error(
            "Hedefler kaydedilemedi:",
            error
        );

        return false;

    }

}

/* =========================================================
   HEDEF — DÖNEM (PERIOD) HESAPLAMA

   Merkezi effectiveDate()/effectiveDateKey() sistemine
   dayanır (bkz. 04-day-panel.js) — paralel bir tarih
   mantığı YOK. Hafta başlangıcı, uygulamanın geri kalanıyla
   (takvim: Pzt..Paz) aynı şekilde Pazartesi'dir.
   ========================================================= */

function getWeekBounds(date) {

    const weekday =
        (date.getDay() + 6) % 7;
    /* Pazartesi = 0 ... Pazar = 6 */

    const monday =
        addDays(date, -weekday);

    const sunday =
        addDays(monday, 6);

    return {
        start: dateKey(monday),
        end: dateKey(sunday)
    };

}

function getMonthBounds(date) {

    const first =
        new Date(
            date.getFullYear(),
            date.getMonth(),
            1
        );

    const last =
        new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
        );

    return {
        start: dateKey(first),
        end: dateKey(last)
    };

}

function getCurrentPeriodBounds(goal) {

    if (goal.periodType === "weekly") {
        return getWeekBounds(effectiveDate());
    }

    if (goal.periodType === "monthly") {
        return getMonthBounds(effectiveDate());
    }

    return {
        start: goal.startDate,
        end: goal.endDate
    };

}

function isGoalCurrentlyActive(goal) {

    if (goal.periodType === "custom") {

        return (
            typeof goal.endDate === "string" &&
            goal.endDate >= effectiveDateKey()
        );

    }

    /*
     * Weekly/monthly hedefler TEMPLATE gibi davranır —
     * her zaman "şu anki" bir dönemi vardır, bu yüzden
     * her zaman aktif kabul edilir (bkz. ONAYLANMIŞ
     * MİMARİ madde 4).
     */
    return true;

}

/* =========================================================
   HEDEF — İLERLEME HESAPLAMA
   ========================================================= */

function getGoalProgressInRange(goal, start, end) {

    if (!start || !end) {
        return 0;
    }

    if (goal.source.mode === "linked") {

        if (goal.linkBroken) {
            return 0;
        }

        const task =
            tasks.find(
                item => item.id === goal.source.taskId
            );

        if (!task) {
            return 0;
        }

        return task.completedDates.filter(
            date => date >= start && date <= end
        ).length;

    }

    return goal.manualLog
        .filter(
            entry => entry.date >= start && entry.date <= end
        )
        .reduce(
            (sum, entry) => sum + entry.amount,
            0
        );

}

function getGoalStatus(goal) {

    const bounds =
        getCurrentPeriodBounds(goal);

    const progress =
        getGoalProgressInRange(
            goal,
            bounds.start,
            bounds.end
        );

    const todayKey =
        effectiveDateKey();

    const periodEnded =
        !!bounds.end && bounds.end < todayKey;

    let status = "active";

    if (progress >= goal.target) {
        status = "completed";
    } else if (periodEnded) {
        status = "missed";
    }

    return {
        start: bounds.start,
        end: bounds.end,
        progress,
        periodEnded,
        status
    };

}

/*
 * Weekly/monthly hedefler için geçmiş N dönemi (şu anki
 * dönem HARİÇ), en yeniden en eskiye doğru üretir.
 * Custom hedeflerde geçmiş dönem kavramı yoktur (tek bir
 * sabit aralıkları vardır) — bu fonksiyon yalnızca
 * recurring hedefler için çağrılmalıdır.
 */
function getRecurringHistoryPeriods(goal, count) {

    const periods = [];

    let cursor = effectiveDate();

    for (let i = 0; i < count; i++) {

        if (goal.periodType === "weekly") {

            cursor = addDays(cursor, -7);

            const bounds = getWeekBounds(cursor);

            periods.push({
                start: bounds.start,
                end: bounds.end,
                label: formatWeekRangeLabel(bounds),
                progress: getGoalProgressInRange(
                    goal,
                    bounds.start,
                    bounds.end
                )
            });

        } else if (goal.periodType === "monthly") {

            cursor =
                new Date(
                    cursor.getFullYear(),
                    cursor.getMonth() - 1,
                    1
                );

            const bounds = getMonthBounds(cursor);

            periods.push({
                start: bounds.start,
                end: bounds.end,
                label: formatMonthRangeLabel(bounds),
                progress: getGoalProgressInRange(
                    goal,
                    bounds.start,
                    bounds.end
                )
            });

        }

    }

    return periods;

}

function getCompletedGoalPeriodsCount() {

    let count = 0;

    goals.forEach(goal => {

        const current = getGoalStatus(goal);

        if (current.status === "completed") {
            count++;
        }

        if (goal.periodType !== "custom") {

            getRecurringHistoryPeriods(
                goal,
                GOAL_HISTORY_PAGE_SIZE
            ).forEach(period => {

                if (period.progress >= goal.target) {
                    count++;
                }

            });

        }

    });

    return count;

}

/* =========================================================
   HEDEF — ETİKET/BİÇİMLENDİRME YARDIMCILARI
   ========================================================= */

function formatWeekRangeLabel(bounds) {

    const start = parseDate(bounds.start);
    const end = parseDate(bounds.end);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return "Hafta";
    }

    return (
        `${start.getDate()} ${getShortMonth(start)} - ` +
        `${end.getDate()} ${getShortMonth(end)}`
    );

}

function formatMonthRangeLabel(bounds) {

    const date = parseDate(bounds.start);

    if (Number.isNaN(date.getTime())) {
        return "Ay";
    }

    return date.toLocaleDateString(
        "tr-TR",
        {
            month: "long",
            year: "numeric"
        }
    );

}

function formatCustomRangeLabel(goal) {

    const start = parseDate(goal.startDate);
    const end = parseDate(goal.endDate);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return "Özel dönem";
    }

    return (
        `${start.getDate()} ${getShortMonth(start)} - ` +
        `${end.getDate()} ${getShortMonth(end)}`
    );

}

function formatPeriodLabel(goal, bounds) {

    if (goal.periodType === "weekly") {
        return "Bu hafta";
    }

    if (goal.periodType === "monthly") {
        return "Bu ay";
    }

    return formatCustomRangeLabel(goal);

}

function getTaskTitleSafe(taskId) {

    const task =
        tasks.find(item => item.id === taskId);

    return task ? task.title : "Silinmiş görev";

}

/* =========================================================
   HEDEF — BAĞLI GÖREV SİLİNDİĞİNDE
   ========================================================= */

function markGoalsForDeletedTask(taskId) {

    let changed = false;

    goals.forEach(goal => {

        if (
            goal.source.mode === "linked" &&
            goal.source.taskId === taskId &&
            !goal.linkBroken
        ) {

            goal.linkBroken = true;
            changed = true;

        }

    });

    if (changed) {
        saveGoals();
    }

}

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

        }
    });

}

/* =========================================================
   HEDEF — TAMAMLANMA GERİ BİLDİRİMİ

   Yeni bir animasyon/ses sistemi İCAT ETMİYORUZ — mevcut
   playCompleteSound() (10-task-actions.js), showShortcutHint()
   (06-shortcuts.js) ve .just-completed glow (style.css)
   yeniden kullanılıyor.
   ========================================================= */

function seedGoalCelebrations() {

    goals.forEach(goal => {

        const { start, status } = getGoalStatus(goal);

        if (status === "completed") {
            goalCelebratedKeys.add(`${goal.id}:${start}`);
        }

    });

    goalCelebrationSeeded = true;

}

function checkAndCelebrateGoals() {

    if (!goalCelebrationSeeded) {
        seedGoalCelebrations();
        return;
    }

    goals.forEach(goal => {

        if (goal.archived || goal.linkBroken) {
            return;
        }

        const { start, status } = getGoalStatus(goal);
        const key = `${goal.id}:${start}`;

        if (
            status === "completed" &&
            !goalCelebratedKeys.has(key)
        ) {

            goalCelebratedKeys.add(key);

            playCompleteSound();

            showShortcutHint(
                `Hedefe ulaştın! 🎯 ${goal.title}`
            );

            triggerGoalCardGlow(goal.id);

        }

    });

}

function triggerGoalCardGlow(goalId) {

    const card =
        $(`.goal-card[data-goal-id="${goalId}"]`);

    if (!card) {
        return;
    }

    card.classList.remove("just-completed");

    void card.offsetWidth;

    card.classList.add("just-completed");

    setTimeout(() => {
        card.classList.remove("just-completed");
    }, 750);

}

/* =========================================================
   HEDEF — SAYFA RENDER (AKTİF / GEÇMİŞ)
   ========================================================= */

function renderGoalsPage() {

    renderActiveGoals();
    renderGoalHistory();
    checkAndCelebrateGoals();

}

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

/* =========================================================
   HEDEF — GEÇMİŞ SEKMESİ

   Kompakt liste + aylık accordion. Veri kaynağı ve hesaplama
   mantığı ESKİSİYLE AYNI (getRecurringHistoryPeriods,
   getGoalProgressInRange, archived/custom hedefler) —
   yalnızca sunum katmanı değişti. Hiçbir satır burada
   HİÇBİR ZAMAN silinmez; kullanıcıya yalnızca bir GÖRÜNÜM
   filtresi (Tümü/Tamamlanan/Tamamlanmayan) sunulur — bkz.
   aşağıdaki "FİLTRE" bölümü. Kalıcı bir "geçmişi temizle/
   sıfırla" özelliği YOKTUR ve bilerek eklenmemiştir.
   ========================================================= */

/*
 * Tüm geçmiş satırlarını (henüz filtrelenmemiş/gruplanmamış)
 * hesaplar. Her satıra gruplama için bir `sortDate`
 * ("YYYY-MM-DD") eklenir. Bu liste her zaman TÜM geçmiş
 * kayıtları içerir — filtre/gizleme yalnızca sunum
 * aşamasında (applyGoalHistoryFilter) uygulanır, veri
 * burada hiç eksiltilmez.
 */
function computeGoalHistoryRows() {

    const rows = [];

    goals.forEach(goal => {

        if (goal.periodType === "custom") {

            const ended =
                typeof goal.endDate === "string" &&
                goal.endDate < effectiveDateKey();

            if (ended || goal.archived) {

                const progress =
                    getGoalProgressInRange(
                        goal,
                        goal.startDate,
                        goal.endDate
                    );

                rows.push({
                    goal,
                    label: formatCustomRangeLabel(goal),
                    progress,
                    completed: progress >= goal.target,
                    archived: goal.archived,
                    sortDate: goal.startDate
                });

            }

            return;

        }

        if (goal.archived) {

            const bounds =
                getCurrentPeriodBounds(goal);

            const progress =
                getGoalProgressInRange(
                    goal,
                    bounds.start,
                    bounds.end
                );

            rows.push({
                goal,
                label: formatPeriodLabel(goal, bounds),
                progress,
                completed: progress >= goal.target,
                archived: true,
                sortDate: bounds.start
            });

        }

        getRecurringHistoryPeriods(
            goal,
            GOAL_HISTORY_PAGE_SIZE
        ).forEach(period => {

            rows.push({
                goal,
                label: period.label,
                progress: period.progress,
                completed: period.progress >= goal.target,
                archived: false,
                sortDate: period.start
            });

        });

    });

    return rows.sort(
        (a, b) => b.sortDate.localeCompare(a.sortDate)
    );

}

function applyGoalHistoryFilter(rows) {

    if (goalHistoryHideMissed) {
        return rows.filter(row => row.completed);
    }

    return rows;

}

function groupGoalHistoryRowsByMonth(rows) {

    const groups = new Map();

    rows.forEach(row => {

        const monthKey = row.sortDate.slice(0, 7);

        if (!groups.has(monthKey)) {
            groups.set(monthKey, []);
        }

        groups.get(monthKey).push(row);

    });

    return Array.from(groups.keys())
        .sort((a, b) => b.localeCompare(a))
        .map(monthKey => ({
            monthKey,
            rows: groups.get(monthKey)
        }));

}

/*
 * Aynı dönemdeki (aynı sortDate + aynı etiket) birden fazla
 * hedefi TEK bir dönem grubu altında toplar; tarih aralığı
 * her satırda tekrar EDİLMEZ. `rows` parametresi zaten en
 * yeniden en eskiye sıralı geldiği için (computeGoalHistoryRows),
 * Map'in ekleme sırası bu sırayı korur — ayrı bir sıralama
 * adımına gerek yok.
 */
function groupGoalHistoryRowsByPeriod(rows) {

    const groups = [];
    const index = new Map();

    rows.forEach(row => {

        const key = `${row.sortDate}|${row.label}`;

        if (!index.has(key)) {

            const group = {
                sortDate: row.sortDate,
                label: row.label,
                rows: []
            };

            index.set(key, group);
            groups.push(group);

        }

        index.get(key).rows.push(row);

    });

    return groups;

}

/*
 * Üstteki sade "Genel Performans" özeti — TÜM (filtrelenmemiş,
 * yalnızca temizleme kesmesi uygulanmış) geçmiş satırlarına
 * göre hesaplanır; böylece kullanıcı "Tamamlanan" filtresini
 * seçse bile özet gerçek genel oranı göstermeye devam eder.
 */
function renderGoalHistorySummary(allRows) {

    const container = $("#goals-history-summary");

    if (!container) {
        return;
    }

    if (allRows.length === 0) {

        container.innerHTML = "";
        container.hidden = true;

        return;

    }

    container.hidden = false;

    const completedCount =
        allRows.filter(row => row.completed).length;

    const percent =
        Math.round(
            (completedCount / allRows.length) * 100
        );

    /*
     * "Yakın dönem" bağlamı: allRows zaten en yeniden en
     * eskiye doğru sıralı geliyor (bkz. computeGoalHistoryRows)
     * — bu yüzden ilk GOAL_HISTORY_RECENT_CONTEXT_COUNT satır
     * doğrudan "son N dönem" anlamına gelir. Yeni bir zaman
     * hesaplama sistemi İCAT EDİLMEDİ.
     */
    const recentCount =
        Math.min(
            GOAL_HISTORY_RECENT_CONTEXT_COUNT,
            allRows.length
        );

    const recentRows =
        allRows.slice(0, recentCount);

    const recentCompletedCount =
        recentRows.filter(row => row.completed).length;

    container.innerHTML = `
        <div class="goal-history-summary-main">
            <strong>
                ${completedCount} / ${allRows.length} hedef dönemi tamamlandı
            </strong>
            <span>
                Son ${recentCount} dönemin ${recentCompletedCount}'ü tamamlandı
            </span>
        </div>

        <div class="goal-history-summary-percent">
            %${percent}
        </div>
    `;

}

function renderGoalHistory() {

    const container = $("#goals-history-list");
    const loadMoreButton = $("#goals-history-load-more");

    if (!container) {
        return;
    }

    const allRows = computeGoalHistoryRows();

    renderGoalHistorySummary(allRows);

    container.innerHTML = "";

    if (allRows.length === 0) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🎯</div>
                <h3>Henüz geçmiş yok</h3>
                <p>Tamamlanan veya biten hedefler burada görünecek.</p>
            </div>
        `;

        if (loadMoreButton) {
            loadMoreButton.hidden = true;
        }

        return;

    }

    const visibleRows =
        applyGoalHistoryFilter(allRows);

    if (visibleRows.length === 0) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🎯</div>
                <h3>Bu görünümde kayıt yok</h3>
                <p>"Tamamlanmayanları gizle" seçeneğini kapatabilirsin.</p>
            </div>
        `;

        if (loadMoreButton) {
            loadMoreButton.hidden = true;
        }

        return;

    }

    const groups =
        groupGoalHistoryRowsByMonth(visibleRows);

    /*
     * İlk render'da (kullanıcı henüz hiçbir aya dokunmadıysa)
     * yalnızca en güncel ay varsayılan olarak açık gelir.
     * groups[0] her zaman görünür ilk sayfanın içinde olduğu
     * için bu, aşağıdaki kademeli gösterim sınırlamasından
     * bağımsız çalışır.
     */
    if (
        !goalHistoryDefaultExpandApplied &&
        groups.length > 0
    ) {

        goalHistoryExpandedMonths.add(groups[0].monthKey);
        goalHistoryDefaultExpandApplied = true;

    }

    /*
     * Kademeli gösterim: yalnızca ilk N ay grubu DOM'a basılır.
     * Bu bir veri silme/pagination-with-loss sistemi DEĞİLDİR —
     * tüm ay grupları `groups` içinde erişilebilir kalır;
     * "Daha eski ayları göster" yalnızca
     * goalHistoryVisibleMonthCount'u artırıp renderGoalHistory()'i
     * tekrar çağırır.
     */
    const visibleGroups =
        groups.slice(0, goalHistoryVisibleMonthCount);

    visibleGroups.forEach(group => {

        container.appendChild(
            createGoalHistoryMonthSection(group)
        );

    });

    if (loadMoreButton) {

        loadMoreButton.hidden =
            visibleGroups.length >= groups.length;

    }

}

function createGoalHistoryMonthSection(group) {

    const section =
        document.createElement("div");

    section.className = "goal-history-month";

    const expanded =
        goalHistoryExpandedMonths.has(group.monthKey);

    const completedInMonth =
        group.rows.filter(row => row.completed).length;

    const monthTitle =
        formatMonthKeyTitle(
            group.monthKey
        ).toLocaleUpperCase("tr-TR");

    section.innerHTML = `
        <button
            type="button"
            class="goal-history-month-header"
            data-action="toggle-goal-history-month"
            data-month-key="${escapeHtml(group.monthKey)}"
            aria-expanded="${expanded ? "true" : "false"}"
        >
            <span class="goal-history-month-title">
                ${escapeHtml(monthTitle)}
            </span>

            <span class="goal-history-month-count">
                ${completedInMonth}/${group.rows.length}
            </span>

            <span
                class="goal-history-month-chevron ${expanded ? "open" : ""}"
                aria-hidden="true"
            >⌄</span>
        </button>

        <div
            class="goal-history-month-body ${expanded ? "open" : ""}"
        >
            ${createGoalHistoryRowsMarkup(group.rows)}
        </div>
    `;

    return section;

}

/*
 * Bir ay içindeki satırları önce dönem bazında gruplar
 * (bkz. groupGoalHistoryRowsByPeriod), ardından her grup
 * için ya tek satırlık (eski davranış, tarih etiketi
 * satırın içinde) ya da çok-hedefli bir dönem bloğu
 * (tek bir tarih başlığı + altında hedef satırları) üretir.
 */
function createGoalHistoryRowsMarkup(rows) {

    return groupGoalHistoryRowsByPeriod(rows)
        .map(group => {

            if (group.rows.length === 1) {
                return createGoalHistoryRowHtml(group.rows[0]);
            }

            return `
                <div class="goal-history-period-group">

                    <div class="goal-history-period-label">
                        ${escapeHtml(group.label)}
                    </div>

                    ${
                        group.rows
                            .map(row => createGoalHistoryRowHtml(row, false))
                            .join("")
                    }

                </div>
            `;

        })
        .join("");

}

/*
 * Tek bir kompakt satır — büyük dikey kartların yerini alır.
 * "TAMAMLANMADI" gibi bağıran bir etiket YOK; durum yalnızca
 * küçük, nötr bir nokta ve yüzde ile gösteriliyor. showLabel
 * false olduğunda (bir dönem grubu içindeyken) tarih etiketi/
 * ayırıcı hiç yazılmaz — yalnızca hedef başlığı kalır.
 */
function createGoalHistoryRowHtml(row, showLabel = true) {

    const percent =
        row.goal.target > 0
            ? Math.min(
                100,
                Math.round(
                    (row.progress / row.goal.target) * 100
                )
            )
            : 0;

    const titleHtml =
        showLabel
            ? `
                ${escapeHtml(row.label)}
                <span class="goal-history-row-title-sep">·</span>
                ${escapeHtml(row.goal.title)}
            `
            : escapeHtml(row.goal.title);

    return `
        <div class="goal-history-row">

            <span class="goal-history-row-icon">
                ${escapeHtml(row.goal.icon || "🎯")}
            </span>

            <div class="goal-history-row-main">

                <div class="goal-history-row-title">
                    ${titleHtml}
                </div>

                <div class="goal-history-row-meta">
                    ${row.progress}/${row.goal.target}
                    ${escapeHtml(row.goal.unit)}
                    ${row.archived ? " · Arşivlendi" : ""}
                </div>

            </div>

            <div class="goal-history-row-stat">

                <span class="goal-history-row-percent">
                    %${percent}
                </span>

                <span
                    class="goal-history-row-dot ${row.completed ? "is-complete" : "is-missed"}"
                    title="${row.completed ? "Tamamlandı" : "Tamamlanmadı"}"
                ></span>

            </div>

        </div>
    `;

}

function toggleGoalHistoryMonth(monthKey) {

    if (!monthKey) {
        return;
    }

    if (goalHistoryExpandedMonths.has(monthKey)) {
        goalHistoryExpandedMonths.delete(monthKey);
    } else {
        goalHistoryExpandedMonths.add(monthKey);
    }

    renderGoalHistory();

}

/*
 * NOT: Daha önce burada "Geçmişi Temizle" (kalıcı/kesme
 * tabanlı) özelliği vardı. Kesin kural gereği KALDIRILDI —
 * geçmiş hedef kayıtları hiçbir şekilde silinmez veya
 * gizli bir kesme tarihiyle listeden düşürülmez. Kullanıcıya
 * sunulan TEK kontrol, "Tamamlanmayanları gizle" toggle'ı
 * (goalHistoryHideMissed) ile çalışan salt-görünüm
 * kontrolüdür — bkz. setupGoalsPage() içindeki
 * #goals-history-hide-missed dinleyicisi.
 */

/* =========================================================
   HEDEF — OLUŞTURMA / DÜZENLEME MODALI

   Tek bir modal, üç mod: "create" (tam sihirbaz),
   "editMinimal" (yalnızca başlık/ikon — bkz. ONAYLANMIŞ
   MİMARİ madde 6, hesaplamayı etkileyen alanlar immutable),
   "reconnect" (yalnızca görev seçimi, kopan bağlantıyı
   onarmak için).
   ========================================================= */

function renderGoalTaskSelect() {

    const select = $("#goal-task-select");

    if (!select) {
        return;
    }

    if (tasks.length === 0) {

        select.innerHTML =
            `<option value="">Önce bir görev oluştur</option>`;

    } else {

        select.innerHTML =
            tasks.map(
                task => `
                    <option value="${escapeHtml(task.id)}">
                        ${escapeHtml(task.title)}
                    </option>
                `
            ).join("");

    }

    updateGoalTaskPreview();

}

function updateGoalTaskPreview() {

    const preview = $("#goal-task-preview");
    const select = $("#goal-task-select");

    if (!preview || !select) {
        return;
    }

    const task =
        tasks.find(item => item.id === select.value);

    if (!task) {

        preview.textContent = "";
        return;

    }

    let bounds;

    if (selectedGoalPeriod === "weekly") {

        bounds = getWeekBounds(effectiveDate());

    } else if (selectedGoalPeriod === "monthly") {

        bounds = getMonthBounds(effectiveDate());

    } else {

        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        if (
            !startInput || !startInput.value ||
            !endInput || !endInput.value
        ) {

            preview.textContent = "";
            return;

        }

        bounds = {
            start: startInput.value,
            end: endInput.value
        };

    }

    const count =
        task.completedDates.filter(
            date =>
                date >= bounds.start &&
                date <= bounds.end
        ).length;

    preview.textContent =
        `Bu dönemde şu ana kadar: ${count} gün`;

}

function updateGoalSourceUI() {

    $$("#goal-source-picker .category-chip").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.source === selectedGoalSource
        );

    });

    const taskWrap = $("#goal-task-picker-wrap");

    if (taskWrap) {
        taskWrap.hidden = selectedGoalSource !== "linked";
    }

    updateGoalTaskPreview();

}

function updateGoalPeriodUI() {

    $$("#goal-period-picker .category-chip").forEach(button => {

        button.classList.toggle(
            "active",
            button.dataset.period === selectedGoalPeriod
        );

    });

    const customDates = $("#goal-custom-dates");

    if (customDates) {
        customDates.hidden = selectedGoalPeriod !== "custom";
    }

    updateGoalTaskPreview();

}

function openGoalModal(mode = "create", goal = null) {

    goalFormMode = mode;
    editingGoalId = goal ? goal.id : null;

    const titleEl = $("#goal-modal-title");
    const titleInput = $("#goal-title");
    const iconInput = $("#goal-icon-input");

    const sourceSection = $("#goal-source-section");
    const targetSection = $("#goal-target-section");
    const periodSection = $("#goal-period-section");
    const sourcePicker = $("#goal-source-picker");
    const taskWrap = $("#goal-task-picker-wrap");

    if (mode === "create") {

        if (titleEl) titleEl.textContent = "Yeni hedef";
        if (titleInput) titleInput.value = "";
        if (iconInput) iconInput.value = "";

        selectedGoalSource = "linked";
        selectedGoalPeriod = "weekly";

        if (sourceSection) sourceSection.hidden = false;
        if (targetSection) targetSection.hidden = false;
        if (periodSection) periodSection.hidden = false;
        if (sourcePicker) sourcePicker.hidden = false;

        const amountInput = $("#goal-target-amount");
        const unitInput = $("#goal-target-unit");
        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        if (amountInput) amountInput.value = "1";
        if (unitInput) unitInput.value = "";
        if (startInput) startInput.value = "";
        if (endInput) endInput.value = "";

        renderGoalTaskSelect();
        updateGoalSourceUI();
        updateGoalPeriodUI();

    } else if (mode === "editMinimal") {

        if (titleEl) titleEl.textContent = "Hedefi düzenle";
        if (titleInput) titleInput.value = goal.title;
        if (iconInput) iconInput.value = goal.icon || "";

        if (sourceSection) sourceSection.hidden = true;
        if (targetSection) targetSection.hidden = true;
        if (periodSection) periodSection.hidden = true;

    } else if (mode === "reconnect") {

        if (titleEl) titleEl.textContent = "Hedefi yeniden bağla";
        if (titleInput) titleInput.value = goal.title;
        if (iconInput) iconInput.value = goal.icon || "";

        if (sourceSection) sourceSection.hidden = false;
        if (targetSection) targetSection.hidden = true;
        if (periodSection) periodSection.hidden = true;
        if (sourcePicker) sourcePicker.hidden = true;
        if (taskWrap) taskWrap.hidden = false;

        selectedGoalSource = "linked";

        renderGoalTaskSelect();

    }

    openModal($("#goal-modal"));

    if (titleInput && mode !== "reconnect") {

        setTimeout(() => {
            titleInput.focus();
        }, 30);

    }

}

function closeGoalModal() {

    closeModal($("#goal-modal"));

    const form = $("#goal-form");

    if (form) {
        form.reset();
    }

    editingGoalId = null;
    goalFormMode = "create";
    selectedGoalSource = "linked";
    selectedGoalPeriod = "weekly";

    const sourcePicker = $("#goal-source-picker");

    if (sourcePicker) {
        sourcePicker.hidden = false;
    }

}

function handleGoalSubmit(event) {

    event.preventDefault();

    const titleInput = $("#goal-title");
    const iconInput = $("#goal-icon-input");

    const title =
        titleInput ? titleInput.value.trim() : "";

    const icon =
        iconInput ? iconInput.value.trim().slice(0, 4) : "";

    if (!title) {
        return;
    }

    if (goalFormMode === "editMinimal") {

        const goal =
            goals.find(item => item.id === editingGoalId);

        if (goal) {

            goal.title = title;
            goal.icon = icon || goal.icon;

            saveGoals();

        }

        closeGoalModal();
        renderGoalsPage();

        return;

    }

    if (goalFormMode === "reconnect") {

        const select = $("#goal-task-select");
        const goal = goals.find(item => item.id === editingGoalId);

        if (goal && select && select.value) {

            goal.source.taskId = select.value;
            goal.linkBroken = false;

            saveGoals();

        }

        closeGoalModal();
        renderGoalsPage();

        return;

    }

    /* create modu */

    const amountInput = $("#goal-target-amount");
    const unitInput = $("#goal-target-unit");

    const target =
        amountInput
            ? Math.max(1, parseInt(amountInput.value, 10) || 1)
            : 1;

    const unit =
        unitInput ? unitInput.value.trim().slice(0, 20) : "";

    if (!unit) {
        return;
    }

    const periodType = selectedGoalPeriod;

    let startDate = null;
    let endDate = null;

    if (periodType === "custom") {

        const startInput = $("#goal-start-date");
        const endInput = $("#goal-end-date");

        startDate = startInput ? startInput.value : "";
        endDate = endInput ? endInput.value : "";

        if (!startDate || !endDate || startDate > endDate) {
            return;
        }

    }

    let source = {
        mode: "manual",
        taskId: null
    };

    if (selectedGoalSource === "linked") {

        const select = $("#goal-task-select");

        if (!select || !select.value) {
            return;
        }

        source = {
            mode: "linked",
            taskId: select.value
        };

    }

    const goal = normalizeGoal({
        id: createId(),
        title,
        icon: icon || "🎯",
        unit,
        target,
        periodType,
        startDate,
        endDate,
        source,
        linkBroken: false,
        manualLog: [],
        createdAt: new Date().toISOString(),
        archived: false
    });

    goals.push(goal);

    saveGoals();

    closeGoalModal();
    renderGoalsPage();

}

/* =========================================================
   HEDEF — OLAY DİNLEYİCİLERİ
   ========================================================= */

function setupGoalsPage() {

    on(
        "#goal-add-button",
        "click",
        () => openGoalModal("create")
    );

    on("#close-goal-modal", "click", closeGoalModal);
    on("#cancel-goal", "click", closeGoalModal);
    on("#goal-form", "submit", handleGoalSubmit);

    on(
        "#goals-history-hide-missed",
        "change",
        event => {

            goalHistoryHideMissed =
                Boolean(event.target.checked);

            renderGoalHistory();

        }
    );

    on(
        "#goals-history-load-more",
        "click",
        () => {

            goalHistoryVisibleMonthCount +=
                GOAL_HISTORY_MONTHS_PAGE_SIZE;

            renderGoalHistory();

        }
    );

    delegate(
        "#goal-source-picker",
        "click",
        "[data-source]",
        element => {

            selectedGoalSource = element.dataset.source;
            updateGoalSourceUI();

        }
    );

    delegate(
        "#goal-period-picker",
        "click",
        "[data-period]",
        element => {

            selectedGoalPeriod = element.dataset.period;
            updateGoalPeriodUI();

        }
    );

    on("#goal-task-select", "change", updateGoalTaskPreview);
    on("#goal-start-date", "change", updateGoalTaskPreview);
    on("#goal-end-date", "change", updateGoalTaskPreview);

    $$(".media-tab[data-goals-tab]").forEach(tab => {

        tab.addEventListener("click", () => {

            $$(".media-tab[data-goals-tab]").forEach(button => {

                button.classList.toggle(
                    "active",
                    button === tab
                );

            });

            const activeTab = tab.dataset.goalsTab;

            const activePanel = $("#goals-active-panel");
            const historyPanel = $("#goals-history-panel");

            if (activePanel) {

                activePanel.classList.toggle(
                    "active",
                    activeTab === "active"
                );

            }

            if (historyPanel) {

                historyPanel.classList.toggle(
                    "active",
                    activeTab === "history"
                );

            }

        });

    });

    delegate(
        document.body,
        "click",
        "[data-action]",
        element => {

            const action = element.dataset.action;
            const goalId = element.dataset.goalId;

            if (action === "goal-quick-add" && goalId) {

                handleGoalQuickAdd(goalId);

            } else if (action === "goal-custom-add" && goalId) {

                handleGoalCustomAdd(goalId);

            } else if (action === "goal-undo" && goalId) {

                undoLastManualEntry(goalId);

            } else if (action === "edit-goal" && goalId) {

                const goal =
                    goals.find(item => item.id === goalId);

                if (goal) {
                    openGoalModal("editMinimal", goal);
                }

            } else if (action === "archive-goal" && goalId) {

                archiveGoal(goalId);

            } else if (action === "reconnect-goal" && goalId) {

                const goal =
                    goals.find(item => item.id === goalId);

                if (goal) {
                    openGoalModal("reconnect", goal);
                }

            } else if (action === "toggle-goal-history-month") {

                toggleGoalHistoryMonth(
                    element.dataset.monthKey
                );

            }

        }
    );

    document.addEventListener("click", event => {

        if (event.target.closest("#goal-empty-add-button")) {
            openGoalModal("create");
        }

        if (event.target === $("#goal-modal")) {
            closeGoalModal();
        }

    });

}
