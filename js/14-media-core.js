/* =========================================================
   14-media-core.js
   Medya sabitleri, IndexedDB katmanı, medya yardımcı fonksiyonları.
   ========================================================= */

/* =========================================================
   MEDYA (FOTOĞRAF & SES) — AYARLAR / SABİTLER

   Habitus tamamen istemci taraflı bir uygulama (sunucu, API
   veya veritabanı yok); tüm veriler tarayıcıda tutuluyor.
   Fotoğraf/ses ikili verisi localStorage'a sığmayacağı
   (kota ~5-10MB) için ayrı bir IndexedDB veritabanı
   kullanılıyor — projede ilk kez. Küçük metadata
   (media_meta) ve ağır ikili veri (media_blobs) BİLEREK
   iki ayrı object store'a ayrıldı: böylece binlerce kayıt
   olsa bile ay/gün grupları yalnızca hafif metadata
   üzerinden anında hesaplanır, görsel/ses baytları yalnızca
   gerçekten görüntülenirken (grid'de görünen küçük resim,
   modalda açılan tam boy görsel, çalınan ses) okunur.
   ========================================================= */

const MEDIA_DB_NAME = "habitus_media_db";
const MEDIA_DB_VERSION = 1;
const MEDIA_META_STORE = "media_meta";
const MEDIA_BLOB_STORE = "media_blobs";

const MEDIA_MAX_PHOTO_BYTES = 20 * 1024 * 1024;
const MEDIA_MAX_AUDIO_BYTES = 40 * 1024 * 1024;

const MEDIA_PHOTO_MAX_DIMENSION = 1920;
const MEDIA_THUMB_MAX_DIMENSION = 480;
const MEDIA_PHOTO_QUALITY = 0.82;
const MEDIA_THUMB_QUALITY = 0.75;

const MEDIA_ALLOWED_PHOTO_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
]);

const MEDIA_ALLOWED_AUDIO_TYPES = new Set([
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/x-m4a",
    "audio/aac",
    "audio/m4a"
]);

/*
 * Fotoğraflar sekmesinde bir seferde kaç ay grubu
 * gösterileceği — binlerce fotoğrafta bile tüm ayların
 * DOM'a birden basılmasını önlemek için ("Daha fazla ay
 * göster" butonuyla artırılır).
 */
const MEDIA_MONTHS_PAGE_SIZE = 6;

const MEDIA_MONTH_NAMES = [
    "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
    "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

/*
 * OCR yalnızca fotoğraf yüklendiğinde/açıldığında ihtiyaç
 * duyulur; bu yüzden Tesseract.js başlangıçta değil, ilk
 * gerçek kullanımda CDN'den yükleniyor (gereksiz baştan
 * yükleme yapılmıyor). Türkçe dil paketi ('tur') kullanılır.
 * NOT: Bu, internet bağlantısı gerektirir — bağlantı yoksa
 * veya CDN'e erişilemiyorsa OCR sessizce "failed" durumuna
 * düşer, uygulama çökmez (bkz. runOcrForRecord).
 */
const TESSERACT_CDN_URL =
    "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let mediaDb = null;
let mediaDbReady = null;
let mediaDbAvailable = true;

/*
 * Yalnızca metadata (blob'suz) — grid/ay gruplama/gün
 * paneli bu diziden hesaplanır, IndexedDB'ye her render'da
 * gidilmez.
 */
let mediaMetaList = [];

let activeMediaTab = "photos";
let visibleMonthCount = MEDIA_MONTHS_PAGE_SIZE;

/*
 * O an DOM'da kullanılan blob object URL'leri — her
 * renderMediaPage() çağrısında öncekiler serbest bırakılıp
 * yenileri oluşturulur (bellek sızıntısı olmasın diye).
 */
let mediaObjectUrls = new Map();
let mediaModalObjectUrl = null;
let openMediaId = null;
let tesseractLoadPromise = null;

/* =========================================================
   MEDYA — INDEXEDDB KATMANI
   ========================================================= */

function openMediaDb() {

    if (mediaDbReady) {
        return mediaDbReady;
    }

    mediaDbReady = new Promise((resolve, reject) => {

        if (!window.indexedDB) {

            reject(
                new Error("IndexedDB bu tarayıcıda desteklenmiyor.")
            );

            return;

        }

        const request =
            indexedDB.open(
                MEDIA_DB_NAME,
                MEDIA_DB_VERSION
            );

        request.onupgradeneeded = () => {

            const db = request.result;

            if (
                !db.objectStoreNames.contains(
                    MEDIA_META_STORE
                )
            ) {

                const metaStore =
                    db.createObjectStore(
                        MEDIA_META_STORE,
                        { keyPath: "id" }
                    );

                metaStore.createIndex("dayKey", "dayKey");
                metaStore.createIndex("type", "type");
                metaStore.createIndex("createdAt", "createdAt");
                metaStore.createIndex("contentHash", "contentHash");

            }

            if (
                !db.objectStoreNames.contains(
                    MEDIA_BLOB_STORE
                )
            ) {

                db.createObjectStore(
                    MEDIA_BLOB_STORE,
                    { keyPath: "id" }
                );

            }

        };

        request.onsuccess = () => {
            mediaDb = request.result;
            resolve(mediaDb);
        };

        request.onerror = () => {

            reject(
                request.error ||
                new Error("Medya veritabanı açılamadı.")
            );

        };

    });

    return mediaDbReady;

}

function idbRequestToPromise(request) {

    return new Promise((resolve, reject) => {

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

    });

}

function mediaTx(storeNames, mode) {

    return openMediaDb().then(
        db => db.transaction(storeNames, mode)
    );

}

function mediaMetaPut(record) {

    return mediaTx([MEDIA_META_STORE], "readwrite").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_META_STORE).put(record)
            )
    );

}

function mediaMetaDelete(id) {

    return mediaTx([MEDIA_META_STORE], "readwrite").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_META_STORE).delete(id)
            )
    );

}

function mediaMetaGetAll() {

    return mediaTx([MEDIA_META_STORE], "readonly").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_META_STORE).getAll()
            )
    );

}

function mediaBlobPut(record) {

    return mediaTx([MEDIA_BLOB_STORE], "readwrite").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_BLOB_STORE).put(record)
            )
    );

}

function mediaBlobGet(id) {

    return mediaTx([MEDIA_BLOB_STORE], "readonly").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_BLOB_STORE).get(id)
            )
    );

}

function mediaBlobDelete(id) {

    return mediaTx([MEDIA_BLOB_STORE], "readwrite").then(
        tx =>
            idbRequestToPromise(
                tx.objectStore(MEDIA_BLOB_STORE).delete(id)
            )
    );

}

/*
 * Uygulama açılışında bir kez çağrılır; yalnızca hafif
 * metadata'yı belleğe alır. IndexedDB yoksa/açılamazsa
 * mediaDbAvailable false olur ve tüm medya UI'ı bunu
 * kullanıcıya nazikçe bildirir — uygulamanın geri kalanı
 * (takvim, görevler, notlar...) etkilenmez.
 */
function loadMediaIndex() {

    return openMediaDb()
        .then(() => mediaMetaGetAll())
        .then(records => {

            mediaMetaList =
                (records || [])
                    .filter(
                        record =>
                            record &&
                            typeof record === "object" &&
                            record.id
                    )
                    .sort(
                        (a, b) =>
                            mediaEffectiveDate(b).localeCompare(
                                mediaEffectiveDate(a)
                            )
                    );

        })
        .catch(error => {

            mediaDbAvailable = false;

            console.error(
                "Medya verileri yüklenemedi:",
                error
            );

        });

}

/* =========================================================
   MEDYA — YARDIMCI FONKSİYONLAR
   ========================================================= */

/*
 * Sıralama/aylık gruplama için "etkin tarih": fotoğrafın
 * EXIF çekilme tarihi varsa o, yoksa yüklenme tarihi
 * (fallback) kullanılır (bkz. görev maddesi 3).
 */
function mediaEffectiveDate(record) {

    return record.capturedAt || record.createdAt;

}

function mediaMonthKey(isoString) {

    return (isoString || "").slice(0, 7);

}

function formatMonthKeyTitle(monthKey) {

    const parts = monthKey.split("-");
    const year = parts[0];
    const monthIndex = Number(parts[1]) - 1;

    const monthName =
        MEDIA_MONTH_NAMES[monthIndex] || monthKey;

    return `${monthName} ${year}`;

}

function formatFileSize(bytes) {

    if (!Number.isFinite(bytes)) {
        return "-";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

}

function formatDuration(seconds) {

    if (!Number.isFinite(seconds)) {
        return "-";
    }

    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;

    return `${minutes}:${String(secs).padStart(2, "0")}`;

}

function formatShortDayLabel(dayKey) {

    const date = parseDate(dayKey);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return `${date.getDate()} ${getShortMonth(date)}`;

}

function formatFullDateTime(isoString) {

    if (!isoString) {
        return "Bilinmiyor";
    }

    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
        return "Bilinmiyor";
    }

    return date.toLocaleString(
        "tr-TR",
        {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}

function formatFullDayLabel(dayKey) {

    const date = parseDate(dayKey);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString(
        "tr-TR",
        {
            day: "numeric",
            month: "long",
            year: "numeric",
            weekday: "long"
        }
    );

}

function setMediaUploadStatus(text) {

    const el = $("#media-upload-status");

    if (el) {
        el.textContent = text;
    }

}

function findDuplicateByHash(hash) {

    if (!hash) {
        return null;
    }

    return (
        mediaMetaList.find(
            item => item.contentHash === hash
        ) || null
    );

}

/*
 * Basit, bağımsız SHA-256 hash — aynı fotoğrafın/sesin
 * gereksiz şekilde tekrar yüklenmesini önlemek için
 * (bkz. görev maddesi 1). Dosya adına değil, gerçek
 * içeriğe bakar; bu yüzden farklı isimle tekrar yüklenen
 * aynı dosya da yakalanır.
 */
async function computeFileHash(fileOrBlob) {

    try {

        const buffer = await fileOrBlob.arrayBuffer();

        const digest =
            await crypto.subtle.digest("SHA-256", buffer);

        return Array.from(new Uint8Array(digest))
            .map(byte => byte.toString(16).padStart(2, "0"))
            .join("");

    } catch (error) {

        console.warn(
            "Dosya hash'i hesaplanamadı:",
            error
        );

        return null;

    }

}

function revokeMediaObjectUrl(id) {

    const url = mediaObjectUrls.get(id);

    if (url) {

        URL.revokeObjectURL(url);
        mediaObjectUrls.delete(id);

    }

}

function revokeAllMediaObjectUrls() {

    mediaObjectUrls.forEach(url => {
        URL.revokeObjectURL(url);
    });

    mediaObjectUrls.clear();

}

