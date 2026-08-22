/* =========================================================
   03-data-store.js
   Veri yükleme/kaydetme, tema uygulama, gün verileri (not/ödev/proje/plan), kategori verileri, task normalize, id üretimi.
   ========================================================= */

/* =========================================================
   VERİ YÜKLEME
   ========================================================= */

function loadData() {

    /*
     * LEGACY KEY TEMİZLİĞİ (görevler):
     * Eğer güncel anahtar (STORAGE_KEY) boşsa ve veri eski
     * anahtardan (LEGACY_STORAGE_KEY) okunduysa, bu bir
     * migration'dır. Migration yalnızca veri BAŞARIYLA
     * yeni anahtara YAZILDIKTAN sonra eski anahtar silinir
     * — böylece yazma başarısız olursa (örn. kota dolu)
     * eski veri kaybolmaz, yalnızca bir sonraki açılışta
     * tekrar migration denenir.
     */
    let migratedFromLegacyTasks = false;

    try {

        let saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {

            saved = localStorage.getItem(LEGACY_STORAGE_KEY);

            migratedFromLegacyTasks = saved !== null;

        }

        if (saved) {

            const parsed = JSON.parse(saved);

            if (Array.isArray(parsed)) {
                tasks = parsed.map(normalizeTask);
            } else {
                migratedFromLegacyTasks = false;
            }

        } else {

            migratedFromLegacyTasks = false;

        }

    } catch (error) {

        console.error("Görevler yüklenemedi:", error);
        tasks = [];
        migratedFromLegacyTasks = false;

    }

    if (migratedFromLegacyTasks) {

        try {

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(tasks)
            );

            localStorage.removeItem(LEGACY_STORAGE_KEY);

        } catch (error) {

            /*
             * Yeni anahtara yazma başarısız oldu — eski
             * anahtara (LEGACY_STORAGE_KEY) KASITLI OLARAK
             * DOKUNULMUYOR, veri kaybı olmasın diye.
             */
            console.warn(
                "Eski görev verisi (v3) yeni anahtara taşınamadı, v3 korunuyor:",
                error
            );

        }

    }

    /*
     * LEGACY KEY TEMİZLİĞİ (ayarlar): görevlerle BİREBİR
     * AYNI güvenli migration deseni.
     */
    let migratedFromLegacySettings = false;

    try {

        let savedSettings = localStorage.getItem(SETTINGS_KEY);

        if (!savedSettings) {

            savedSettings = localStorage.getItem(LEGACY_SETTINGS_KEY);

            migratedFromLegacySettings = savedSettings !== null;

        }

        if (savedSettings) {

            const parsedSettings = JSON.parse(savedSettings);

            if (
                parsedSettings &&
                typeof parsedSettings === "object"
            ) {

                settings = {
                    ...settings,
                    ...parsedSettings
                };

                if (
                    typeof settings.dayResetHour !== "number" ||
                    settings.dayResetHour < 0 ||
                    settings.dayResetHour > 6
                ) {
                    settings.dayResetHour = 4;
                }

                if (
                    typeof settings.soundEnabled !== "boolean"
                ) {
                    settings.soundEnabled = true;
                }

                if (
                    settings.theme !== "dark" &&
                    settings.theme !== "light"
                ) {
                    settings.theme = "dark";
                }

                if (
                    !PALETTES.includes(
                        settings.palette
                    )
                ) {
                    settings.palette = "monokrom";
                }

            } else {

                migratedFromLegacySettings = false;

            }

        } else {

            migratedFromLegacySettings = false;

        }

    } catch (error) {

        console.error("Ayarlar yüklenemedi:", error);
        migratedFromLegacySettings = false;

    }

    if (migratedFromLegacySettings) {

        try {

            localStorage.setItem(
                SETTINGS_KEY,
                JSON.stringify(settings)
            );

            localStorage.removeItem(LEGACY_SETTINGS_KEY);

        } catch (error) {

            console.warn(
                "Eski ayar verisi (v1) yeni anahtara taşınamadı, v1 korunuyor:",
                error
            );

        }

    }

}

/* =========================================================
   VERİ KAYDETME
   ========================================================= */

function saveData() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(tasks)
        );

        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(settings)
        );

        return true;

    } catch (error) {

        console.error("Veriler kaydedilemedi:", error);

        /*
         * P0 UX notu: eskiden bu hata yalnızca konsola
         * yazılıyor, kullanıcıya HİÇBİR geri bildirim
         * verilmiyordu (bkz. görev tanımı madde 2).
         * showShortcutHint zaten global bir toast
         * fonksiyonu (bkz. 06-shortcuts.js) — yeni bir
         * hata gösterim sistemi İCAT EDİLMEDİ.
         */
        if (typeof showShortcutHint === "function") {
            showShortcutHint("Değişiklik kaydedilemedi.");
        }

        return false;

    }

}

/* =========================================================
   TEMA / RENK PALETİ UYGULA
   ========================================================= */

function applyTheme() {

    document.documentElement.setAttribute(
        "data-theme",
        settings.theme
    );

    document.documentElement.setAttribute(
        "data-palette",
        settings.palette
    );

    updateNov10Flag();

}

/*
 * 10 Kasım'da temadan bağımsız olarak
 * siyah vurguyu devreye sokar.
 */

function updateNov10Flag() {

    const today =
        effectiveDate();

    const isNov10 =
        today.getMonth() === 10 &&
        today.getDate() === 10;

    if (isNov10) {

        document.documentElement.setAttribute(
            "data-nov10",
            "true"
        );

    } else {

        document.documentElement.removeAttribute(
            "data-nov10"
        );

    }

}

/* =========================================================
   GÜN VERİLERİ (NOT / ÖDEV / PROJE / GÜNLÜK PLAN) YÜKLE
   ========================================================= */

function loadDailyData() {

    try {

        const saved =
            localStorage.getItem(DAILY_KEY);

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(saved);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            typeof parsed.entries !== "object" ||
            parsed.entries === null
        ) {

            return;

        }

        const cleanEntries = {};

        Object.keys(parsed.entries).forEach(key => {

            if (
                !/^\d{4}-\d{2}-\d{2}$/.test(key)
            ) {
                return;
            }

            cleanEntries[key] =
                normalizeDayEntry(
                    parsed.entries[key]
                );

        });

        dailyData = {
            version: DAILY_DATA_VERSION,
            entries: cleanEntries
        };

        /*
         * İleride veri yapısı değişirse burada
         * sürüm bazlı migration eklenebilir.
         */

    } catch (error) {

        console.error(
            "Gün verileri yüklenemedi:",
            error
        );

        dailyData = {
            version: DAILY_DATA_VERSION,
            entries: {}
        };

    }

}

function saveDailyData() {

    try {

        localStorage.setItem(
            DAILY_KEY,
            JSON.stringify(dailyData)
        );

        return true;

    } catch (error) {

        console.error(
            "Gün verileri kaydedilemedi:",
            error
        );

        if (typeof showShortcutHint === "function") {
            showShortcutHint("Değişiklik kaydedilemedi.");
        }

        return false;

    }

}

function normalizeDayEntry(entry) {

    const safe =
        entry && typeof entry === "object"
            ? entry
            : {};

    const cleanList = (list, mapper) =>
        Array.isArray(list)
            ? list
                .filter(
                    item =>
                        item &&
                        typeof item === "object"
                )
                .map(mapper)
            : [];

    return {

        notes: cleanList(
            safe.notes,
            item => ({
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : createId(),
                text:
                    typeof item.text === "string"
                        ? item.text.trim().slice(0, 200)
                        : "",
                createdAt:
                    item.createdAt ||
                    new Date().toISOString()
            })
        ).filter(item => item.text),

        homeworks: cleanList(
            safe.homeworks,
            item => ({
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : createId(),
                title:
                    typeof item.title === "string"
                        ? item.title.trim().slice(0, 120)
                        : "",
                done: Boolean(item.done),
                createdAt:
                    item.createdAt ||
                    new Date().toISOString()
            })
        ).filter(item => item.title),

        projects: cleanList(
            safe.projects,
            item => ({
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : createId(),
                title:
                    typeof item.title === "string"
                        ? item.title.trim().slice(0, 120)
                        : "",
                createdAt:
                    item.createdAt ||
                    new Date().toISOString()
            })
        ).filter(item => item.title),

        dailyPlan: cleanList(
            safe.dailyPlan,
            item => ({
                id:
                    typeof item.id === "string" && item.id
                        ? item.id
                        : createId(),
                time:
                    typeof item.time === "string" &&
                    /^\d{2}:\d{2}$/.test(item.time)
                        ? item.time
                        : "00:00",
                title:
                    typeof item.title === "string"
                        ? item.title.trim().slice(0, 80)
                        : "",
                done: Boolean(item.done),
                createdAt:
                    item.createdAt ||
                    new Date().toISOString()
            })
        ).filter(item => item.title)
            .sort(
                (a, b) =>
                    a.time.localeCompare(b.time)
            )

    };

}

/*
 * Verilen tarih için gün verisini döndürür.
 * create=true ise, kayıt yoksa dailyData içine
 * oluşturup referansını verir (mutasyon için).
 */

function getDayEntry(key, create = false) {

    if (dailyData.entries[key]) {
        return dailyData.entries[key];
    }

    const empty = {
        notes: [],
        homeworks: [],
        projects: [],
        dailyPlan: []
    };

    if (create) {
        dailyData.entries[key] = empty;
        return dailyData.entries[key];
    }

    return empty;

}

/* =========================================================
   KATEGORİ VERİLERİ

   Kategoriler tasks dizisinden tamamen ayrı, kendi
   localStorage anahtarında (CATEGORIES_KEY) tutulan tek
   bir state (`categories`). Görevler kategoriye yalnızca
   id string'i ile referans verir; bu yüzden burada isim,
   renk veya ikon değişse bile tasks dizisine dokunmak
   gerekmez.
   ========================================================= */

function normalizeCategory(category) {

    if (
        !category ||
        typeof category !== "object"
    ) {
        return null;
    }

    const id =
        typeof category.id === "string" &&
        category.id.trim()
            ? category.id.trim()
            : "";

    const name =
        typeof category.name === "string" &&
        category.name.trim()
            ? category.name.trim().slice(0, 24)
            : "";

    if (!id || !name) {
        return null;
    }

    const color =
        typeof category.color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(category.color)
            ? category.color
            : "#8e8e93";

    const icon =
        typeof category.icon === "string"
            ? category.icon.trim().slice(0, 4)
            : "";

    return { id, name, color, icon };

}

function loadCategories() {

    try {

        const saved =
            localStorage.getItem(CATEGORIES_KEY);

        if (saved) {

            const parsed =
                JSON.parse(saved);

            if (
                Array.isArray(parsed) &&
                parsed.length > 0
            ) {

                const cleaned =
                    parsed
                        .map(normalizeCategory)
                        .filter(Boolean);

                /*
                 * Aynı id iki kez gelirse (bozuk veri)
                 * yalnızca ilkini tut.
                 */
                const seen = new Set();

                categories =
                    cleaned.filter(category => {

                        if (seen.has(category.id)) {
                            return false;
                        }

                        seen.add(category.id);

                        return true;

                    });

                if (categories.length > 0) {
                    return;
                }

            }

        }

    } catch (error) {

        console.error(
            "Kategoriler yüklenemedi:",
            error
        );

    }

    /*
     * Kayıt yok / bozuk / boş: varsayılan kategori
     * kümesinden başla.
     */
    categories =
        DEFAULT_CATEGORIES.map(
            category => ({ ...category })
        );

}

function saveCategories() {

    try {

        localStorage.setItem(
            CATEGORIES_KEY,
            JSON.stringify(categories)
        );

        return true;

    } catch (error) {

        console.error(
            "Kategoriler kaydedilemedi:",
            error
        );

        if (typeof showShortcutHint === "function") {
            showShortcutHint("Değişiklik kaydedilemedi.");
        }

        return false;

    }

}

function addCategory(name, color, icon) {

    const category =
        normalizeCategory({
            id: createId(),
            name,
            color,
            icon
        });

    if (!category) {
        return null;
    }

    categories.push(category);

    saveCategories();

    return category;

}

/*
 * Yalnızca isim/renk/ikon günceller — id sabit kalır.
 * Görevler kategoriye id üzerinden bağlı olduğu için
 * mevcut görev-kategori ilişkisi etkilenmez.
 */
function updateCategory(id, changes) {

    const category =
        categories.find(
            item => item.id === id
        );

    if (!category) {
        return false;
    }

    const merged =
        normalizeCategory({
            ...category,
            ...changes,
            id
        });

    if (!merged) {
        return false;
    }

    Object.assign(category, merged);

    saveCategories();

    return true;

}

/*
 * Bir kategori silindiğinde o kategoriye ait görevler
 * "kaybolmaz" — varsayılan kategoriye (DEFAULT_CATEGORY)
 * taşınır. En az bir kategori her zaman kalmalı ve
 * varsayılan kategori asla silinemez; aksi hâlde
 * normalizeTask() ve getCategory() içindeki fallback
 * mantığının dayanacağı bir kategori kalmaz.
 */
function deleteCategory(id) {

    if (id === DEFAULT_CATEGORY) {
        return {
            ok: false,
            reason: "default"
        };
    }

    if (categories.length <= 1) {
        return {
            ok: false,
            reason: "last"
        };
    }

    const exists =
        categories.some(
            category => category.id === id
        );

    if (!exists) {
        return {
            ok: false,
            reason: "missing"
        };
    }

    categories =
        categories.filter(
            category => category.id !== id
        );

    let reassigned = false;

    tasks.forEach(task => {

        if (task.category === id) {
            task.category = DEFAULT_CATEGORY;
            reassigned = true;
        }

    });

    /*
     * Silinen kategori o an aktif filtreyse, filtre "Tümü"ne
     * döner — aksi hâlde artık var olmayan bir id'ye göre
     * filtrelenmiş, sessizce boş görünen bir liste kalırdı.
     */
    if (activeCategoryFilter === id) {
        activeCategoryFilter = "all";
    }

    saveCategories();

    if (reassigned) {
        saveData();
    }

    return {
        ok: true,
        reassigned
    };

}

/* =========================================================
   TASK NORMALIZE
   ========================================================= */

function normalizeTask(task) {

    const completedDates =
        Array.isArray(task.completedDates)
            ? task.completedDates
                .filter(
                    value =>
                        typeof value === "string" &&
                        /^\d{4}-\d{2}-\d{2}$/.test(value)
                )
                .filter(
                    (value, index, array) =>
                        array.indexOf(value) === index
                )
            : [];

    const category =
        typeof task.category === "string" &&
        categories.some(
            category => category.id === task.category
        )
            ? task.category
            : DEFAULT_CATEGORY;

    return {

        id:
            typeof task.id === "string" &&
            task.id.trim()
                ? task.id
                : createId(),

        title:
            typeof task.title === "string" &&
            task.title.trim()
                ? task.title.trim()
                : "İsimsiz görev",

        description:
            typeof task.description === "string"
                ? task.description
                : "",

        category,

        completedDates,

        createdAt:
            task.createdAt ||
            new Date().toISOString()

    };

}

/* =========================================================
   ID
   ========================================================= */

function createId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );

}

function getCategory(id) {

    return (
        categories.find(
            category => category.id === id
        ) ||
        categories[categories.length - 1] || {
            id: DEFAULT_CATEGORY,
            name: "Diğer",
            color: "#8e8e93",
            icon: "✦"
        }
    );

}
