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

        const result =
            await Tesseract.recognize(
                blobRecord.blob,
                "tur",
                { logger: () => {} }
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

