/* =========================================================
   01-constants.js
   Sabitler, DOM yardımcıları, uygulama/takvim durumu (global state).
   ========================================================= */

/* =========================================================
   HABITUS
   Alışkanlık & Görev Takip Uygulaması
   ========================================================= */

"use strict";

/* =========================================================
   AYARLAR / SABİTLER
   ========================================================= */

const STORAGE_KEY = "plan_tasks_v4";
const LEGACY_STORAGE_KEY = "plan_tasks_v3";

const SETTINGS_KEY = "plan_settings_v2";
const LEGACY_SETTINGS_KEY = "plan_settings_v1";

/*
 * Gün bazlı veriler: notlar, ödevler, projeler, günlük plan.
 * Her gün kendi "YYYY-MM-DD" anahtarı altında saklanır.
 */
const DAILY_KEY = "habitus_daily_v1";
const DAILY_DATA_VERSION = 1;

/*
 * Kullanıcı tanımlı kategoriler. Görevler kategoriye yalnızca
 * `id` üzerinden referans verir (bkz. task.category), bu yüzden
 * bir kategori düzenlendiğinde (isim/renk/ikon) tasks dizisine
 * hiç dokunmaya gerek kalmaz — mevcut görev-kategori ilişkisi
 * bozulmaz.
 */
const CATEGORIES_KEY = "habitus_categories_v1";

/*
 * HEDEFLER (Haftalık / Aylık / Özel dönem)
 * Görev/kategori verilerinden tamamen ayrı, kendi
 * localStorage anahtarında tutulan bir state (`goals`).
 * `progress` / `status` / `isCompleted` KASITLI olarak
 * saklanmıyor — bunlar her zaman tasks.completedDates /
 * goal.manualLog üzerinden canlı türetiliyor (bkz.
 * 22-goals.js).
 */
const GOALS_KEY = "habitus_goals_v1";

/*
 * HIZLI NOT WIDGET
 * Görev/hedef/gün-paneli verilerinden tamamen ayrı, kasıtlı
 * olarak basit bir liste (id, text, date, createdAt).
 * dailyData.entries[key].notes (gün paneli notları) İLE
 * KARIŞTIRILMAMALI — o, seçili takvim gününe bağlı ayrı bir
 * sistemdir (bkz. 04-day-panel.js). Bu ise "aklıma geldi,
 * yazdım" mantığında, tarihe yalnızca referans amaçlı
 * bağlanan bağımsız bir liste (bkz. 23-quick-notes.js).
 */
const NOTES_KEY = "habitus_notes_v1";

/*
 * "Geçmiş" sekmesinde weekly/monthly (recurring) hedefler
 * için gösterilecek geçmiş dönem sayısı (yaklaşık son
 * 8 hafta / 8 ay — bkz. görev tanımı).
 */
const GOAL_HISTORY_PAGE_SIZE = 8;

/*
 * Tamamlayıcı, dinamik takvim kaynağı (Google Calendar genel
 * ICS beslemesi — Türk bayramları ve özel günler için).
 * Sabit/hesaplanan özel gün sistemiyle (bkz.
 * getComputedSpecialDaysForYear()) aynı tek `calendarEvents`
 * state'ine, aynı buildCalendarEventsForYear() birleştirme
 * adımından geçerek yazılır (bkz. "ICS TAKVİM BESLEMESİ"
 * bölümü).
 *
 * ÖNEMLİ (bkz. o bölümdeki not): Google'ın public ICS
 * export URL'leri normalde CORS başlığı döndürmez, bu
 * yüzden bu fetch tarayıcıda büyük olasılıkla başarısız
 * olacak — kod buna göre (sessizce cache'e/diğer
 * kaynaklara düşerek) tasarlandı.
 */
const ICS_URL =
    "https://calendar.google.com/calendar/ical/4c14a717c39e76f489068a1be169f5a2f675c0181cb001ada182a7f5e9cc3e21%40group.calendar.google.com/public/basic.ics";

const ICS_CACHE_KEY = "habitus_ics_cache_v1";

/*
 * Uygulama ilk kez açıldığında (veya kategori verisi
 * localStorage'da hiç yoksa/bozuksa) kategori listesinin
 * başlangıç değeri. Kategoriler artık kullanıcı tarafından
 * eklenip/düzenlenip/silinebildiği için ayrı, mutasyona
 * açık bir `categories` state'i üzerinden yönetiliyor
 * (bkz. "KATEGORİ VERİLERİ" bölümü). Bu sabit yalnızca
 * ilk kurulum / fallback amaçlıdır, doğrudan render veya
 * doğrulama için kullanılmaz.
 */
const DEFAULT_CATEGORIES = [
    {
        id: "spor",
        name: "Spor",
        color: "#ff6b6b",
        icon: "🏃"
    },
    {
        id: "kitap",
        name: "Kitap",
        color: "#5b8def",
        icon: "📚"
    },
    {
        id: "yazilim",
        name: "Yazılım",
        color: "#a78bfa",
        icon: "💻"
    },
    {
        id: "rutin",
        name: "Rutin",
        color: "#34d399",
        icon: "🔁"
    },
    {
        id: "diger",
        name: "Diğer",
        color: "#f5a623",
        icon: "✦"
    }
];

const DEFAULT_CATEGORY = "diger";

const PALETTES = [
    "monokrom",
    "mor",
    "mavi",
    "yesil",
    "turuncu",
    "kirmizi"
];

/* =========================================================
   ROZETLER (BAŞARI ROZETLERİ)

   Sabit rozet tanımları. Kazanılıp kazanılmadığı bilgisi
   AYRI bir localStorage anahtarında SAKLANMAZ — tamamen
   türetilmiş (derived) veridir; her renderBadges()
   çağrısında mevcut tasks / dailyData / mediaMetaList
   üzerinden yeniden hesaplanır (bkz. 20-badges.js). Bu
   sayede geçmiş bir görev silinip düzenlendiğinde bile
   rozet durumu ekstra bir senkronizasyona gerek kalmadan
   otomatik olarak tutarlı kalır.
   ========================================================= */

const BADGE_DEFINITIONS = [
    {
        id: "ilk-adim",
        icon: "🌱",
        name: "İlk Adım",
        description: "İlk görevini tamamla."
    },
    {
        id: "seri-3",
        icon: "🔥",
        name: "3 Günlük Seri",
        description: "Bir görevi 3 gün üst üste tamamla."
    },
    {
        id: "seri-7",
        icon: "🔥",
        name: "7 Günlük Seri",
        description: "Bir görevi 7 gün üst üste tamamla."
    },
    {
        id: "seri-30",
        icon: "🏅",
        name: "30 Günlük Seri",
        description: "Bir görevi 30 gün üst üste tamamla."
    },
    {
        id: "seri-100",
        icon: "👑",
        name: "100 Günlük Seri",
        description: "Bir görevi 100 gün üst üste tamamla."
    },
    {
        id: "tamamlama-10",
        icon: "🥉",
        name: "Başlangıç Ritmi",
        description: "Toplamda 10 tamamlama yap."
    },
    {
        id: "tamamlama-50",
        icon: "🥈",
        name: "Kararlılık",
        description: "Toplamda 50 tamamlama yap."
    },
    {
        id: "tamamlama-200",
        icon: "🥇",
        name: "Efsane",
        description: "Toplamda 200 tamamlama yap."
    },
    {
        id: "mukemmel-hafta",
        icon: "⭐",
        name: "Mükemmel Hafta",
        description: "Son 7 günde tüm görevlerini eksiksiz tamamla."
    },
    {
        id: "kategori-ustasi",
        icon: "🎯",
        name: "Kategori Ustası",
        description: "Tek bir kategoride 15 tamamlama yap."
    },
    {
        id: "cok-gorevli",
        icon: "📋",
        name: "Görev Koleksiyoncusu",
        description: "10 veya daha fazla görev oluştur."
    },
    {
        id: "not-tutkunu",
        icon: "📝",
        name: "Not Tutkunu",
        description: "Takvimde toplam 10 not biriktir."
    },
    {
        id: "ilk-fotograf",
        icon: "📷",
        name: "İlk Anı",
        description: "İlk fotoğrafını yükle."
    },
    {
        id: "ilk-ses",
        icon: "🎙️",
        name: "İlk Kayıt",
        description: "İlk ses kaydını oluştur."
    },
    {
        id: "ilk-hedef",
        icon: "🎯",
        name: "İlk Hedef",
        description: "Bir hedefi tamamla."
    },
    {
        id: "hedef-5",
        icon: "🏆",
        name: "5 Hedef Tamamlandı",
        description: "Toplamda 5 hedef dönemini tamamla."
    }
];

/*
 * GÜNÜN SÖZÜ
 * Tarihe bağlı, sabit bir söz listesi. Aynı gün içinde
 * sayfa yenilendiğinde söz değişmez; ertesi gün (merkezi
 * effectiveDateKey sistemine göre) yeni bir söz gösterilir.
 */
const DAILY_QUOTES = [
    "Küçük adımlar, zamanla büyük sonuçlar getirir.",
    "Bugün attığın bir adım, yarının alışkanlığıdır.",
    "Mükemmel olmak değil, devam etmek önemlidir.",
    "Disiplin, hedefle bugün arasındaki köprüdür.",
    "Bir işe başlamanın en iyi zamanı şimdidir.",
    "Her gün %1 ilerlemek, yılda büyük fark yaratır.",
    "Zor olan değil, düzenli olan kazanır.",
    "Bugünün işini yarına bırakma, bugüne bırak.",
    "Alışkanlıklar, geleceğini sessizce inşa eder.",
    "Kendine karşı verdiğin sözü tut.",
    "Küçük başarılar, büyük özgüvenin temelidir.",
    "Bir adım at, yol kendini gösterecektir.",
    "Bugün yorulman, yarın rahat etmen içindir.",
    "Vazgeçmek yerine, hızını yavaşlat ve devam et.",
    "Zaman geçer; onu nasıl kullandığın kalır.",
    "İlerleme, mükemmellikten daha değerlidir.",
    "Bugün ektiğin çaba, yarının hasadıdır.",
    "En uzun yolculuk bile tek bir adımla başlar.",
    "Kendini dünle değil, dünkü halinle kıyasla.",
    "Küçük düzenli çabalar, büyük sıçramalardan güçlüdür.",
    "Bugün yapmadığın şey, yarın daha da zorlaşır.",
    "Odaklan; her şeye değil, önemli olana zaman ayır.",
    "Rahat alan büyümenin düşmanıdır.",
    "Bir görevi bitirmek, bir sonrakine güç verir.",
    "Bugünkü emeğin, yarının özgürlüğüdür.",
    "Planlamak yarıdır, uygulamak tamamıdır.",
    "Kendine acımak yerine, kendine güven.",
    "Az ama sürekli, çoktan ama düzensizden iyidir.",
    "Bugün başladığın şey, bir gün alışkanlığın olur.",
    "İlerlemenin izini takip et, mükemmelliğin değil.",
    "Her gün yeni bir başlangıç fırsatıdır.",
    "Emek, sonucundan önce gelir."
];

/*
 * Basit ve deterministik bir string hash fonksiyonu.
 * Aynı tarih anahtarı (YYYY-MM-DD) her zaman aynı
 * indeksi üretir.
 */
function hashDateKey(key) {

    let hash = 0;

    for (let i = 0; i < key.length; i++) {

        hash =
            (hash * 31 + key.charCodeAt(i)) |
            0;

    }

    return Math.abs(hash);

}

function getQuoteOfTheDay() {

    const key = effectiveDateKey();

    const index =
        hashDateKey(key) %
        DAILY_QUOTES.length;

    return DAILY_QUOTES[index];

}

/* =========================================================
   DİNAMİK TAKVİM DURUMU

   `calendarEvents` — o an takvimde GÖSTERİLEN yılın birleşik
   (tek) etkinlik listesi. Tek gerçek kaynak budur; aşağıdaki
   ham veri kaynakları (icsEvents, hesaplanan/sabit özel
   günler) yalnızca buildCalendarEventsForYear() içinde bu
   tek listeye birleştirilir — ayrı bir "ikinci takvim
   state'i" değildir.
   ========================================================= */

let calendarEvents = [];

/*
 * ICS beslemesinden ayrıştırılan ham etkinlikler — TÜM
 * yılları kapsar (ICS tek seferde, yıldan bağımsız çekilir).
 * localStorage'da ICS_CACHE_KEY altında saklanır ki internet
 * yokken/ICS başarısız olduğunda son başarılı veri kullanılabilsin.
 */
let icsEvents = [];
let icsLoadInFlight = false;

/* =========================================================
   UYGULAMA DURUMU
   ========================================================= */

let tasks = [];
let categories = [];
let goals = [];
let quickNotes = [];
let currentPage = "home";
let calendarDate = new Date();
let editingTaskId = null;
let selectedCategory = DEFAULT_CATEGORY;
let editingCategoryId = null;
let activeCategoryFilter = "all";
let focusedTaskIndex = -1;
let audioCtx = null;

let settings = {
    mebLastUpdate: null,
    dayResetHour: 4,
    soundEnabled: true,
    theme: "dark",
    palette: "monokrom"
};

/*
 * dailyData.entries["YYYY-MM-DD"] = {
 *     notes: [{ id, text, createdAt }],
 *     homeworks: [{ id, title, done, createdAt }],
 *     projects: [{ id, title, createdAt }],
 *     dailyPlan: [{ id, time, title, done, createdAt }]
 * }
 */
let dailyData = {
    version: DAILY_DATA_VERSION,
    entries: {}
};

let selectedDayKey = null;

/*
 * Gün başlangıç saatine göre hesaplanan "bugün" değeri;
 * saat/gün değiştiğinde farkı algılamak için kullanılır.
 */
let lastKnownDayKey = null;

/* =========================================================
   DOM YARDIMCILARI
   ========================================================= */

const $ = (selector, scope = document) => {
    return scope.querySelector(selector);
};

const $$ = (selector, scope = document) => {
    return Array.from(scope.querySelectorAll(selector));
};

