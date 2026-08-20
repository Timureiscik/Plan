/* =========================================================
   22c-goals-history.js
   Hedefler — GEÇMİŞ SEKMESİ: kompakt liste + aylık accordion.
   Veri kaynağı ve hesaplama mantığı ESKİSİYLE AYNI
   (getRecurringHistoryPeriods, getGoalProgressInRange,
   archived/custom hedefler — bkz. 22a-goals-data.js).

   Bu dosya 22-goals.js'ten CUT → MOVE edilmiştir; mantık
   DEĞİŞMEMİŞTİR. Hiçbir satır burada HİÇBİR ZAMAN silinmez;
   kullanıcıya yalnızca bir GÖRÜNÜM filtresi (Tümü/Tamamlanan/
   Tamamlanmayan) sunulur.
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
   HEDEF — GEÇMİŞ SEKMESİ
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
