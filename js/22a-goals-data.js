/* =========================================================
   22a-goals-data.js
   Hedefler — VERİ KATMANI: normalize/yükle/kaydet, dönem
   (period) hesaplama, ilerleme hesaplama, etiket/biçimlendirme
   yardımcıları, bağlı görev silindiğinde işaretleme.

   Bu dosya 22-goals.js'ten CUT → MOVE edilmiştir; mantık
   DEĞİŞMEMİŞTİR. `progress` / `status` / `isCompleted`
   HİÇBİR ZAMAN localStorage'a yazılmaz; her zaman
   tasks.completedDates / goal.manualLog üzerinden bu
   dosyadaki fonksiyonlarla canlı hesaplanır.
   ========================================================= */

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
