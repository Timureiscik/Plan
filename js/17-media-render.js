/* =========================================================
   17-media-render.js
   Medya ay grupları, fotoğraflar/sesler sekmesi render, gün paneli medya entegrasyonu, fotoğraf detay modalı, sekme/olay dinleyicileri.
   ========================================================= */

/* =========================================================
   MEDYA — AY GRUPLARI (FOTOĞRAF ARŞİVİ)
   ========================================================= */

function computeMediaPhotoMonthGroups() {

    const groups = new Map();

    mediaMetaList
        .filter(item => item.type === "photo")
        .forEach(item => {

            const monthKey =
                mediaMonthKey(mediaEffectiveDate(item));

            if (!groups.has(monthKey)) {
                groups.set(monthKey, []);
            }

            groups.get(monthKey).push(item);

        });

    return Array.from(groups.keys())
        .sort((a, b) => b.localeCompare(a))
        .map(monthKey => ({
            monthKey,
            items:
                groups.get(monthKey).sort(
                    (a, b) =>
                        mediaEffectiveDate(b).localeCompare(
                            mediaEffectiveDate(a)
                        )
                )
        }));

}

/* =========================================================
   MEDYA — RENDER (FOTOĞRAFLAR SEKMESİ)
   ========================================================= */

function renderMediaPage() {

    const photosGroupsEl = $("#media-photo-groups");
    const loadMoreBtn = $("#media-load-more-months");

    if (photosGroupsEl) {

        revokeAllMediaObjectUrls();

        photosGroupsEl.innerHTML = "";

        if (!mediaDbAvailable) {

            photosGroupsEl.innerHTML = `
                <div class="empty-state compact">
                    <div class="empty-icon">🖼</div>
                    <h3>Medya depolama kullanılamıyor</h3>
                    <p>Bu tarayıcıda fotoğraf ve ses özellikleri çalışmıyor.</p>
                </div>
            `;

            if (loadMoreBtn) {
                loadMoreBtn.hidden = true;
            }

        } else {

            const groups = computeMediaPhotoMonthGroups();

            if (groups.length === 0) {

                photosGroupsEl.innerHTML = `
                    <div class="empty-state compact">
                        <div class="empty-icon">📷</div>
                        <h3>Henüz fotoğraf yok</h3>
                        <p>Yukarıdan bir fotoğraf yükleyerek başlayabilirsin.</p>
                    </div>
                `;

                if (loadMoreBtn) {
                    loadMoreBtn.hidden = true;
                }

            } else {

                const visibleGroups =
                    groups.slice(0, visibleMonthCount);

                visibleGroups.forEach(group => {
                    renderMediaMonthGroup(photosGroupsEl, group);
                });

                if (loadMoreBtn) {

                    loadMoreBtn.hidden =
                        visibleGroups.length >= groups.length;

                }

            }

        }

    }

    renderAudioList();

    /*
     * Medya bazlı rozetler mediaMetaList'ten türetildiği için,
     * yükleme ve silme sonrası mevcut rozet render/feedback akışını
     * da yenile. İlk IndexedDB yüklemesinde kutlama seed'i
     * 02-init.js'te tamamlanır.
     */
    if (typeof renderBadges === "function") {
        renderBadges();
    }

}

function renderMediaMonthGroup(container, group) {

    const section = document.createElement("div");
    section.className = "media-month-group";

    const header = document.createElement("div");
    header.className = "media-month-group-header";

    header.innerHTML = `
        <h3>${escapeHtml(formatMonthKeyTitle(group.monthKey))}</h3>
        <span class="media-month-group-count">
            ${group.items.length} fotoğraf
        </span>
    `;

    section.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "media-grid";

    group.items.forEach(item => {

        const thumb = document.createElement("div");
        thumb.className = "media-thumb";
        thumb.dataset.mediaId = item.id;

        const img = document.createElement("img");
        img.alt = item.originalFilename || "Fotoğraf";
        img.loading = "lazy";

        thumb.appendChild(img);

        const dayBadge = document.createElement("span");
        dayBadge.className = "media-thumb-day";
        dayBadge.textContent = formatShortDayLabel(item.dayKey);

        thumb.appendChild(dayBadge);

        if (item.ocrStatus === "done" && item.ocrText) {

            const ocrFlag = document.createElement("span");
            ocrFlag.className = "media-thumb-ocr-flag";
            ocrFlag.title = "Bu fotoğrafta OCR metni var";
            ocrFlag.textContent = "T";

            thumb.appendChild(ocrFlag);

        }

        grid.appendChild(thumb);

        loadThumbInto(item.id, img);

    });

    section.appendChild(grid);
    container.appendChild(section);

}

function loadThumbInto(id, imgEl) {

    mediaBlobGet(id)
        .then(record => {

            if (!record) {
                return;
            }

            const source = record.thumbBlob || record.blob;

            if (!source) {
                return;
            }

            const url = URL.createObjectURL(source);

            mediaObjectUrls.set(id, url);
            imgEl.src = url;

        })
        .catch(error => {
            console.warn("Küçük görsel yüklenemedi:", error);
        });

}

/* =========================================================
   MEDYA — RENDER (SESLER SEKMESİ)
   ========================================================= */

function renderAudioList() {

    const container = $("#media-audio-list");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!mediaDbAvailable) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🖼</div>
                <h3>Medya depolama kullanılamıyor</h3>
                <p>Bu tarayıcıda fotoğraf ve ses özellikleri çalışmıyor.</p>
            </div>
        `;

        return;

    }

    const audioItems =
        mediaMetaList.filter(item => item.type === "audio");

    if (audioItems.length === 0) {

        container.innerHTML = `
            <div class="empty-state compact">
                <div class="empty-icon">🎙</div>
                <h3>Henüz ses kaydı yok</h3>
                <p>Yukarıdan bir dosya yükleyebilir ya da mikrofonla kaydedebilirsin.</p>
            </div>
        `;

        return;

    }

    audioItems.forEach(item => {

        const row = document.createElement("div");
        row.className = "audio-item";
        row.dataset.mediaId = item.id;

        row.innerHTML = `
            <span class="audio-item-icon">♪</span>
            <div class="audio-item-info">
                <div class="audio-item-name">
                    ${escapeHtml(item.originalFilename || "Ses kaydı")}
                </div>
                <div class="audio-item-meta">
                    ${escapeHtml(formatShortDayLabel(item.dayKey))} ·
                    ${formatDuration(item.durationSeconds)} ·
                    ${formatFileSize(item.size)}
                </div>
            </div>
            <audio class="audio-item-player" controls preload="none"></audio>
            <button
                type="button"
                class="audio-item-delete"
                data-action="delete-audio"
                data-media-id="${escapeHtml(item.id)}"
                title="Sil"
                aria-label="Sil"
            >×</button>
        `;

        container.appendChild(row);

        loadAudioBlobInto(
            item.id,
            row.querySelector("audio")
        );

    });

}

function loadAudioBlobInto(id, audioEl) {

    if (!audioEl) {
        return;
    }

    mediaBlobGet(id)
        .then(record => {

            if (!record || !record.blob) {
                return;
            }

            const url = URL.createObjectURL(record.blob);

            mediaObjectUrls.set(id, url);
            audioEl.src = url;

        })
        .catch(error => {
            console.warn("Ses dosyası yüklenemedi:", error);
        });

}

/* =========================================================
   MEDYA — RENDER (GÜN PANELİ ENTEGRASYONU)

   Bir fotoğraf/ses o günün dayKey'ine bağlıysa gün
   panelinde küçük bir önizleme olarak görünür; tıklanınca
   fotoğraf modalı açılır. Mevcut gün paneli sistemine
   (notlar/ödevler/projeler ile aynı desende, ayrı bir
   subcard olarak) hiçbir değişiklik yapılmadan eklenir.
   ========================================================= */

function renderDayPanelMedia() {

    const container = $("#day-panel-media");

    if (!container) {
        return;
    }

    const key = selectedDayKey || effectiveDateKey();

    container.innerHTML = "";

    if (!mediaDbAvailable) {

        container.innerHTML =
            `<div class="day-panel-empty">Medya depolama bu tarayıcıda kullanılamıyor.</div>`;

        return;

    }

    const items =
        mediaMetaList.filter(item => item.dayKey === key);

    if (items.length === 0) {

        container.innerHTML =
            `<div class="day-panel-empty">Bu güne eklenmiş fotoğraf/ses yok.</div>`;

        return;

    }

    items.forEach(item => {

        const thumb = document.createElement("div");

        if (item.type === "photo") {

            thumb.className = "day-panel-media-thumb";
            thumb.dataset.mediaId = item.id;
            thumb.title = item.originalFilename || "Fotoğraf";

            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";

            thumb.appendChild(img);

            loadThumbInto(item.id, img);

        } else {

            thumb.className = "day-panel-media-thumb is-audio";
            thumb.title = item.originalFilename || "Ses kaydı";
            thumb.textContent = "♪";

        }

        container.appendChild(thumb);

    });

}

/* =========================================================
   MEDYA — DETAY MODALI (FOTOĞRAF)
   ========================================================= */

function openMediaModal(id) {

    const meta =
        mediaMetaList.find(item => item.id === id);

    if (!meta) {
        return;
    }

    openMediaId = id;

    const modal = $("#media-modal");
    const imgEl = $("#media-modal-image");

    if (mediaModalObjectUrl) {

        URL.revokeObjectURL(mediaModalObjectUrl);
        mediaModalObjectUrl = null;

    }

    if (imgEl) {

        imgEl.src = "";
        imgEl.alt = meta.originalFilename || "Fotoğraf";

    }

    renderMediaModalDetails(meta);
    renderMediaModalOcr(meta);

    openModal(modal);

    mediaBlobGet(id)
        .then(record => {

            if (
                !record ||
                !record.blob ||
                openMediaId !== id
            ) {
                return;
            }

            const url = URL.createObjectURL(record.blob);
            mediaModalObjectUrl = url;

            if (imgEl) {
                imgEl.src = url;
            }

        })
        .catch(error => {
            console.warn("Fotoğraf yüklenemedi:", error);
        });

}

function closeMediaModal() {

    closeModal($("#media-modal"));

    if (mediaModalObjectUrl) {

        URL.revokeObjectURL(mediaModalObjectUrl);
        mediaModalObjectUrl = null;

    }

    openMediaId = null;

}

function renderMediaModalDetails(meta) {

    const container = $("#media-modal-details");

    if (!container) {
        return;
    }

    const capturedLabel =
        meta.capturedAt
            ? formatFullDateTime(meta.capturedAt)
            : "Bilinmiyor";

    const uploadedLabel =
        formatFullDateTime(meta.createdAt);

    const dayLabel =
        formatFullDayLabel(meta.dayKey);

    const sizeLabel =
        meta.type === "photo"
            ? `${formatFileSize(meta.size)} · ${meta.width || "-"}×${meta.height || "-"}`
            : `${formatFileSize(meta.size)} · ${formatDuration(meta.durationSeconds)}`;

    container.innerHTML = `
        <div class="media-detail-row">
            <span>Çekilme tarihi</span>
            <strong>${escapeHtml(capturedLabel)}</strong>
        </div>
        <div class="media-detail-row">
            <span>Yüklenme tarihi</span>
            <strong>${escapeHtml(uploadedLabel)}</strong>
        </div>
        <div class="media-detail-row">
            <span>Bağlı gün</span>
            <strong>${escapeHtml(dayLabel)}</strong>
        </div>
        <div class="media-detail-row">
            <span>Dosya</span>
            <strong>${escapeHtml(meta.originalFilename || "-")} · ${sizeLabel}</strong>
        </div>
    `;

}

function renderMediaModalOcr(meta) {

    const textEl = $("#media-ocr-text");
    const copyBtn = $("#media-ocr-copy");

    if (!textEl) {
        return;
    }

    textEl.classList.remove("is-muted");

    if (meta.ocrStatus === "pending") {

        textEl.textContent = "Yazı taranıyor...";
        textEl.classList.add("is-muted");

        if (copyBtn) {
            copyBtn.hidden = true;
        }

    } else if (meta.ocrStatus === "failed") {

        textEl.textContent =
            "Bu fotoğraftan yazı okunamadı.";

        textEl.classList.add("is-muted");

        if (copyBtn) {
            copyBtn.hidden = true;
        }

    } else if (meta.ocrStatus === "done" && meta.ocrText) {

        textEl.textContent = meta.ocrText;

        if (copyBtn) {
            copyBtn.hidden = false;
        }

    } else {

        textEl.textContent =
            "Bu fotoğrafta okunabilir bir yazı bulunamadı.";

        textEl.classList.add("is-muted");

        if (copyBtn) {
            copyBtn.hidden = true;
        }

    }

}

/* =========================================================
   MEDYA — SEKME VE OLAY DİNLEYİCİLERİ
   ========================================================= */

function setupMediaPage() {

    on(
        "#media-photo-input",
        "change",
        event => {
            handlePhotoFiles(event.target.files, null);
        }
    );

    on(
        "#media-audio-input",
        "change",
        event => {
            handleAudioFiles(event.target.files);
        }
    );

    on(
        "#day-panel-media-input",
        "change",
        event => {

            handlePhotoFiles(
                event.target.files,
                selectedDayKey || effectiveDateKey()
            );

        }
    );

    on(
        "#media-load-more-months",
        "click",
        () => {

            visibleMonthCount += MEDIA_MONTHS_PAGE_SIZE;
            renderMediaPage();

        }
    );

    on("#close-media-modal", "click", closeMediaModal);
    on("#media-modal-close-button", "click", closeMediaModal);

    on(
        "#media-modal-delete",
        "click",
        () => {

            if (openMediaId) {
                confirmMediaDeletion(openMediaId);
            }

        }
    );

    on(
        "#media-ocr-copy",
        "click",
        () => {

            const meta =
                mediaMetaList.find(
                    item => item.id === openMediaId
                );

            if (!meta || !meta.ocrText) {
                return;
            }

            if (
                navigator.clipboard &&
                navigator.clipboard.writeText
            ) {

                navigator.clipboard
                    .writeText(meta.ocrText)
                    .catch(error =>
                        console.warn("Kopyalanamadı:", error)
                    );

            }

        }
    );

    document.addEventListener(
        "click",
        event => {

            if (event.target === $("#media-modal")) {
                closeMediaModal();
            }

        }
    );

    delegate(
        "#media-photo-groups",
        "click",
        ".media-thumb",
        element => {

            if (element.dataset.mediaId) {
                openMediaModal(element.dataset.mediaId);
            }

        }
    );

    delegate(
        "#day-panel-media",
        "click",
        ".day-panel-media-thumb:not(.is-audio)",
        element => {

            if (element.dataset.mediaId) {
                openMediaModal(element.dataset.mediaId);
            }

        }
    );

    delegate(
        "#media-audio-list",
        "click",
        "[data-action='delete-audio']",
        element => {

            if (element.dataset.mediaId) {
                confirmMediaDeletion(element.dataset.mediaId);
            }

        }
    );

    $$("#page-media .media-tab").forEach(tab => {

        tab.addEventListener("click", () => {

            activeMediaTab = tab.dataset.mediaTab;

            $$("#page-media .media-tab").forEach(button => {

                button.classList.toggle(
                    "active",
                    button === tab
                );

            });

            $$("#page-media .media-panel").forEach(panel => {

                const isPhotosPanel =
                    panel.id === "media-photos-panel";

                panel.classList.toggle(
                    "active",
                    (activeMediaTab === "photos") === isPhotosPanel
                );

            });

        });

    });

}

function confirmMediaDeletion(id) {

    const media =
        mediaMetaList.find(item => item.id === id);

    if (!media) {
        return;
    }

    openConfirmModal({
        title: "Medyayı sil",
        message:
            `"${media.originalFilename}" öğesini silmek istediğine emin misin?`,
        confirmLabel: "Sil",
        onConfirm: () => deleteMediaRecord(id)
    });

}
