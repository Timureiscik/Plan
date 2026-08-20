/* =========================================================
   20-badges.js
   Başarı rozetleri: kazanım hesaplama ve render.

   Rozetler HANGİ rozetin kazanılmış olduğu açısından hâlâ
   tamamen türetilmiş (derived) veridir — bu, ayrı bir
   localStorage anahtarı GEREKTİRMEZ ve DEĞİŞMEDİ. Her
   renderBadges() çağrısında mevcut tasks / dailyData /
   mediaMetaList / goals üzerinden yeniden hesaplanır (bkz.
   getEarnedBadgeIds() — BADGE_DEFINITIONS için 01-constants.js).

   TEK EKLENEN MİNİMAL VERİ: bir rozetin NE ZAMAN kazanıldığı.
   Bu bilgi mevcut veri modelinden güvenilir şekilde türetilemez
   (örn. "kategori-ustasi" rozetinin tam olarak hangi tamamlama
   anında eşiği geçtiği geriye dönük hesaplanamaz). Bu yüzden,
   yalnızca "Seriler ekranında son kazanılan rozetleri öne
   çıkar" ihtiyacı için, küçük ve ayrı bir zaman damgası
   deposu (BADGE_EARNED_KEY) eklendi. Bu depo rozetin kazanılıp
   kazanılmadığı sorusuna KARIŞMAZ — yalnızca sıralama/önizleme
   amaçlı "ne zaman" bilgisini tutar (bkz. syncBadgeEarnedTimestamps).
   ========================================================= */

/*
 * Rozet kazanılma zamanı deposu. Yalnızca "son kazanılanlar"
 * önizlemesinin doğru sırada gösterilebilmesi için var —
 * kazanım mantığının kendisini ETKİLEMEZ.
 */
const BADGE_EARNED_KEY = "habitus_badge_earned_v1";

/*
 * Seriler ekranındaki kompakt özet şeridinde gösterilecek
 * en fazla rozet sayısı. Bilinçli olarak küçük tutuluyor —
 * amaç "son başarıları hatırlatmak", koleksiyonun tamamını
 * sergilemek değil (bkz. görev tanımı).
 */
const BADGE_RECENT_PREVIEW_COUNT = 4;

/* goalId... değil, badgeId -> ISO zaman damgası */
let badgeEarnedAt = {};

/*
 * Tam koleksiyon (kazanılmış + kilitli) alanının açık/kapalı
 * durumu. Oturum içi UI state'idir, kalıcı değildir — Hedefler
 * → Geçmiş sekmesindeki ay accordion'larıyla aynı desende
 * (bkz. goalHistoryExpandedMonths — 22-goals.js).
 */
let badgesFullCollectionOpen = false;

/*
 * ROZET KAZANIM KUTLAMASI — oturum içi durum.
 * Mevcut goal celebration deseniyle (bkz. goalCelebratedKeys /
 * goalCelebrationSeeded — 22-goals.js) BİREBİR AYNI mantık:
 * uygulama ilk açıldığında halihazırda kazanılmış olan
 * rozetler "seedBadgeCelebrations()" ile bu kümeye önceden
 * eklenir (eski bir kazanım için kutlama tetiklenmesin diye);
 * yalnızca bundan SONRA yeni kazanılan bir rozet kutlanır.
 */
let badgeCelebratedIds = new Set();
let badgeCelebrationSeeded = false;

/* =========================================================
   ROZET KAZANILMA ZAMANLARI — YÜKLE / KAYDET
   ========================================================= */

function loadBadgeEarnedAt() {

    try {

        const saved =
            localStorage.getItem(BADGE_EARNED_KEY);

        if (!saved) {
            badgeEarnedAt = {};
            return;
        }

        const parsed = JSON.parse(saved);

        badgeEarnedAt =
            parsed && typeof parsed === "object"
                ? parsed
                : {};

    } catch (error) {

        console.error(
            "Rozet kazanılma zamanları yüklenemedi:",
            error
        );

        badgeEarnedAt = {};

    }

}

function saveBadgeEarnedAt() {

    try {

        localStorage.setItem(
            BADGE_EARNED_KEY,
            JSON.stringify(badgeEarnedAt)
        );

        return true;

    } catch (error) {

        console.error(
            "Rozet kazanılma zamanları kaydedilemedi:",
            error
        );

        return false;

    }

}

/*
 * O an kazanılmış olan ama henüz bir zaman damgası
 * kaydedilmemiş rozetler için "şimdi"yi kaydeder.
 *
 * Bu özellik ilk kez devreye girdiğinde, halihazırda
 * kazanılmış olan rozetler geriye dönük gerçek tarihleri
 * bilinmediği için tek seferde aynı anda damgalanır — bu,
 * mevcut projede goal celebration "seedleme" mantığıyla
 * (bkz. seedGoalCelebrations — 22-goals.js) aynı dürüst
 * yaklaşımdır: geçmişi olduğundan farklı göstermek yerine,
 * yalnızca BUNDAN SONRA gerçekten yeni kazanılan rozetler
 * doğru zaman damgasını alır ve "son kazanılanlar"
 * önizlemesinde bu ilk toplu kayıtların önüne geçer.
 */
function syncBadgeEarnedTimestamps(earnedIds) {

    let changed = false;

    const now = new Date().toISOString();

    earnedIds.forEach(id => {

        if (!badgeEarnedAt[id]) {

            badgeEarnedAt[id] = now;
            changed = true;

        }

    });

    if (changed) {
        saveBadgeEarnedAt();
    }

}

function getRecentlyEarnedBadges(earnedIds) {

    return BADGE_DEFINITIONS
        .filter(badge => earnedIds.has(badge.id))
        .sort((a, b) => {

            const aTime = badgeEarnedAt[a.id] || "";
            const bTime = badgeEarnedAt[b.id] || "";

            return bTime.localeCompare(aTime);

        })
        .slice(0, BADGE_RECENT_PREVIEW_COUNT);

}

/* =========================================================
   ROZET KAZANIM KUTLAMASI

   Yeni bir animasyon/ses/toast sistemi İCAT EDİLMİYOR —
   goal celebration'da zaten kurulmuş olan
   playCompleteSound() (10-task-actions.js) ve
   showShortcutHint() (06-shortcuts.js) aynen yeniden
   kullanılıyor (bkz. checkAndCelebrateGoals — 22-goals.js,
   birebir aynı desen).
   ========================================================= */

function seedBadgeCelebrations(earnedIds) {

    earnedIds.forEach(id => {
        badgeCelebratedIds.add(id);
    });

    badgeCelebrationSeeded = true;

}

function checkAndCelebrateBadges(earnedIds) {

    if (!badgeCelebrationSeeded) {

        seedBadgeCelebrations(earnedIds);

        return;

    }

    earnedIds.forEach(id => {

        if (badgeCelebratedIds.has(id)) {
            return;
        }

        badgeCelebratedIds.add(id);

        const badge =
            BADGE_DEFINITIONS.find(
                item => item.id === id
            );

        if (!badge) {
            return;
        }

        playCompleteSound();

        showShortcutHint(
            `Yeni rozet kazandın! ${badge.icon} ${badge.name}`
        );

    });

}

/* =========================================================
   ROZETLER — YARDIMCI HESAPLAMALAR
   ========================================================= */

function getTotalCompletions() {

    return tasks.reduce(
        (sum, task) => sum + task.completedDates.length,
        0
    );

}

function getMaxBestStreak() {

    return tasks.reduce(
        (max, task) => Math.max(max, getBestStreak(task)),
        0
    );

}

function getMaxCurrentStreak() {

    return tasks.reduce(
        (max, task) => Math.max(max, getCurrentStreak(task)),
        0
    );

}

function getCategoryCompletionTotals() {

    const totals = {};

    tasks.forEach(task => {

        totals[task.category] =
            (totals[task.category] || 0) +
            task.completedDates.length;

    });

    return totals;

}

function getTotalDailyNotes() {

    return Object.values(dailyData.entries).reduce(
        (sum, entry) =>
            sum + (entry.notes ? entry.notes.length : 0),
        0
    );

}

function hasPerfectWeek() {

    if (tasks.length === 0) {
        return false;
    }

    return getWeeklyPercent() === 100;

}

function hasMediaOfType(type) {

    return mediaMetaList.some(item => item.type === type);

}

/* =========================================================
   ROZETLER — KAZANIM HESAPLAMA

   mediaMetaList IndexedDB'den asenkron yüklendiği için
   (bkz. loadMediaIndex — 02-init.js), medya bazlı rozetler
   ilk karede henüz kazanılmamış görünebilir; medya yüklenir
   yüklenmez zaten renderMediaPage()/renderDayPanelMedia()
   çağrısının yanında renderBadges() de tekrar çalıştırılır
   (bkz. aşağıdaki setupBadgesMediaRefresh).
   ========================================================= */

function getEarnedBadgeIds() {

    const earned = new Set();

    const totalCompletions = getTotalCompletions();
    const maxBestStreak = getMaxBestStreak();
    const categoryTotals = getCategoryCompletionTotals();

    if (totalCompletions >= 1) {
        earned.add("ilk-adim");
    }

    if (maxBestStreak >= 3) {
        earned.add("seri-3");
    }

    if (maxBestStreak >= 7) {
        earned.add("seri-7");
    }

    if (maxBestStreak >= 30) {
        earned.add("seri-30");
    }

    if (maxBestStreak >= 100) {
        earned.add("seri-100");
    }

    if (totalCompletions >= 10) {
        earned.add("tamamlama-10");
    }

    if (totalCompletions >= 50) {
        earned.add("tamamlama-50");
    }

    if (totalCompletions >= 200) {
        earned.add("tamamlama-200");
    }

    if (hasPerfectWeek()) {
        earned.add("mukemmel-hafta");
    }

    if (
        Object.values(categoryTotals).some(
            total => total >= 15
        )
    ) {
        earned.add("kategori-ustasi");
    }

    if (tasks.length >= 10) {
        earned.add("cok-gorevli");
    }

    if (getTotalDailyNotes() >= 10) {
        earned.add("not-tutkunu");
    }

    if (hasMediaOfType("photo")) {
        earned.add("ilk-fotograf");
    }

    if (hasMediaOfType("audio")) {
        earned.add("ilk-ses");
    }

    /*
     * Hedef rozetleri de diğerleri gibi tamamen türetilmiş:
     * ayrı bir "tamamlanma sayacı" saklanmıyor, mevcut
     * (current + geçmiş dönem) hedef durumlarından her
     * seferinde yeniden hesaplanıyor (bkz. 22-goals.js).
     */
    const completedGoalPeriods = getCompletedGoalPeriodsCount();

    if (completedGoalPeriods >= 1) {
        earned.add("ilk-hedef");
    }

    if (completedGoalPeriods >= 5) {
        earned.add("hedef-5");
    }

    return earned;

}

/* =========================================================
   ROZETLER — RENDER (KOMPAKT ÖZET)

   Seriler ekranının ana odağı seriler olduğu için, varsayılan
   görünümde rozetler yalnızca bir sayaç + son kazanılan en
   fazla BADGE_RECENT_PREVIEW_COUNT rozetin küçük ikon
   önizlemesi olarak gösterilir. İsim/açıklama metni burada
   YOK — yalnızca hover/uzun basma ile görünen title tooltip'i
   var (bkz. mevcut .icon-mini-button title kullanım deseni).
   ========================================================= */

function renderBadgesCompactSummary(earnedIds) {

    const countEl = $("#badge-earned-count");

    if (countEl) {

        countEl.textContent =
            `${earnedIds.size}/${BADGE_DEFINITIONS.length} kazanıldı`;

    }

    const stripEl = $("#badges-recent-strip");

    if (!stripEl) {
        return;
    }

    const recent = getRecentlyEarnedBadges(earnedIds);

    if (recent.length === 0) {

        stripEl.innerHTML = `
            <div class="badges-recent-empty">
                Henüz rozet kazanılmadı. İlk rozetini kazandığında
                burada görünecek.
            </div>
        `;

        return;

    }

    stripEl.innerHTML =
        recent.map(badge => `
            <div
                class="badge-recent-item"
                title="${escapeHtml(badge.name)} — ${escapeHtml(badge.description)}"
            >
                <span class="badge-recent-item-icon">${badge.icon}</span>
            </div>
        `).join("");

}

/* =========================================================
   ROZETLER — RENDER (TAM KOLEKSİYON)

   Yalnızca kullanıcı "Tüm rozetleri gör" ile açtığında
   görünür hale gelir. Kazanılmış ve kilitli rozetler burada
   BİLEREK farklı bileşen dilleriyle gösteriliyor — yalnızca
   opacity farkı DEĞİL, gerçek bir bilgi yoğunluğu farkı:
   - Kazanılmışlar: mevcut .badge-item kartı (ikon + isim +
     açıklama), zaten kazanılmış bir şeyin vitrin muamelesi
     görmesi için.
   - Kilitliler: mevcut .category-chip deseninden türetilen
     kompakt .badge-chip (yalnızca ikon + isim); açıklama
     metni sürekli görünmez, yalnızca title tooltip'inde durur.
   ========================================================= */

function renderBadgesFullCollection(earnedIds) {

    const earnedContainer = $("#badge-grid-earned");
    const lockedContainer = $("#badge-grid-locked");

    if (earnedContainer) {

        const earnedBadges =
            BADGE_DEFINITIONS.filter(
                badge => earnedIds.has(badge.id)
            );

        if (earnedBadges.length === 0) {

            earnedContainer.innerHTML =
                `<div class="badges-empty-note">Henüz kazanılmış rozet yok.</div>`;

        } else {

            earnedContainer.innerHTML =
                earnedBadges.map(badge => `
                    <div
                        class="badge-item is-earned"
                        title="${escapeHtml(badge.description)}"
                    >
                        <span class="badge-item-icon">
                            ${badge.icon}
                        </span>

                        <span class="badge-item-name">
                            ${escapeHtml(badge.name)}
                        </span>

                        <span class="badge-item-desc">
                            ${escapeHtml(badge.description)}
                        </span>
                    </div>
                `).join("");

        }

    }

    if (lockedContainer) {

        const lockedBadges =
            BADGE_DEFINITIONS.filter(
                badge => !earnedIds.has(badge.id)
            );

        if (lockedBadges.length === 0) {

            lockedContainer.innerHTML =
                `<div class="badges-empty-note">Tüm rozetler kazanıldı 🎉</div>`;

        } else {

            lockedContainer.innerHTML =
                lockedBadges.map(badge => `
                    <div
                        class="badge-chip"
                        title="${escapeHtml(badge.name)} — ${escapeHtml(badge.description)}"
                    >
                        <span class="badge-chip-icon">🔒</span>
                        <span>${escapeHtml(badge.name)}</span>
                    </div>
                `).join("");

        }

    }

}

/* =========================================================
   ROZETLER — TAM KOLEKSİYON AÇ/KAPA

   Yeni bir interaction pattern İCAT EDİLMEDİ — Hedefler →
   Geçmiş sekmesindeki ay accordion'larıyla aynı temel mantık
   (max-height geçişi + "open" class + aria-expanded) burada
   tek bir bölüm için kullanılıyor.
   ========================================================= */

function applyBadgesFullCollectionState() {

    const container = $("#badges-full-collection");
    const button = $("#badges-toggle-all");

    if (container) {

        container.classList.toggle(
            "open",
            badgesFullCollectionOpen
        );

    }

    if (button) {

        button.textContent =
            badgesFullCollectionOpen
                ? "Rozetleri gizle"
                : "Tüm rozetleri gör";

        button.setAttribute(
            "aria-expanded",
            badgesFullCollectionOpen ? "true" : "false"
        );

    }

}

function toggleBadgesFullCollection() {

    badgesFullCollectionOpen = !badgesFullCollectionOpen;

    applyBadgesFullCollectionState();

}

function setupBadgesToggle() {

    on(
        "#badges-toggle-all",
        "click",
        toggleBadgesFullCollection
    );

}

/* =========================================================
   ROZETLER — RENDER (GİRİŞ NOKTASI)
   ========================================================= */

/* =========================================================
   ROZETLER — RENDER (#badge-grid)

   KÖK NEDEN NOTU: renderBadgesCompactSummary() /
   renderBadgesFullCollection() daha önce yapılmış, YARIM
   KALMIŞ bir arayüz yeniden tasarımına ait — #badges-recent-strip,
   #badge-grid-earned, #badge-grid-locked ve #badges-toggle-all
   selector'ları Plan.html'de VE style.css'te hiç mevcut değil
   (setupBadgesToggle() da 02-init.js'ten hiç çağrılmıyor).
   Bu yüzden $() bu elementler için hep null döner, ilgili
   if (container) blokları sessizce hiçbir şey yapmadan çıkar
   ve #badge-grid (Plan.html'deki GERÇEK kapsayıcı) hiçbir
   zaman doldurulmaz — yalnızca #badge-earned-count güncellenir
   (bu yüzden "başlık/sayaç var, kartlar yok" görünümü oluşuyordu).

   Yeni bir HTML/CSS bileşeni İCAT ETMEDEN, mevcut #badge-grid
   ve zaten var olan .badge-item / .is-earned / .is-locked
   CSS sınıflarını kullanarak asıl render burada yapılıyor.
   renderBadgesCompactSummary/renderBadgesFullCollection ve
   ilgili toggle fonksiyonları hâlâ tanımlı bırakıldı (zararsız,
   hiçbir DOM elementi bulamadıkları için no-op) — kullanılmayan
   kod silinerek gereksiz bir refactor yapılmadı.
   ========================================================= */

function renderBadgeGrid(earnedIds) {

    const grid = $("#badge-grid");

    if (!grid) {
        return;
    }

    /*
     * PROGRESSIVE REVEAL (bkz. görev tanımı — "kazanılmamış
     * → gizli, kazanılmış → görünür"): kazanılmamış rozetler
     * #badge-grid'e HİÇ BASILMAZ; yalnızca opacity ile
     * soluklaştırılmış "kilitli kart" göstermek bu kuralı
     * ihlal eder (önceki hatalı davranış buydu). earnedIds
     * zaten getEarnedBadgeIds() ile doğru şekilde türetiliyor
     * — burada yalnızca render'a giren kümeyi filtreliyoruz;
     * kazanım mantığına dokunulmuyor.
     */
    const earnedBadges =
        BADGE_DEFINITIONS.filter(
            badge => earnedIds.has(badge.id)
        );

    if (earnedBadges.length === 0) {

        grid.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🏅</div>
                <h3>Henüz rozet yok</h3>
                <p>Görevlerini tamamladıkça rozetler burada görünmeye başlayacak.</p>
            </div>
        `;

        return;

    }

    grid.innerHTML =
        earnedBadges.map(badge => `
            <div class="badge-item is-earned">
                <span class="badge-item-icon">
                    ${badge.icon}
                </span>

                <span class="badge-item-name">
                    ${escapeHtml(badge.name)}
                </span>

                <span class="badge-item-desc">
                    ${escapeHtml(badge.description)}
                </span>
            </div>
        `).join("");

}

function renderBadges() {

    const earnedIds = getEarnedBadgeIds();

    syncBadgeEarnedTimestamps(earnedIds);
    checkAndCelebrateBadges(earnedIds);

    renderBadgesCompactSummary(earnedIds);
    renderBadgeGrid(earnedIds);

}
