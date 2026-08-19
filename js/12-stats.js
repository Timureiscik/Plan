/* =========================================================
   12-stats.js
   İstatistikler, seri hesaplama, haftalık yüzde/aktivite, sağ panel istatistikleri, seriler sayfası.
   ========================================================= */

/* =========================================================
   İSTATİSTİKLER
   ========================================================= */

function getTodayCounts() {

    const key =
        effectiveDateKey();

    const total =
        tasks.length;

    const done =
        tasks.filter(
            task =>
                isCompletedOn(
                    task,
                    key
                )
        ).length;

    return {
        done,
        total
    };

}

function updateTaskCounter() {

    const counter =
        $("#task-counter");

    if (!counter) {
        return;
    }

    const {
        done,
        total
    } = getTodayCounts();

    counter.textContent =
        `${done}/${total} tamamlandı`;

}

/* =========================================================
   SERİ HESAPLAMA
   ========================================================= */

function getCurrentStreak(
    task
) {

    let cursor =
        effectiveDate();

    if (
        !task.completedDates.includes(
            dateKey(cursor)
        )
    ) {

        cursor =
            addDays(
                cursor,
                -1
            );

    }

    let streak = 0;

    while (
        task.completedDates.includes(
            dateKey(cursor)
        )
    ) {

        streak++;

        cursor =
            addDays(
                cursor,
                -1
            );

    }

    return streak;

}

function getBestStreak(
    task
) {

    if (
        task.completedDates.length === 0
    ) {
        return 0;
    }

    const sortedDates =
        [...task.completedDates]
            .map(value =>
                parseDate(value)
            )
            .filter(
                date =>
                    !Number.isNaN(
                        date.getTime()
                    )
            )
            .sort(
                (a, b) =>
                    a - b
            );

    let best = 1;
    let current = 1;

    for (
        let i = 1;
        i < sortedDates.length;
        i++
    ) {

        const diffDays =
            Math.round(
                (
                    sortedDates[i] -
                    sortedDates[i - 1]
                ) /
                86400000
            );

        if (
            diffDays === 1
        ) {

            current++;

        } else if (
            diffDays > 1
        ) {

            current = 1;

        }

        best =
            Math.max(
                best,
                current
            );

    }

    return best;

}

function getLast7DaysCount(
    task
) {

    let cursor =
        effectiveDate();

    let count = 0;

    for (
        let i = 0;
        i < 7;
        i++
    ) {

        if (
            task.completedDates.includes(
                dateKey(cursor)
            )
        ) {

            count++;

        }

        cursor =
            addDays(
                cursor,
                -1
            );

    }

    return count;

}

/* =========================================================
   HAFTALIK YÜZDE
   ========================================================= */

function getWeeklyPercent() {

    if (tasks.length === 0) {
        return 0;
    }

    let done = 0;

    tasks.forEach(task => {

        done +=
            getLast7DaysCount(task);

    });

    const possible =
        tasks.length * 7;

    if (possible === 0) {
        return 0;
    }

    return Math.round(
        (done / possible) * 100
    );

}

/* =========================================================
   HAFTALIK AKTİVİTE
   ========================================================= */

function getWeeklyActivity() {

    const days = [];

    let cursor =
        addDays(
            effectiveDate(),
            -6
        );

    for (
        let i = 0;
        i < 7;
        i++
    ) {

        const key =
            dateKey(cursor);

        const doneCount =
            tasks.filter(
                task =>
                    task.completedDates.includes(
                        key
                    )
            ).length;

        const percent =
            tasks.length === 0
                ? 0
                : Math.round(
                    (
                        doneCount /
                        tasks.length
                    ) *
                    100
                );

        const rawLabel =
            cursor.toLocaleDateString(
                "tr-TR",
                {
                    weekday: "short"
                }
            );

        const label =
            rawLabel
                .charAt(0)
                .toUpperCase() +
            rawLabel.slice(1);

        days.push({
            key,
            label,
            percent,
            isToday:
                key ===
                effectiveDateKey()
        });

        cursor =
            addDays(
                cursor,
                1
            );

    }

    return days;

}

/* =========================================================
   SAĞ PANEL / İSTATİSTİKLER
   ========================================================= */

function updateStatsAndSidebar() {

    const {
        done,
        total
    } = getTodayCounts();

    const weeklyPercent =
        getWeeklyPercent();

    let bestOverall = 0;
    let bestTask = null;
    let bestStreakValue = 0;

    tasks.forEach(task => {

        const overall =
            getBestStreak(task);

        if (
            overall > bestOverall
        ) {

            bestOverall =
                overall;

        }

        const current =
            getCurrentStreak(task);

        if (
            current >
            bestStreakValue
        ) {

            bestStreakValue =
                current;

            bestTask =
                task;

        }

    });

    setText(
        "#stat-today",
        done
    );

    setText(
        "#stat-total",
        total
    );

    setText(
        "#stat-weekly-mini",
        `${weeklyPercent}%`
    );

    setText(
        "#stat-best-mini",
        bestOverall
    );

    setText(
        "#stat-best",
        bestOverall
    );

    setText(
        "#stat-weekly",
        `${weeklyPercent}%`
    );

    setText(
        "#right-streak-value",
        bestStreakValue
    );

    setText(
        "#right-streak-task",
        bestTask
            ? bestTask.title
            : "Henüz görev yok"
    );

    const fill =
        $("#overall-progress-fill");

    if (fill) {

        fill.style.width =
            `${weeklyPercent}%`;

    }

    renderWeeklyActivityChart();

}

function setText(
    selector,
    value
) {

    const element =
        $(selector);

    if (element) {

        element.textContent =
            String(value);

    }

}

function renderWeeklyActivityChart() {

    const container =
        $("#weekly-activity-chart");

    if (!container) {
        return;
    }

    const days =
        getWeeklyActivity();

    container.innerHTML =
        days.map(
            day => `
                <div
                    class="weekly-activity-day ${
                        day.isToday
                            ? "is-today"
                            : ""
                    }"
                >

                    <div
                        class="weekly-activity-bar-track"
                    >

                        <div
                            class="weekly-activity-bar"
                            style="height:${
                                Math.max(
                                    day.percent,
                                    day.percent > 0
                                        ? 6
                                        : 0
                                )
                            }%"
                        ></div>

                    </div>

                    <span
                        class="weekly-activity-label"
                    >
                        ${escapeHtml(day.label)}
                    </span>

                </div>
            `
        ).join("");

}

/* =========================================================
   SERİLER SAYFASI
   ========================================================= */

function renderStreaks() {

    const container =
        $("#streak-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (tasks.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔥</div>
                <h3>Henüz görev yok</h3>
                <p>
                    Bir görev ekleyip
                    serini oluşturmaya başla.
                </p>
            </div>
        `;

        return;

    }

    const sorted =
        [...tasks].sort(
            (a, b) =>
                getCurrentStreak(b) -
                getCurrentStreak(a)
        );

    sorted.forEach(task => {

        const category =
            getCategory(task.category);

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "streak-item";

        item.innerHTML = `
            <div
                class="streak-item-icon"
                style="background:color-mix(in srgb, ${category.color} 20%, transparent)"
            >
                ${category.icon}
            </div>

            <div class="streak-item-info">

                <div class="streak-item-title">
                    ${escapeHtml(task.title)}
                </div>

                <div class="streak-item-sub">
                    Son 7 günde
                    ${getLast7DaysCount(task)}/7
                    •
                    En iyi seri
                    ${getBestStreak(task)}
                </div>

            </div>

            <div class="streak-item-value">

                <strong>
                    ${getCurrentStreak(task)}
                </strong>

                <span>
                    gün
                </span>

            </div>
        `;

        container.appendChild(item);

    });

}

