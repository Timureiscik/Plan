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

function showShortcutHint(text) {

    const hint =
        $("#shortcut-hint");

    if (!hint) {
        return;
    }

    hint.textContent = text;

    hint.classList.add("show");

    clearTimeout(
        showShortcutHint._timer
    );

    showShortcutHint._timer =
        setTimeout(
            () => {
                hint.classList.remove(
                    "show"
                );
            },
            1400
        );

}

