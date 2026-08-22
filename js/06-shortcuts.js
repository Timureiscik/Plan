/* =========================================================
   06-shortcuts.js
   Klavye kısayolları.
   ========================================================= */

/* =========================================================
   KLAVYE KISAYOLLARI
   ========================================================= */

function setupKeyboardShortcuts() {

    document.addEventListener(
        "keydown",
        event => {

            const tag =
                (
                    event.target.tagName ||
                    ""
                ).toLowerCase();

            const isTyping =
                tag === "input" ||
                tag === "textarea" ||
                tag === "select";

            const modalOpen =
                $(".modal.open") !== null;

            if (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() === "n"
            ) {

                event.preventDefault();

                if (!modalOpen) {

                    openTaskModal();

                    showShortcutHint(
                        "Yeni görev — Ctrl+N"
                    );

                }

                return;

            }

            if (
                event.key === "Escape"
            ) {

                closeTaskModal();
                closeSettingsModal();
                closeGoalModal();
                closeConfirmModal();

                return;

            }

            if (
                isTyping ||
                modalOpen
            ) {

                return;

            }

            if (
                currentPage === "tasks"
            ) {

                const cards =
                    $$(".task-card");

                if (!cards.length) {
                    return;
                }

                if (
                    event.key === "ArrowDown"
                ) {

                    event.preventDefault();

                    focusedTaskIndex =
                        focusedTaskIndex < 0
                            ? 0
                            : Math.min(
                                cards.length - 1,
                                focusedTaskIndex + 1
                            );

                    focusTaskCard(cards);

                } else if (
                    event.key === "ArrowUp"
                ) {

                    event.preventDefault();

                    focusedTaskIndex =
                        focusedTaskIndex < 0
                            ? 0
                            : Math.max(
                                0,
                                focusedTaskIndex - 1
                            );

                    focusTaskCard(cards);

                } else if (
                    event.key === " " &&
                    focusedTaskIndex >= 0 &&
                    cards[focusedTaskIndex]
                ) {

                    event.preventDefault();

                    toggleCompleteToday(
                        cards[
                            focusedTaskIndex
                        ].dataset.taskId
                    );

                }

            }

        }
    );

}

function focusTaskCard(cards) {

    cards.forEach(card => {

        card.classList.remove(
            "kbd-focused"
        );

    });

    const target =
        cards[focusedTaskIndex];

    if (!target) {
        return;
    }

    target.classList.add(
        "kbd-focused"
    );

    target.scrollIntoView({
        block: "nearest",
        behavior: "smooth"
    });

    target.focus({
        preventScroll: true
    });

}

/* =========================================================
   TOAST / KISAYOL İPUCU SİSTEMİ

   showShortcutHint() PROJE GENELİNDEKİ TEK bildirim giriş
   noktasıdır — hem klavye kısayolu ipuçları (örn. "Yeni
   görev — Ctrl+N") hem de genel toast bildirimleri (görev
   eklendi/güncellendi/silindi, hedef/rozet kutlamaları,
   kaydetme hataları vb. — bkz. çağıran dosyalar) için AYNI
   fonksiyon kullanılır; ayrı bir bildirim kütüphanesi/
   component sistemi İCAT EDİLMEDİ, mevcut #shortcut-hint
   elementi ve görsel tasarımı (bkz. css/components/toast.css)
   aynen korunuyor.

   Tek eklenen şey: art arda hızlıca gelen birden fazla
   bildirimin üst üste binip "kaotik" görünmesini önlemek
   için basit bir SIRA (queue) — bir toast gösterilirken yeni
   bir tane istenirse, öncekinin kaybolmasını bekleyip
   ardından gösterilir. Aynı metin çok kısa bir süre (500ms)
   içinde tekrar istenirse (örn. hızlı art arda tıklama)
   yinelenen bildirim kuyruğa hiç eklenmez.
   ========================================================= */

const TOAST_DISPLAY_MS = 1400;
const TOAST_GAP_MS = 150;
const TOAST_DEDUPE_MS = 500;

let toastQueue = [];
let toastActive = false;
let toastHideTimer = null;
let toastAdvanceTimer = null;
let lastToastText = null;
let lastToastAt = 0;

function showShortcutHint(text) {

    if (!text) {
        return;
    }

    const now = Date.now();

    if (
        text === lastToastText &&
        (now - lastToastAt) < TOAST_DEDUPE_MS
    ) {

        return;

    }

    lastToastText = text;
    lastToastAt = now;

    toastQueue.push(text);

    advanceToastQueue();

}

function advanceToastQueue() {

    if (toastActive) {
        return;
    }

    const next =
        toastQueue.shift();

    if (next === undefined) {
        return;
    }

    renderToastHint(next);

}

function renderToastHint(text) {

    const hint =
        $("#shortcut-hint");

    if (!hint) {
        return;
    }

    toastActive = true;

    hint.textContent = text;

    hint.classList.add("show");

    clearTimeout(toastHideTimer);
    clearTimeout(toastAdvanceTimer);

    toastHideTimer =
        setTimeout(
            () => {

                hint.classList.remove(
                    "show"
                );

                /*
                 * Kaybolma geçişinin (opacity/transform)
                 * bitmesi için küçük bir ara — bkz.
                 * TOAST_GAP_MS ve .shortcut-hint transition
                 * süresi (css/components/toast.css).
                 */
                toastAdvanceTimer =
                    setTimeout(
                        () => {

                            toastActive = false;

                            advanceToastQueue();

                        },
                        TOAST_GAP_MS
                    );

            },
            TOAST_DISPLAY_MS
        );

}
