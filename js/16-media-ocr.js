/* =========================================================
   16-media-ocr.js
   Medya OCR (Tesseract.js, tembel yükleme).
   ========================================================= */

/* =========================================================
   MEDYA — OCR (TESSERACT.JS, TEMBEL YÜKLEME)

   Modüler tasarım notu: OCR motoruyla ilgili tüm mantık
   yalnızca bu iki fonksiyonda (loadTesseract, runOcrForRecord)
   toplanmıştır. İleride farklı bir OCR servisine geçilmek
   istenirse yalnızca bu iki fonksiyon değiştirilir — meta
   kaydındaki ocrText/ocrStatus alanları ve bunları kullanan
   render fonksiyonları (renderMediaModalOcr, grid'deki "T"
   rozeti) hiç değişmeden kalır.
   ========================================================= */

function loadTesseract() {

    if (window.Tesseract) {
        return Promise.resolve(window.Tesseract);
    }

    if (tesseractLoadPromise) {
        return tesseractLoadPromise;
    }

    tesseractLoadPromise = new Promise((resolve, reject) => {

        const script = document.createElement("script");

        script.src = TESSERACT_CDN_URL;
        script.async = true;

        script.onload = () => {

            if (window.Tesseract) {
                resolve(window.Tesseract);
            } else {
                reject(new Error("Tesseract.js yüklenemedi."));
            }

        };

        script.onerror = () => {
            reject(new Error("Tesseract.js yüklenemedi."));
        };

        document.head.appendChild(script);

    });

    return tesseractLoadPromise;

}

async function runOcrForRecord(id) {

    const meta =
        mediaMetaList.find(item => item.id === id);

    if (!meta || meta.type !== "photo") {
        return;
    }

    meta.ocrStatus = "pending";

    renderMediaPage();

    if (openMediaId === id) {
        renderMediaModalOcr(meta);
    }

    try {

        const Tesseract = await loadTesseract();
        const blobRecord = await mediaBlobGet(id);

        if (!blobRecord || !blobRecord.blob) {
            throw new Error("Görsel bulunamadı.");
        }

        /*
         * langPath BİLEREK açıkça veriliyor — Tesseract.js'in
         * varsayılan langPath'i (tessdata.projectnaptha.com)
         * Plan.html'deki CSP'nin connect-src listesinde yok
         * ve YENİ BİR HOST eklememek için oraya da
         * eklenmiyor. Bunun yerine, script/core dosyalarıyla
         * (TESSERACT_CDN_URL) aynı zaten-güvenilir
         * cdn.jsdelivr.net üzerinden servis edilen dil verisi
         * kullanılıyor (bkz. TESSERACT_LANG_PATH —
         * 14-media-core.js). Bu satır olmadan dil verisi
         * fetch'i CSP tarafından sessizce engellenir ve OCR
         * her zaman "failed" durumuna düşer.
         */
        const result =
            await Tesseract.recognize(
                blobRecord.blob,
                "tur",
                {
                    logger: () => {},
                    langPath: TESSERACT_LANG_PATH
                }
            );

        const text =
            result &&
            result.data &&
            typeof result.data.text === "string"
                ? result.data.text.trim()
                : "";

        meta.ocrText = text || null;
        meta.ocrStatus = "done";

        await mediaMetaPut(meta);

    } catch (error) {

        /*
         * OCR başarısızlığı (CDN'e erişilemedi, tarama
         * hata verdi, dosya bozuk vb.) uygulamayı hiçbir
         * şekilde çökertmez; yalnızca durum "failed" olarak
         * işaretlenir ve kullanıcıya modalda düzgün bir
         * mesaj gösterilir (bkz. renderMediaModalOcr).
         */

        console.warn(
            `OCR başarısız oldu (${id}):`,
            error
        );

        meta.ocrStatus = "failed";
        meta.ocrText = null;

        try {
            await mediaMetaPut(meta);
        } catch (saveError) {
            console.warn(
                "OCR durumu kaydedilemedi:",
                saveError
            );
        }

    }

    renderMediaPage();

    if (openMediaId === id) {
        renderMediaModalOcr(meta);
    }

}
