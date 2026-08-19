/* =========================================================
   15-media-upload.js
   Fotoğraf sıkıştırma/küçük resim, fotoğraf yükleme, ses yükleme, medya silme.
   ========================================================= */

/* =========================================================
   MEDYA — FOTOĞRAF SIKIŞTIRMA / KÜÇÜK RESİM

   Büyük fotoğraflar canvas üzerinden hem ana görsel
   (maks. 1920px, JPEG/WEBP ~%82 kalite) hem de ayrı bir
   küçük resim (maks. 480px) olarak yeniden kodlanır.
   Grid HER ZAMAN küçük resmi kullanır; tam boy görsel
   yalnızca detay modalı açıldığında okunur.
   ========================================================= */

function loadImageFromFile(file) {

    return new Promise((resolve, reject) => {

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Görsel okunamadı."));
        };

        img.src = url;

    });

}

function canvasToBlob(canvas, mimeType, quality) {

    return new Promise((resolve, reject) => {

        canvas.toBlob(
            blob => {

                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Görsel sıkıştırılamadı."));
                }

            },
            mimeType,
            quality
        );

    });

}

function resizeImageToBlob(img, maxDimension, mimeType, quality) {

    const largestSide =
        Math.max(img.naturalWidth, img.naturalHeight) || 1;

    const scale =
        Math.min(1, maxDimension / largestSide);

    const width =
        Math.max(1, Math.round(img.naturalWidth * scale));

    const height =
        Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    return canvasToBlob(canvas, mimeType, quality)
        .then(blob => ({ blob, width, height }));

}

/*
 * Minimal, bağımlılıksız EXIF tarih okuyucu — yalnızca
 * JPEG dosyalarında DateTimeOriginal (0x9003, genelde
 * ExifIFD alt bloğunda) ya da DateTime (0x0132) etiketini
 * arar. Bulamazsa veya format tanınmazsa sessizce null
 * döner; hata fırlatmaz (bkz. görev maddesi 1 — "mümkünse").
 */
async function readExifCapturedAt(file) {

    if (file.type !== "image/jpeg") {
        return null;
    }

    try {

        const buffer =
            await file.slice(0, 128 * 1024).arrayBuffer();

        const view = new DataView(buffer);

        if (view.getUint16(0) !== 0xFFD8) {
            return null;
        }

        let offset = 2;

        while (offset < view.byteLength - 4) {

            const marker = view.getUint16(offset);

            if (marker === 0xFFE1) {

                const exifStart = offset + 4;

                if (
                    view.getUint32(exifStart) !== 0x45786966
                ) {
                    return null;
                }

                return parseExifDate(view, exifStart + 6);

            }

            if ((marker & 0xFF00) !== 0xFF00) {
                break;
            }

            offset += 2 + view.getUint16(offset + 2);

        }

    } catch (error) {

        console.warn("EXIF okunamadı:", error);

    }

    return null;

}

function parseExifDate(view, tiffStart) {

    const little =
        view.getUint16(tiffStart) === 0x4949;

    const ifdOffset =
        view.getUint32(tiffStart + 4, little);

    return findExifDateInIfd(
        view,
        tiffStart,
        tiffStart + ifdOffset,
        little
    );

}

function findExifDateInIfd(view, tiffStart, ifdStart, little) {

    const entryCount =
        view.getUint16(ifdStart, little);

    for (let i = 0; i < entryCount; i++) {

        const entryOffset = ifdStart + 2 + i * 12;
        const tag = view.getUint16(entryOffset, little);

        if (tag === 0x9003 || tag === 0x0132) {

            const valueOffset =
                view.getUint32(entryOffset + 8, little) +
                tiffStart;

            const chars = [];

            for (let j = 0; j < 19; j++) {

                const code =
                    view.getUint8(valueOffset + j);

                if (code === 0) {
                    break;
                }

                chars.push(String.fromCharCode(code));

            }

            const match =
                chars.join("").match(
                    /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
                );

            if (match) {

                return (
                    `${match[1]}-${match[2]}-${match[3]}` +
                    `T${match[4]}:${match[5]}:${match[6]}`
                );

            }

        }

        /*
         * ExifIFD işaretçisi — DateTimeOriginal genelde
         * ana IFD0'da değil bu alt blokta bulunur.
         */
        if (tag === 0x8769) {

            const subIfdOffset =
                view.getUint32(entryOffset + 8, little) +
                tiffStart;

            const nested =
                findExifDateInIfd(
                    view,
                    tiffStart,
                    subIfdOffset,
                    little
                );

            if (nested) {
                return nested;
            }

        }

    }

    return null;

}

function readAudioDuration(file) {

    return new Promise(resolve => {

        try {

            const audio = document.createElement("audio");
            const url = URL.createObjectURL(file);

            const cleanup = () => {
                URL.revokeObjectURL(url);
            };

            audio.preload = "metadata";

            audio.onloadedmetadata = () => {

                const duration =
                    Number.isFinite(audio.duration)
                        ? audio.duration
                        : null;

                cleanup();
                resolve(duration);

            };

            audio.onerror = () => {
                cleanup();
                resolve(null);
            };

            audio.src = url;

        } catch (error) {
            resolve(null);
        }

    });

}

/* =========================================================
   MEDYA — YÜKLEME (FOTOĞRAF)
   ========================================================= */

async function handlePhotoFiles(fileList, dayKeyOverride) {

    if (!fileList || fileList.length === 0) {
        return;
    }

    if (!mediaDbAvailable) {

        setMediaUploadStatus(
            "Medya depolama bu tarayıcıda kullanılamıyor."
        );

        return;

    }

    const files = Array.from(fileList);

    for (const file of files) {

        await uploadSinglePhoto(file, dayKeyOverride);

    }

    const photoInput = $("#media-photo-input");
    const dayPanelInput = $("#day-panel-media-input");

    if (photoInput) {
        photoInput.value = "";
    }

    if (dayPanelInput) {
        dayPanelInput.value = "";
    }

}

async function uploadSinglePhoto(file, dayKeyOverride) {

    setMediaUploadStatus(`Yükleniyor: ${file.name}...`);

    if (!MEDIA_ALLOWED_PHOTO_TYPES.has(file.type)) {

        setMediaUploadStatus(
            `${file.name}: Desteklenmeyen fotoğraf formatı.`
        );

        return;

    }

    if (file.size > MEDIA_MAX_PHOTO_BYTES) {

        setMediaUploadStatus(
            `${file.name}: Dosya çok büyük ` +
            `(limit ${formatFileSize(MEDIA_MAX_PHOTO_BYTES)}).`
        );

        return;

    }

    try {

        const hash = await computeFileHash(file);
        const duplicate = findDuplicateByHash(hash);

        if (duplicate) {

            setMediaUploadStatus(
                `${file.name}: Bu fotoğraf zaten yüklü, atlandı.`
            );

            return;

        }

        const [capturedAt, img] =
            await Promise.all([
                readExifCapturedAt(file),
                loadImageFromFile(file)
            ]);

        /*
         * Canvas GIF animasyonunu koruyamaz (tek kareye
         * indirger); bu yüzden GIF girişleri PNG olarak
         * yeniden kodlanıyor — en azından görsel kaybolmuyor.
         */
        const mainMime =
            file.type === "image/gif"
                ? "image/png"
                : file.type;

        const [main, thumb] =
            await Promise.all([
                resizeImageToBlob(
                    img,
                    MEDIA_PHOTO_MAX_DIMENSION,
                    mainMime,
                    MEDIA_PHOTO_QUALITY
                ),
                resizeImageToBlob(
                    img,
                    MEDIA_THUMB_MAX_DIMENSION,
                    mainMime,
                    MEDIA_THUMB_QUALITY
                )
            ]);

        const id = createId();
        const now = new Date().toISOString();

        const dayKey =
            dayKeyOverride ||
            (capturedAt ? capturedAt.slice(0, 10) : now.slice(0, 10));

        const meta = {
            id,
            type: "photo",
            dayKey,
            originalFilename: file.name,
            mimeType: main.blob.type,
            size: main.blob.size,
            createdAt: now,
            capturedAt: capturedAt || null,
            contentHash: hash,
            width: main.width,
            height: main.height,
            durationSeconds: null,
            ocrText: null,
            ocrStatus: "idle"
        };

        await mediaMetaPut(meta);

        await mediaBlobPut({
            id,
            blob: main.blob,
            thumbBlob: thumb.blob
        });

        mediaMetaList.unshift(meta);

        mediaMetaList.sort(
            (a, b) =>
                mediaEffectiveDate(b).localeCompare(
                    mediaEffectiveDate(a)
                )
        );

        setMediaUploadStatus(`${file.name} yüklendi.`);

        renderMediaPage();
        renderDayPanelMedia();

        runOcrForRecord(id);

    } catch (error) {

        console.error("Fotoğraf yüklenemedi:", error);

        setMediaUploadStatus(
            `${file.name}: Yükleme başarısız oldu.`
        );

    }

}

/* =========================================================
   MEDYA — YÜKLEME (SES)
   ========================================================= */

async function handleAudioFiles(fileList) {

    if (!fileList || fileList.length === 0) {
        return;
    }

    if (!mediaDbAvailable) {

        setMediaUploadStatus(
            "Medya depolama bu tarayıcıda kullanılamıyor."
        );

        return;

    }

    const files = Array.from(fileList);

    for (const file of files) {

        await uploadSingleAudio(file);

    }

    const audioInput = $("#media-audio-input");

    if (audioInput) {
        audioInput.value = "";
    }

}

async function uploadSingleAudio(file) {

    setMediaUploadStatus(`Yükleniyor: ${file.name}...`);

    const isAllowedType =
        MEDIA_ALLOWED_AUDIO_TYPES.has(file.type) ||
        /\.(mp3|m4a|wav|ogg|webm|aac)$/i.test(file.name);

    if (!isAllowedType) {

        setMediaUploadStatus(
            `${file.name}: Desteklenmeyen ses formatı.`
        );

        return;

    }

    if (file.size > MEDIA_MAX_AUDIO_BYTES) {

        setMediaUploadStatus(
            `${file.name}: Dosya çok büyük ` +
            `(limit ${formatFileSize(MEDIA_MAX_AUDIO_BYTES)}).`
        );

        return;

    }

    try {

        const hash = await computeFileHash(file);
        const duplicate = findDuplicateByHash(hash);

        if (duplicate) {

            setMediaUploadStatus(
                `${file.name}: Bu ses kaydı zaten yüklü, atlandı.`
            );

            return;

        }

        const durationSeconds = await readAudioDuration(file);

        const id = createId();
        const now = new Date().toISOString();

        const meta = {
            id,
            type: "audio",
            dayKey: now.slice(0, 10),
            originalFilename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            createdAt: now,
            capturedAt: null,
            contentHash: hash,
            width: null,
            height: null,
            durationSeconds,
            ocrText: null,
            ocrStatus: "idle"
        };

        await mediaMetaPut(meta);

        await mediaBlobPut({
            id,
            blob: file,
            thumbBlob: null
        });

        mediaMetaList.unshift(meta);

        mediaMetaList.sort(
            (a, b) =>
                mediaEffectiveDate(b).localeCompare(
                    mediaEffectiveDate(a)
                )
        );

        setMediaUploadStatus(`${file.name} yüklendi.`);

        renderMediaPage();
        renderDayPanelMedia();

    } catch (error) {

        console.error("Ses yüklenemedi:", error);

        setMediaUploadStatus(
            `${file.name}: Yükleme başarısız oldu.`
        );

    }

}

/* =========================================================
   MEDYA — SİLME
   ========================================================= */

async function deleteMediaRecord(id) {

    try {

        await mediaMetaDelete(id);
        await mediaBlobDelete(id);

    } catch (error) {

        console.error("Medya silinemedi:", error);

        setMediaUploadStatus("Silme işlemi başarısız oldu.");

        return;

    }

    mediaMetaList =
        mediaMetaList.filter(item => item.id !== id);

    revokeMediaObjectUrl(id);

    if (openMediaId === id) {
        closeMediaModal();
    }

    renderMediaPage();
    renderDayPanelMedia();

}

