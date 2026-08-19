/* =========================================================
   19-media-record.js
   Tarayıcı içinden mikrofonla ses kaydı (MediaRecorder).

   Mevcut ses yükleme sistemine (bkz. 14-media-core.js /
   15-media-upload.js) hiçbir şekilde dokunmaz; yalnızca
   kayıt bittiğinde uploadSingleAudio() ile TAMAMEN AYNI
   meta yapısını üretip aynı mediaMetaPut()/mediaBlobPut()
   çağrılarıyla aynı IndexedDB object store'larına yazar.
   Bu sayede kaydedilen sesler, dosyadan yüklenen seslerle
   render/silme/oynatma tarafında hiçbir ek koşula ihtiyaç
   duymadan aynı şekilde davranır (bkz. renderAudioList,
   deleteMediaRecord — hiç değiştirilmedi).
   ========================================================= */

/* =========================================================
   KAYIT DURUMU (yalnızca bu modüle özel state)
   ========================================================= */

let mediaRecorderInstance = null;
let mediaRecorderStream = null;
let mediaRecorderChunks = [];
let mediaRecorderMimeType = null;
let mediaRecorderState = "idle";
/* idle | requesting | recording | paused | recorded | unsupported */

let mediaRecorderStartTime = null;
let mediaRecorderElapsedMs = 0;
let mediaRecorderTimerInterval = null;
let mediaRecorderResultBlob = null;
let mediaRecorderPlaybackUrl = null;

/* =========================================================
   TARAYICI DESTEĞİ
   ========================================================= */

function isRecordingSupported() {

    return !!(
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === "function" &&
        typeof window.MediaRecorder !== "undefined"
    );

}

/*
 * Gereksiz bir bağımlılık eklemeden, tarayıcının zaten
 * desteklediği formatlardan en uygununu seçer. Hiçbiri
 * raporlanmazsa (örn. isTypeSupported yoksa) tarayıcının
 * kendi varsayılanı kullanılır (options geçilmez).
 */
function pickAudioMimeType() {

    if (
        typeof MediaRecorder === "undefined" ||
        typeof MediaRecorder.isTypeSupported !== "function"
    ) {
        return null;
    }

    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/ogg"
    ];

    for (const type of candidates) {

        try {

            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }

        } catch (error) {
            /* isTypeSupported bazı eski tarayıcılarda fırlatabilir — yoksay */
        }

    }

    return null;

}

function audioExtensionForMime(mimeType) {

    const type = (mimeType || "").toLowerCase();

    if (type.includes("mp4")) return "m4a";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("wav")) return "wav";
    if (type.includes("webm")) return "webm";

    return "audio";

}

/* =========================================================
   ZAMANLAYICI
   ========================================================= */

function formatRecordElapsed(totalSeconds) {

    const total = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;

    return (
        `${String(minutes).padStart(2, "0")}:` +
        `${String(secs).padStart(2, "0")}`
    );

}

function currentElapsedMs() {

    if (mediaRecorderState === "recording" && mediaRecorderStartTime) {

        return (
            mediaRecorderElapsedMs +
            (Date.now() - mediaRecorderStartTime)
        );

    }

    return mediaRecorderElapsedMs;

}

function updateRecordTimerDisplay() {

    const el = $("#record-timer");

    if (!el) {
        return;
    }

    el.textContent =
        formatRecordElapsed(currentElapsedMs() / 1000);

}

function startRecordTimer() {

    stopRecordTimerInterval();

    updateRecordTimerDisplay();

    mediaRecorderTimerInterval =
        setInterval(updateRecordTimerDisplay, 250);

}

function stopRecordTimerInterval() {

    if (mediaRecorderTimerInterval) {

        clearInterval(mediaRecorderTimerInterval);
        mediaRecorderTimerInterval = null;

    }

}

/* =========================================================
   HATA / DURUM GÖSTERİMİ
   ========================================================= */

function showRecordError(message) {

    const box = $("#record-error");

    if (!box) {
        return;
    }

    box.textContent = message;
    box.hidden = false;

}

function hideRecordError() {

    const box = $("#record-error");

    if (!box) {
        return;
    }

    box.hidden = true;
    box.textContent = "";

}

function setRecordState(state) {

    mediaRecorderState = state;

    renderRecordModalUI();
    updateRecordTimerDisplay();

}

function renderRecordModalUI() {

    const startBtn = $("#record-start");
    const pauseBtn = $("#record-pause");
    const stopBtn = $("#record-stop");
    const rerecordBtn = $("#record-rerecord");
    const saveBtn = $("#record-save");
    const indicator = $("#record-indicator");
    const indicatorLabel = $("#record-indicator-label");

    const pauseSupported =
        !!(
            mediaRecorderInstance &&
            typeof mediaRecorderInstance.pause === "function"
        );

    [startBtn, pauseBtn, stopBtn, rerecordBtn].forEach(button => {

        if (button) {
            button.hidden = true;
        }

    });

    if (startBtn) {
        startBtn.disabled = false;
    }

    if (saveBtn) {

        saveBtn.hidden = true;
        saveBtn.disabled = true;

    }

    if (indicator) {

        indicator.classList.toggle(
            "is-live",
            mediaRecorderState === "recording"
        );

    }

    if (mediaRecorderState === "unsupported") {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Desteklenmiyor";
        }

        if (startBtn) {

            startBtn.hidden = false;
            startBtn.disabled = true;

        }

        showRecordError(
            "Bu tarayıcı mikrofon kaydını desteklemiyor. " +
            "Bunun yerine bir ses dosyası yükleyebilirsin."
        );

    } else if (mediaRecorderState === "requesting") {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Mikrofon isteniyor...";
        }

        if (startBtn) {

            startBtn.hidden = false;
            startBtn.disabled = true;

        }

    } else if (mediaRecorderState === "recording") {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Kaydediliyor";
        }

        if (stopBtn) {
            stopBtn.hidden = false;
        }

        if (pauseBtn && pauseSupported) {

            pauseBtn.hidden = false;
            pauseBtn.textContent = "⏸ Duraklat";

        }

    } else if (mediaRecorderState === "paused") {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Duraklatıldı";
        }

        if (stopBtn) {
            stopBtn.hidden = false;
        }

        if (pauseBtn) {

            pauseBtn.hidden = false;
            pauseBtn.textContent = "▶ Devam et";

        }

    } else if (mediaRecorderState === "recorded") {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Kayıt tamam";
        }

        if (rerecordBtn) {
            rerecordBtn.hidden = false;
        }

        if (saveBtn) {

            saveBtn.hidden = false;
            saveBtn.disabled = false;

        }

    } else {

        if (indicatorLabel) {
            indicatorLabel.textContent = "Hazır";
        }

        if (startBtn) {
            startBtn.hidden = false;
        }

    }

}

/* =========================================================
   MİKROFON / KAYIT AKIŞI
   ========================================================= */

function stopMediaStream() {

    if (mediaRecorderStream) {

        mediaRecorderStream.getTracks().forEach(track => {
            track.stop();
        });

        mediaRecorderStream = null;

    }

}

function revokeRecordPlaybackUrl() {

    if (mediaRecorderPlaybackUrl) {

        URL.revokeObjectURL(mediaRecorderPlaybackUrl);
        mediaRecorderPlaybackUrl = null;

    }

}

async function startRecording() {

    hideRecordError();

    if (!isRecordingSupported()) {

        setRecordState("unsupported");

        return;

    }

    setRecordState("requesting");

    try {

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        mediaRecorderStream = stream;

        const mimeType = pickAudioMimeType();

        let recorder;

        try {

            recorder =
                mimeType
                    ? new MediaRecorder(stream, { mimeType })
                    : new MediaRecorder(stream);

        } catch (error) {

            /*
             * Seçilen mimeType tarayıcı tarafından
             * reddedilirse (nadir), tarayıcı varsayılanıyla
             * tekrar dene — kayıt tamamen başarısız olmasın.
             */
            recorder = new MediaRecorder(stream);

        }

        mediaRecorderInstance = recorder;
        mediaRecorderChunks = [];
        mediaRecorderMimeType =
            recorder.mimeType || mimeType || "audio/webm";

        recorder.ondataavailable = event => {

            if (event.data && event.data.size > 0) {
                mediaRecorderChunks.push(event.data);
            }

        };

        recorder.onstop = () => {
            finalizeRecording();
        };

        recorder.onerror = event => {

            console.warn(
                "Kayıt sırasında hata:",
                event && event.error
                    ? event.error
                    : event
            );

            showRecordError(
                "Kayıt sırasında bir hata oluştu. Lütfen tekrar dene."
            );

            stopRecordTimerInterval();
            stopMediaStream();

            setRecordState("idle");

        };

        mediaRecorderElapsedMs = 0;
        mediaRecorderStartTime = Date.now();

        recorder.start();

        setRecordState("recording");
        startRecordTimer();

    } catch (error) {

        console.warn("Mikrofon erişimi alınamadı:", error);

        let message = "Mikrofona erişilemedi.";

        if (
            error &&
            (
                error.name === "NotAllowedError" ||
                error.name === "PermissionDeniedError" ||
                error.name === "SecurityError"
            )
        ) {

            message =
                "Mikrofon erişimi reddedildi. Kayıt yapabilmek " +
                "için tarayıcı ayarlarından izin vermen gerekiyor.";

        } else if (
            error &&
            (
                error.name === "NotFoundError" ||
                error.name === "DevicesNotFoundError"
            )
        ) {

            message = "Bir mikrofon bulunamadı.";

        }

        showRecordError(message);

        stopMediaStream();

        setRecordState("idle");

    }

}

function togglePauseRecording() {

    if (!mediaRecorderInstance) {
        return;
    }

    if (mediaRecorderState === "recording") {

        if (typeof mediaRecorderInstance.pause !== "function") {
            return;
        }

        try {

            mediaRecorderInstance.pause();

            mediaRecorderElapsedMs +=
                Date.now() - mediaRecorderStartTime;

            mediaRecorderStartTime = null;

            stopRecordTimerInterval();

            setRecordState("paused");

        } catch (error) {

            console.warn("Kayıt duraklatılamadı:", error);

        }

    } else if (mediaRecorderState === "paused") {

        try {

            mediaRecorderInstance.resume();

            mediaRecorderStartTime = Date.now();

            startRecordTimer();

            setRecordState("recording");

        } catch (error) {

            console.warn("Kayıt devam ettirilemedi:", error);

        }

    }

}

function stopRecording() {

    if (!mediaRecorderInstance) {
        return;
    }

    if (mediaRecorderState === "recording" && mediaRecorderStartTime) {

        mediaRecorderElapsedMs +=
            Date.now() - mediaRecorderStartTime;

        mediaRecorderStartTime = null;

    }

    stopRecordTimerInterval();

    try {

        mediaRecorderInstance.stop();

    } catch (error) {

        console.warn("Kayıt durdurulamadı:", error);

        stopMediaStream();

        setRecordState("idle");

    }

}

function finalizeRecording() {

    /*
     * Mikrofon akışı yalnızca kayıt gerçekten durduktan
     * (onstop) sonra serbest bırakılır — böylece son
     * chunk'lar kaybolmaz.
     */
    stopMediaStream();

    const blob =
        new Blob(
            mediaRecorderChunks,
            { type: mediaRecorderMimeType || "audio/webm" }
        );

    mediaRecorderResultBlob = blob;

    revokeRecordPlaybackUrl();

    const url = URL.createObjectURL(blob);
    mediaRecorderPlaybackUrl = url;

    const playback = $("#record-playback");

    if (playback) {

        playback.src = url;
        playback.hidden = false;

    }

    setRecordState("recorded");

}

/* =========================================================
   KAYDI SIFIRLA (yeniden kaydet / modal aç-kapa)
   ========================================================= */

function resetRecordingState() {

    stopRecordTimerInterval();
    stopMediaStream();
    revokeRecordPlaybackUrl();

    if (
        mediaRecorderInstance &&
        (
            mediaRecorderState === "recording" ||
            mediaRecorderState === "paused"
        )
    ) {

        try {

            /*
             * Bu, kullanıcının kaydı kaydetmeden (ör.
             * "Yeniden kaydet" veya modalı kapatarak)
             * vazgeçtiği durumdur — onstop'un blob'u
             * finalize etmesini istemiyoruz.
             */
            mediaRecorderInstance.onstop = null;
            mediaRecorderInstance.stop();

        } catch (error) {
            /* zaten durmuş olabilir — yoksay */
        }

    }

    mediaRecorderInstance = null;
    mediaRecorderChunks = [];
    mediaRecorderResultBlob = null;
    mediaRecorderElapsedMs = 0;
    mediaRecorderStartTime = null;
    mediaRecorderState = "idle";

    const playback = $("#record-playback");

    if (playback) {

        playback.pause();
        playback.removeAttribute("src");
        playback.hidden = true;

    }

    hideRecordError();
    renderRecordModalUI();
    updateRecordTimerDisplay();

}

/* =========================================================
   KAYDI KAYDET (mevcut medya sistemine yazma)

   uploadSingleAudio() (bkz. 15-media-upload.js) ile AYNI
   meta alanlarını üretir; tek fark originalFilename'in
   kayıt anındaki tarih/saatten üretilmesi ve
   durationSeconds'ın dosya meta verisi yerine kayıt
   sırasında ölçülen süreden gelmesidir (MediaRecorder
   çıktısı olan webm/opus blob'ların bazı tarayıcılarda
   <audio>.duration değeri güvenilir okunamıyor — bkz.
   bilinen Chromium sorunu — bu yüzden ölçülen süre
   kullanılıyor).
   ========================================================= */

function formatRecordFilenameStamp(isoString) {

    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
        return "kayit";
    }

    const pad = value => String(value).padStart(2, "0");

    return (
        `${pad(date.getDate())}.` +
        `${pad(date.getMonth() + 1)}.` +
        `${date.getFullYear()} ` +
        `${pad(date.getHours())}.` +
        `${pad(date.getMinutes())}`
    );

}

async function saveRecording() {

    if (!mediaRecorderResultBlob) {
        return;
    }

    if (!mediaDbAvailable) {

        setMediaUploadStatus(
            "Medya depolama bu tarayıcıda kullanılamıyor."
        );

        return;

    }

    const blob = mediaRecorderResultBlob;

    if (blob.size === 0) {

        showRecordError(
            "Kayıt boş görünüyor. Lütfen tekrar dene."
        );

        return;

    }

    if (blob.size > MEDIA_MAX_AUDIO_BYTES) {

        showRecordError(
            `Kayıt çok büyük ` +
            `(limit ${formatFileSize(MEDIA_MAX_AUDIO_BYTES)}).`
        );

        return;

    }

    const saveBtn = $("#record-save");

    if (saveBtn) {
        saveBtn.disabled = true;
    }

    const indicatorLabel = $("#record-indicator-label");

    if (indicatorLabel) {
        indicatorLabel.textContent = "Kaydediliyor...";
    }

    try {

        const hash = await computeFileHash(blob);
        const duplicate = findDuplicateByHash(hash);

        if (duplicate) {

            setMediaUploadStatus(
                "Bu ses kaydı zaten yüklü, atlandı."
            );

            closeRecordModal();

            return;

        }

        const id = createId();
        const now = new Date().toISOString();
        const durationSeconds =
            Math.round(mediaRecorderElapsedMs / 1000);

        const mimeType =
            blob.type ||
            mediaRecorderMimeType ||
            "audio/webm";

        const filename =
            `Ses kaydı ${formatRecordFilenameStamp(now)}` +
            `.${audioExtensionForMime(mimeType)}`;

        const meta = {
            id,
            type: "audio",
            dayKey: now.slice(0, 10),
            originalFilename: filename,
            mimeType,
            size: blob.size,
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
            blob,
            thumbBlob: null
        });

        mediaMetaList.unshift(meta);

        mediaMetaList.sort(
            (a, b) =>
                mediaEffectiveDate(b).localeCompare(
                    mediaEffectiveDate(a)
                )
        );

        setMediaUploadStatus("Ses kaydı yüklendi.");

        renderMediaPage();
        renderDayPanelMedia();

        closeRecordModal();

    } catch (error) {

        console.error("Ses kaydı kaydedilemedi:", error);

        showRecordError(
            "Kayıt kaydedilemedi. Lütfen tekrar dene."
        );

        if (saveBtn) {
            saveBtn.disabled = false;
        }

        if (indicatorLabel) {
            indicatorLabel.textContent = "Kayıt tamam";
        }

    }

}

/* =========================================================
   MODAL AÇ / KAPAT
   ========================================================= */

function openRecordModal() {

    if (!mediaDbAvailable) {

        setMediaUploadStatus(
            "Medya depolama bu tarayıcıda kullanılamıyor."
        );

        return;

    }

    resetRecordingState();

    if (!isRecordingSupported()) {
        mediaRecorderState = "unsupported";
    }

    renderRecordModalUI();
    updateRecordTimerDisplay();

    openModal($("#record-audio-modal"));

}

function closeRecordModal() {

    resetRecordingState();
    closeModal($("#record-audio-modal"));

}

/* =========================================================
   OLAY DİNLEYİCİLERİ
   ========================================================= */

function setupMediaRecording() {

    on(
        "#media-audio-record-button",
        "click",
        openRecordModal
    );

    on("#close-record-modal", "click", closeRecordModal);
    on("#record-cancel", "click", closeRecordModal);

    on("#record-start", "click", startRecording);
    on("#record-pause", "click", togglePauseRecording);
    on("#record-stop", "click", stopRecording);

    on(
        "#record-rerecord",
        "click",
        resetRecordingState
    );

    on("#record-save", "click", saveRecording);

    document.addEventListener("click", event => {

        if (event.target === $("#record-audio-modal")) {
            closeRecordModal();
        }

    });

}
