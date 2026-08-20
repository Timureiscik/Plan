/* =========================================================
   22-goals.js
   Hedefler (Haftalık / Aylık / Özel dönem) — ORKESTRATÖR.

   Bu dosya artık Hedefler özelliğinin veri/aktif/geçmiş/modal
   sorumluluklarını BARINDIRMIYOR — bunlar mantık DEĞİŞMEDEN
   CUT → MOVE edilerek şu dosyalara taşındı:
   - 22a-goals-data.js   (veri modeli, dönem/ilerleme hesaplama)
   - 22b-goals-active.js (aktif sekme, manuel ilerleme, arşivleme)
   - 22c-goals-history.js (geçmiş sekmesi: hesaplama/filtre/render)
   - 22d-goals-modal.js  (oluşturma/düzenleme/yeniden bağlama modalı)

   Burada yalnızca SAYFA ORKESTRASYONU kalır:
   - Tamamlama geri bildirimi (celebration) — playCompleteSound()
     (10-task-actions.js), showShortcutHint() (06-shortcuts.js)
     ve .just-completed glow (style.css) yeniden kullanılıyor.
   - renderGoalsPage() — aktif + geçmiş render'ını ve
     celebration kontrolünü tek noktadan tetikler.
   - setupGoalsPage() — tüm hedef sayfası olay dinleyicileri.

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
   - Rozetler: BADGE_DEFINITIONS + türetilmiş kazanım
     (bkz. 20-badges.js) — ayrı bir storage YOK.
   ========================================================= */

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
