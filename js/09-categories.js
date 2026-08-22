/* =========================================================
   09-categories.js
   Kategori seçici, kategori filtresi, kategori yönetimi (ayarlar modalı).
   ========================================================= */

/* =========================================================
   KATEGORİ SEÇİCİ
   ========================================================= */

function renderCategoryPicker() {

    const container =
        $("#category-picker");

    if (!container) {
        return;
    }

    container.innerHTML =
        categories.map(
            category => `
                <button
                    type="button"
                    class="category-chip ${
                        selectedCategory ===
                        category.id
                            ? "active"
                            : ""
                    }"
                    data-category="${escapeHtml(category.id)}"
                >
                    <span
                        class="dot"
                        style="background:${category.color}"
                    ></span>

                    ${escapeHtml(category.icon)}
                    ${escapeHtml(category.name)}
                </button>
            `
        ).join("");

}

/* =========================================================
   KATEGORİ FİLTRESİ
   ========================================================= */

function renderCategoryFilter() {

    const container =
        $("#category-filter");

    if (!container) {
        return;
    }

    const chips = [
        {
            id: "all",
            name: "Tümü",
            color: "#8e8e93",
            icon: ""
        },
        ...categories
    ];

    container.innerHTML =
        chips.map(
            category => `
                <button
                    type="button"
                    class="category-chip ${
                        activeCategoryFilter ===
                        category.id
                            ? "active"
                            : ""
                    }"
                    data-category="${escapeHtml(category.id)}"
                >
                    <span
                        class="dot"
                        style="background:${category.color}"
                    ></span>

                    ${
                        category.icon
                            ? escapeHtml(category.icon) + " "
                            : ""
                    }

                    ${escapeHtml(category.name)}
                </button>
            `
        ).join("");

}

/* =========================================================
   KATEGORİ YÖNETİMİ (Ayarlar modalı)
   ========================================================= */

function renderCategoryManageList() {

    const container =
        $("#category-manage-list");

    if (!container) {
        return;
    }

    container.innerHTML =
        categories.map(category => {

            const isDefault =
                category.id === DEFAULT_CATEGORY;

            if (category.id === editingCategoryId) {

                return `
                    <div class="category-manage-item is-editing">

                        <input
                            type="text"
                            class="category-edit-icon"
                            data-field="icon"
                            maxlength="4"
                            value="${escapeHtml(category.icon)}"
                            aria-label="İkon"
                        >

                        <input
                            type="text"
                            class="category-edit-name"
                            data-field="name"
                            maxlength="24"
                            value="${escapeHtml(category.name)}"
                            aria-label="Kategori adı"
                        >

                        <input
                            type="color"
                            class="category-edit-color"
                            data-field="color"
                            value="${escapeHtml(category.color)}"
                            aria-label="Renk"
                        >

                        <button
                            type="button"
                            class="category-manage-save"
                            data-action="save-category"
                            data-category-id="${escapeHtml(category.id)}"
                            title="Kaydet"
                            aria-label="Kaydet"
                        >✓</button>

                        <button
                            type="button"
                            class="category-manage-cancel"
                            data-action="cancel-edit-category"
                            title="Vazgeç"
                            aria-label="Vazgeç"
                        >×</button>

                    </div>
                `;

            }

            return `
                <div class="category-manage-item">

                    <span
                        class="dot"
                        style="background:${category.color}"
                    ></span>

                    <span class="category-manage-name">
                        ${
                            category.icon
                                ? escapeHtml(category.icon) + " "
                                : ""
                        }
                        ${escapeHtml(category.name)}
                    </span>

                    <button
                        type="button"
                        class="category-manage-edit"
                        data-action="edit-category"
                        data-category-id="${escapeHtml(category.id)}"
                        title="Düzenle"
                        aria-label="Düzenle"
                    >✎</button>

                    <button
                        type="button"
                        class="category-manage-delete"
                        data-action="delete-category"
                        data-category-id="${escapeHtml(category.id)}"
                        title="${
                            isDefault
                                ? "Varsayılan kategori silinemez"
                                : "Sil"
                        }"
                        aria-label="Sil"
                        ${isDefault ? "disabled" : ""}
                    >×</button>

                </div>
            `;

        }).join("");

}

function setupCategoryManagement() {

    on(
        "#category-add-form",
        "submit",
        event => {

            event.preventDefault();

            const nameInput = $("#category-add-name");
            const colorInput = $("#category-add-color");
            const iconInput = $("#category-add-icon");

            const created =
                addCategory(
                    nameInput ? nameInput.value : "",
                    colorInput ? colorInput.value : "",
                    iconInput ? iconInput.value : ""
                );

            if (!created) {
                return;
            }

            if (nameInput) {
                nameInput.value = "";
            }

            if (iconInput) {
                iconInput.value = "";
            }

            if (colorInput) {
                colorInput.value = "#8e8e93";
            }

            renderCategoryManageList();
            renderCategoryPicker();
            renderCategoryFilter();

            showShortcutHint("Kategori eklendi");

        }
    );

    delegate(
        "#category-manage-list",
        "click",
        "[data-action]",
        (element, event) => {

            const action = element.dataset.action;

            if (action === "edit-category") {

                editingCategoryId =
                    element.dataset.categoryId;

                renderCategoryManageList();

                return;

            }

            if (action === "cancel-edit-category") {

                editingCategoryId = null;

                renderCategoryManageList();

                return;

            }

            if (action === "save-category") {

                const row =
                    element.closest(".category-manage-item");

                if (!row) {
                    return;
                }

                const nameInput =
                    row.querySelector(
                        "[data-field='name']"
                    );

                const colorInput =
                    row.querySelector(
                        "[data-field='color']"
                    );

                const iconInput =
                    row.querySelector(
                        "[data-field='icon']"
                    );

                updateCategory(
                    element.dataset.categoryId,
                    {
                        name: nameInput ? nameInput.value : "",
                        color: colorInput ? colorInput.value : "",
                        icon: iconInput ? iconInput.value : ""
                    }
                );

                editingCategoryId = null;

                renderCategoryManageList();
                renderCategoryPicker();
                renderCategoryFilter();
                renderAll();

                showShortcutHint("Kategori güncellendi");

                return;

            }

            if (action === "delete-category") {

                const category =
                    categories.find(
                        item =>
                            item.id ===
                            element.dataset.categoryId
                    );

                if (!category) {
                    return;
                }

                openConfirmModal({
                    title: "Kategoriyi sil",
                    message:
                        `"${category.name}" kategorisini silmek istediğine emin misin? Bu kategorideki görevler "Diğer" kategorisine taşınacak.`,
                    confirmLabel: "Sil",
                    onConfirm: () => {

                        const result =
                            deleteCategory(category.id);

                        if (!result.ok) {
                            return;
                        }

                        renderCategoryManageList();
                        renderCategoryPicker();
                        renderCategoryFilter();
                        renderAll();

                        showShortcutHint("Kategori silindi");

                    }
                });

            }

        }
    );

}
