/* =========================================================
   10-task-actions.js
   Görev tamamlama, tamamlama sesi, tamamlandı glow, görev modalı, görev sil, görev sırası.
   ========================================================= */

/* =========================================================
   GÖREV TAMAMLAMA

   P0 UX notu: eskiden HER tamamlamada (justCompleted) ses +
   yeşil glow tetikleniyordu — premium bir üretkenlik
   uygulaması için bu çok sık/yorucu bir geri bildirimdi
   (bkz. görev tanımı — "10 görev tamamlandı = 10 kutlama
   sesi/glow varsayılan deneyim olmamalı"). Normal bir
   tamamlama artık yalnızca SESSİZCE işaretlenir — checkbox'ın
   kendisi zaten dolu/işaretli göründüğü için ayrıca bir
   "subtle/local feedback" gerekmiyor. Ses + glow YALNIZCA
   anlamlı bir eşik geçildiğinde çalışır: bugünün TÜM
   görevleri tamamlandığında. Hedef/rozet kutlamaları (bkz.
   22-goals.js / 20-badges.js) zaten kendi eşik/seed
   mantıklarıyla AYRI ve DEĞİŞMEDEN çalışmaya devam ediyor —
   burada yalnızca görev bazlı celebration'ın tetiklenme
   sıklığı değişti, hiçbir kutlama sistemi kaldırılmadı.

   P0-1A NOTU (targeted rendering): Bu fonksiyon artık HER
   tamamlamada tüm uygulamayı (renderAll()) yeniden çizmiyor.
   Yalnızca doğrudan etkilenen UI parçaları
   refreshTaskCompletionUI() ile targeted olarak güncelleniyor
   (bkz. o fonksiyonun üst yorumu — kapsam BİLEREK Goals/
   Badges/Calendar/Day Panel/Streak sıralamasını KAPSAMIYOR;
   bunlar bir sonraki tam renderAll() tetiklendiğinde
   [örn. sayfa değişince, görev eklenince/silinince] güncel
   hale gelmeye devam ediyor). State mutation/persistence
   davranışı (saveData()) ve ses/glow eşiği HİÇ DEĞİŞMEDİ.
   ========================================================= */

function toggleCompleteToday(taskId) {

    const task =
        tasks.find(
            item =>
                item.id === taskId
        );

    if (!task) {
        return;
    }

    const key =
        effectiveDateKey();

    const index =
        task.completedDates.indexOf(key);

    let justCompleted = false;

    if (index >= 0) {

        task.completedDates.splice(
            index,
            1
        );

    } else {

        task.completedDates.push(
            key
        );

        justCompleted = true;

    }

    saveData();

    refreshTaskCompletionUI(taskId);

    if (justCompleted) {

        /*
         * "Bugünün tüm görevleri tamamlandı" — tek anlamlı
         * eşik burada kontrol ediliyor. getTodayCounts()
         * zaten mevcut (bkz. 12-stats.js); yeni bir sayaç
         * İCAT EDİLMEDİ.
         */
        const { done, total } = getTodayCounts();

        const allTasksDoneToday =
            total > 0 && done === total;

        if (allTasksDoneToday) {

            playCompleteSound();

            triggerGlow(taskId);

            showShortcutHint(
                "Bugünün tüm görevlerini tamamladın! 🎉"
            );

        }

    }

}

/* =========================================================
   GÖREV TAMAMLAMA — TARGETED UI REFRESH (P0-1A)

   toggleCompleteToday() sonrası eskiden çağrılan renderAll()
   (tüm uygulamayı sıfırdan yeniden çizen global fonksiyon)
   yerine geçer. Yeni bir "paralel stats/render sistemi"
   İCAT EDİLMEDİ — burada listelenen her adım zaten var olan,
   kendi başına tek bir DOM bölgesini güncelleyen mevcut
   fonksiyonları (updateTaskCounter, renderDailySummary,
   updateStatsAndSidebar — bkz. 12-stats.js / 21-daily-
   summary.js) ya da bu değişiklikte eklenen, aynı şekilde
   tek bir görev satırı/kartıyla sınırlı yeni yardımcıları
   (updateTaskRowUI — 07-home.js, updateTaskCardUI —
   08-tasks.js) çağırıyor.

   BİLİNÇLİ KAPSAM DIŞI (P0-1A):
   - Goals (renderGoalsPage/renderActiveGoals) — bu task'a
     `linked` bir hedef olsa bile burada GÜNCELLENMİYOR.
   - Badges (renderBadges) — toplam tamamlama sayısı/streak
     eşiği değişmiş olsa bile burada GÜNCELLENMİYOR.
   - Calendar (renderCalendar) — bugünün hücresindeki görev
     noktası (.dot.task) burada GÜNCELLENMİYOR.
   - Day Panel (renderDayPanel) — seçili gün bugünse bile
     "o gün tamamlanan görevler" listesi burada
     GÜNCELLENMİYOR.
   - Streak listesi yeniden SIRALAMA (renderStreaks tamamen
     atlanıyor) — Streaks sayfası burada hiç dokunulmuyor.

   Bu ekranlar, bir sonraki tam renderAll() tetiklendiğinde
   (sayfa değişimi, görev ekleme/silme/taşıma, ayar kaydetme
   vb. — bkz. mevcut renderAll() call-site'ları) güncel hale
   gelmeye devam ediyor. Bu, P0-1A'nın kasıtlı ve onaylanmış
   kapsam sınırıdır; sonraki bir P0 maddesinde genişletilebilir.
   ========================================================= */

function refreshTaskCompletionUI(taskId) {

    updateTaskRowUI(taskId);
    updateTaskCardUI(taskId);

    updateTaskCounter();
    renderDailySummary();
    updateStatsAndSidebar();

}

/* =========================================================
   TAMAMLAMA SESİ
   ========================================================= */

function playCompleteSound() {

    if (!settings.soundEnabled) {
        return;
    }

    try {

        audioCtx =
            audioCtx ||
            new (
                window.AudioContext ||
                window.webkitAudioContext
            )();

        const ctx =
            audioCtx;

        const now =
            ctx.currentTime;

        const osc =
            ctx.createOscillator();

        const gain =
            ctx.createGain();

        osc.type = "sine";

        osc.frequency.setValueAtTime(
            660,
            now
        );

        osc.frequency.exponentialRampToValueAtTime(
            990,
            now + 0.09
        );

        gain.gain.setValueAtTime(
            0.0001,
            now
        );

        gain.gain.exponentialRampToValueAtTime(
            0.18,
            now + 0.012
        );

        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.28
        );

        osc
            .connect(gain)
            .connect(ctx.destination);

        osc.start(now);

        osc.stop(
            now + 0.3
        );

    } catch (error) {

        console.warn(
            "Ses çalınamadı:",
            error
        );

    }

}

/* =========================================================
   TAMAMLANDI GLOW
   ========================================================= */

function triggerGlow(taskId) {

    $$(
        "[data-task-id]"
    ).forEach(element => {

        if (
            element.dataset.taskId !==
            String(taskId)
        ) {
            return;
        }

        if (
            !element.classList.contains(
                "task-row"
            ) &&
            !element.classList.contains(
                "task-card"
            )
        ) {
            return;
        }

        element.classList.remove(
            "just-completed"
        );

        void element.offsetWidth;

        element.classList.add(
            "just-completed"
        );

        setTimeout(
            () => {

                element.classList.remove(
                    "just-completed"
                );

            },
            750
        );

    });

}

/* =========================================================
   GÖREV MODALI
   ========================================================= */

function openTaskModal(
    task = null
) {

    editingTaskId =
        task
            ? task.id
            : null;

    selectedCategory =
        task
            ? task.category
            : DEFAULT_CATEGORY;

    const modalTitle =
        $("#task-modal-title");

    const titleInput =
        $("#task-title");

    const descInput =
        $("#task-description");

    if (modalTitle) {

        modalTitle.textContent =
            task
                ? "Görevi düzenle"
                : "Yeni görev";

    }

    if (titleInput) {

        titleInput.value =
            task
                ? task.title
                : "";

    }

    if (descInput) {

        descInput.value =
            task
                ? task.description
                : "";

    }

    renderCategoryPicker();

    openModal(
        $("#task-modal")
    );

    if (titleInput) {

        setTimeout(
            () => {
                titleInput.focus();
            },
            30
        );

    }

}

function closeTaskModal() {

    closeModal(
        $("#task-modal")
    );

    const form =
        $("#task-form");

    if (form) {
        form.reset();
    }

    editingTaskId = null;

    selectedCategory =
        DEFAULT_CATEGORY;

}

function handleTaskSubmit(
    event
) {

    event.preventDefault();

    const titleInput =
        $("#task-title");

    const descInput =
        $("#task-description");

    const title =
        titleInput
            ? titleInput.value.trim()
            : "";

    const description =
        descInput
            ? descInput.value.trim()
            : "";

    if (!title) {
        return;
    }

    /*
     * closeTaskModal() editingTaskId'yi sıfırladığı için,
     * toast metnini seçmek üzere (ekleme mi düzenleme mi)
     * bu bilgiyi kaydetme/kapatma adımlarından ÖNCE, geçici
     * bir değişkende saklıyoruz.
     */
    const wasEditing =
        Boolean(editingTaskId);

    if (editingTaskId) {

        const task =
            tasks.find(
                item =>
                    item.id ===
                    editingTaskId
            );

        if (task) {

            task.title =
                title;

            task.description =
                description;

            task.category =
                selectedCategory;

        }

    } else {

        tasks.push(
            normalizeTask({
                id: createId(),
                title,
                description,
                category:
                    selectedCategory,
                completedDates: [],
                createdAt:
                    new Date().toISOString()
            })
        );

    }

    saveData();

    closeTaskModal();

    renderAll();

    showShortcutHint(
        wasEditing
            ? "Görev güncellendi"
            : "Görev eklendi"
    );

}

/* =========================================================
   GÖREV SİL
   ========================================================= */

function deleteTask(taskId) {

    const task =
        tasks.find(
            item =>
                item.id === taskId
        );

    if (!task) {
        return;
    }

    openConfirmModal({
        title: "Görevi sil",
        message:
            `"${task.title}" görevini silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => {

            tasks =
                tasks.filter(
                    item =>
                        item.id !== taskId
                );

            saveData();

            /*
             * Bu göreve bağlı (linked) hedefler varsa, hedef
             * sessizce manuel moda GEÇİRİLMEZ — yalnızca
             * linkBroken=true işaretlenir ve kullanıcıya
             * "Bağlantı koptu" uyarısıyla gösterilir (bkz.
             * 22-goals.js — ONAYLANMIŞ MİMARİ madde 8).
             */
            markGoalsForDeletedTask(taskId);

            renderAll();

            showShortcutHint("Görev silindi");

        }
    });

}

/* =========================================================
   GÖREV SIRASI
   ========================================================= */

function moveTask(
    taskId,
    direction
) {

    const index =
        tasks.findIndex(
            task =>
                task.id === taskId
        );

    if (index === -1) {
        return;
    }

    const targetIndex =
        index + direction;

    if (
        targetIndex < 0 ||
        targetIndex >= tasks.length
    ) {
        return;
    }

    const [task] =
        tasks.splice(
            index,
            1
        );

    tasks.splice(
        targetIndex,
        0,
        task
    );

    saveData();

    renderAll();

}
