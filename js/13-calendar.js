/* =========================================================
   13-calendar.js
   Dinamik takvim: ICS beslemesi, takvim render, ay değiştir, takvim etkinlikleri, tarihe göre etkinlik, etkinlik tipi, saat.
   ========================================================= */

/* =========================================================
   DİNAMİK TAKVİM
   ========================================================= */

/* =========================================================
   ICS TAKVİM BESLEMESİ

   Google Calendar'ın herkese açık ICS (iCal) adresinden
   Türk bayramları/özel günlerini çeker. Sabit/hesaplanan
   özel gün sisteminin (bkz. getComputedSpecialDaysForYear())
   YERİNE değil, YANINDA çalışır — ikisi de aynı tek
   `calendarEvents` state'ine buildCalendarEventsForYear()
   üzerinden birleşir (bkz. o fonksiyon).

   ÖNEMLİ — CORS:
   Google'ın public/basic.ics export uç noktaları normalde
   Access-Control-Allow-Origin başlığı DÖNDÜRMEZ. Bu,
   Google'ın kendi altyapısının bilinen, belgelenmiş bir
   davranışı olup bu projeye özgü bir hata değil. Bu yüzden
   aşağıdaki fetch() tarayıcıda büyük ihtimalle bir CORS
   hatasıyla (ağ hatası olarak görünür, ayrıştırılamaz)
   başarısız olacaktır.

   Bu koddaki tasarım buna göre yapıldı: başarısız olursa
   sessizce (yalnızca console.warn ile) en son başarılı
   şekilde önbelleğe alınmış ICS verisine (varsa) veya hiç
   yoksa yalnızca hesaplanan/sabit özel günlere düşer —
   uygulama hiçbir şekilde bozulmaz.

   Bunu gerçekten çalıştırmak istenirse tek güvenilir yol,
   projenin kendi (üçüncü taraf olmayan) küçük bir sunucusunun
   bu ICS'i aynı origin'den yansıtması (reverse proxy)
   olurdu — mevcut proje tamamen istemci taraflı olduğu ve
   gereksiz backend eklenmemesi istendiği için bu eklenmedi.
   ========================================================= */

async function fetchIcsCalendar(force = false) {

    if (
        icsLoadInFlight &&
        !force
    ) {

        return;

    }

    icsLoadInFlight = true;

    try {

        const response =
            await fetch(
                ICS_URL,
                {
                    method: "GET",
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        const text =
            await response.text();

        const parsed =
            parseIcsEvents(text);

        if (parsed.length === 0) {

            throw new Error(
                "ICS içeriğinden geçerli etkinlik ayrıştırılamadı."
            );

        }

        /*
         * Her başarılı çekişte tamamen DEĞİŞTİRİLİYOR
         * (eklenmiyor) — bu, her uygulama açılışında aynı
         * bayramların çoğalarak birikmesini engeller.
         */
        icsEvents = parsed;

        saveIcsCache();

        renderCalendar();

    } catch (error) {

        /*
         * Beklenen/olası durum: bkz. yukarıdaki CORS notu.
         * icsEvents zaten loadIcsCache() ile önbellekten
         * (varsa) yüklenmiş durumda — burada dokunmuyoruz,
         * böylece son başarılı veri kullanılmaya devam eder.
         */
        console.warn(
            "ICS özel gün beslemesi alınamadı (CORS engeli olası); önbellek/diğer kaynaklar kullanılacak:",
            error
        );

    } finally {

        icsLoadInFlight = false;

    }

}

/*
 * RFC 5545 satır "unfold" işlemi: bir satır boşluk veya
 * tab ile başlıyorsa önceki satırın devamıdır.
 */
function unfoldIcsLines(text) {

    const rawLines =
        text.split(/\r\n|\n|\r/);

    const lines = [];

    rawLines.forEach(line => {

        if (
            (
                line.startsWith(" ") ||
                line.startsWith("\t")
            ) &&
            lines.length > 0
        ) {

            lines[lines.length - 1] +=
                line.slice(1);

        } else {

            lines.push(line);

        }

    });

    return lines;

}

function unescapeIcsText(value) {

    return value
        .replace(/\\n/gi, " ")
        .replace(/\\,/g, ",")
        .replace(/\\;/g, ";")
        .replace(/\\\\/g, "\\")
        .trim();

}

/*
 * ICS tarihini (tüm gün: YYYYMMDD, veya saatli:
 * YYYYMMDDTHHMMSSZ) doğrudan string üzerinden "YYYY-MM-DD"
 * formatına çevirir. Bilinçli olarak `new Date(...)`
 * KULLANMIYOR — bu, Habitus'un geri kalanıyla aynı
 * timezone-güvenli yaklaşımdır (bkz. dateKey()/parseDate()).
 * Tüm gün etkinlikler (Türk bayram takvimlerinde standart
 * olan biçim) için bu %100 doğrudur; saatli+Z bir etkinlik
 * gece yarısına çok yakınsa UTC/yerel gün farkı teorik
 * olarak mümkündür, ama bayram takvimlerinde bu format
 * pratikte kullanılmaz.
 */
function parseIcsDate(value) {

    const dateOnly =
        value.match(
            /^(\d{4})(\d{2})(\d{2})$/
        );

    if (dateOnly) {

        return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;

    }

    const dateTime =
        value.match(
            /^(\d{4})(\d{2})(\d{2})T\d{6}Z?$/
        );

    if (dateTime) {

        return `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;

    }

    return null;

}

function parseIcsEvents(text) {

    if (
        typeof text !== "string" ||
        !text.trim()
    ) {

        return [];

    }

    const lines =
        unfoldIcsLines(text);

    const events = [];

    let current = null;

    lines.forEach(line => {

        if (line === "BEGIN:VEVENT") {

            current = {};

            return;

        }

        if (line === "END:VEVENT") {

            if (
                current &&
                current.date &&
                current.title
            ) {

                events.push({
                    uid:
                        current.uid ||
                        `${current.date}-${current.title}`,
                    date: current.date,
                    title: current.title
                });

            }

            current = null;

            return;

        }

        if (!current) {
            return;
        }

        const separatorIndex =
            line.indexOf(":");

        if (separatorIndex === -1) {
            return;
        }

        const rawKey =
            line.slice(0, separatorIndex);

        const value =
            line.slice(separatorIndex + 1);

        const key =
            rawKey
                .split(";")[0]
                .toUpperCase();

        if (key === "UID") {
            current.uid = value.trim();
        }

        if (key === "SUMMARY") {
            current.title = unescapeIcsText(value);
        }

        if (key === "DTSTART") {
            current.date = parseIcsDate(value.trim());
        }

    });

    /*
     * Aynı parse içinde aynı uid iki kez gelirse
     * yalnızca ilkini tut (ICS içi duplicate koruması).
     */
    const seen = new Set();

    return events.filter(event => {

        if (seen.has(event.uid)) {
            return false;
        }

        seen.add(event.uid);

        return true;

    });

}

function loadIcsCache() {

    try {

        const saved =
            localStorage.getItem(ICS_CACHE_KEY);

        if (!saved) {
            return;
        }

        const parsed =
            JSON.parse(saved);

        if (
            parsed &&
            Array.isArray(parsed.events)
        ) {

            icsEvents =
                parsed.events.filter(
                    event =>
                        event &&
                        typeof event.date === "string" &&
                        typeof event.title === "string"
                );

        }

    } catch (error) {

        console.warn(
            "ICS önbelleği okunamadı:",
            error
        );

    }

}

function saveIcsCache() {

    try {

        localStorage.setItem(
            ICS_CACHE_KEY,
            JSON.stringify({
                events: icsEvents,
                fetchedAt: new Date().toISOString()
            })
        );

    } catch (error) {

        console.warn(
            "ICS önbelleği kaydedilemedi:",
            error
        );

    }

}

/*
 * "n"inci <weekday>'i döndürür (weekday: 0=Pazar..6=Cumartesi).
 * Yerel Date bileşen kurucusu kullanılıyor
 * (new Date(year, monthIndex, day)) — string parse YOK,
 * bu yüzden UTC/local timezone kaymasına karşı güvenli.
 */
function nthWeekdayOfMonth(
    year,
    monthIndex,
    weekday,
    n
) {

    const first =
        new Date(
            year,
            monthIndex,
            1
        );

    const firstWeekday =
        first.getDay();

    const day =
        1 +
        (
            (
                7 +
                weekday -
                firstWeekday
            ) % 7
        ) +
        (n - 1) * 7;

    return new Date(
        year,
        monthIndex,
        day
    );

}

/*
 * Habitus'un TEK özel gün kaynağı. Sabit tarihli millî
 * bayramlar/resmî tatiller, sabit tarihli diğer özel günler
 * (Öğretmenler Günü, Sevgililer Günü, 10 Kasım) ve kodla
 * hesaplanan (Anneler/Babalar Günü) günlerin tamamı burada,
 * herhangi bir harici API'ye bağımlı olmadan, her yıl için
 * otomatik üretilir — yıl elle/hard-code listelenmez.
 *
 * Millî bayramlar/resmî tatiller (Yılbaşı, 23 Nisan, 19 Mayıs,
 * 15 Temmuz, 30 Ağustos, 29 Ekim) type "holiday" olarak
 * işaretleniyor: mevcut takvimdeki "Tatil" (legend-dot.holiday)
 * kategorisiyle aynı. Diğerleri (10 Kasım, Sevgililer Günü,
 * Öğretmenler Günü, Anneler/Babalar Günü) daha önce olduğu gibi
 * type "event" ("Önemli gün" / legend-dot.event) olarak kalıyor
 * — yeni bir görsel kategori/CSS eklemeye gerek yok.
 *
 * 10 Kasım NOTU: Bu gün resmî tatil değildir (Atatürk'ü Anma
 * Günü'nde çalışma tatili yoktur), bu yüzden type "event"
 * olarak kalıyor. `.is-nov10` CSS kuralı (hücre arka planını
 * siyaha çeviren, tamamen ayrı bir görsel katman) buna hiç
 * dokunmadan, kendi bağımsız effectiveDate() kontrolüyle
 * çalışmaya devam ediyor — bkz. updateNov10Flag().
 */
function getComputedSpecialDaysForYear(year) {

    return [
        {
            date: `${year}-01-01`,
            title: "Yılbaşı",
            type: "holiday"
        },
        {
            date: `${year}-02-14`,
            title: "Sevgililer Günü",
            type: "event"
        },
        {
            date: `${year}-04-23`,
            title: "Ulusal Egemenlik ve Çocuk Bayramı",
            type: "holiday"
        },
        {
            date:
                dateKey(
                    nthWeekdayOfMonth(
                        year,
                        4,
                        0,
                        2
                    )
                ),
            title: "Anneler Günü",
            type: "event"
        },
        {
            date: `${year}-05-19`,
            title: "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
            type: "holiday"
        },
        {
            date:
                dateKey(
                    nthWeekdayOfMonth(
                        year,
                        5,
                        0,
                        3
                    )
                ),
            title: "Babalar Günü",
            type: "event"
        },
        {
            date: `${year}-07-15`,
            title: "Demokrasi ve Milli Birlik Günü",
            type: "holiday"
        },
        {
            date: `${year}-08-30`,
            title: "Zafer Bayramı",
            type: "holiday"
        },
        {
            date: `${year}-10-29`,
            title: "Cumhuriyet Bayramı",
            type: "holiday"
        },
        {
            date: `${year}-11-10`,
            title: "Atatürk'ü Anma Günü",
            type: "event"
        },
        {
            date: `${year}-11-24`,
            title: "Öğretmenler Günü",
            type: "event"
        }
    ];

}

/*
 * Takvimde gösterilen tek yıl için TÜM kaynakları
 * (ICS + hesaplanan/sabit özel günler) tek bir listede
 * birleştirir. Bu, `calendarEvents`in her zaman yeniden
 * kurulduğu TEK yerdir — ikinci bir paralel state yoktur.
 *
 * Öncelik (aynı tarihte çakışma olursa):
 * 1) ICS (dinamik — genelde CORS nedeniyle boş döner, ama
 *    başarılı olursa öncelikli kabul edilir)
 * 2) getComputedSpecialDaysForYear() — millî bayramlar, resmî
 *    tatiller ve diğer tüm özel günler dahil, Habitus'un TEK
 *    özel gün kaynağı; harici bir API'ye bağımlı değildir.
 *
 * Aynı tarih birden fazla kaynakta varsa yalnızca İLK
 * (en yüksek öncelikli) kayıt tutulur — duplicate oluşmaz.
 */
function buildCalendarEventsForYear(year) {

    const merged = [];
    const claimed = new Set();

    const yearPrefix = `${year}-`;

    icsEvents
        .filter(
            event =>
                event.date &&
                event.date.startsWith(yearPrefix)
        )
        .forEach(event => {

            if (claimed.has(event.date)) {
                return;
            }

            merged.push({
                date: event.date,
                title: event.title,
                type: "holiday",
                source: "ics"
            });

            claimed.add(event.date);

        });

    getComputedSpecialDaysForYear(year)
        .forEach(event => {

            if (claimed.has(event.date)) {
                return;
            }

            merged.push(event);

            claimed.add(event.date);

        });

    return merged.sort(
        (a, b) =>
            a.date.localeCompare(b.date)
    );

}

/* =========================================================
   TAKVİM RENDER
   ========================================================= */

function renderCalendar() {

    const titleEl =
        $("#calendar-month-title");

    const grid =
        $("#calendar-grid");

    if (!grid) {
        return;
    }

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    if (titleEl) {

        titleEl.textContent =
            calendarDate.toLocaleDateString(
                "tr-TR",
                {
                    month: "long",
                    year: "numeric"
                }
            );

    }

    /*
     * `calendarEvents` HER renderCalendar() çağrısında bu
     * tek fonksiyondan yeniden kurulur (ICS + hesaplanan/
     * sabit özel günler). Hesaplanan/sabit özel günler
     * senkron üretildiği için her zaman hazırdır; ICS ise
     * ağ isteği tamamlandığında zaten tekrar renderCalendar()
     * çağırarak listeyi günceller.
     */
    calendarEvents =
        buildCalendarEventsForYear(year);

    const firstOfMonth =
        new Date(
            year,
            month,
            1
        );

    const startWeekday =
        (
            firstOfMonth.getDay() +
            6
        ) % 7;

    const daysInMonth =
        new Date(
            year,
            month + 1,
            0
        ).getDate();

    const daysInPrevMonth =
        new Date(
            year,
            month,
            0
        ).getDate();

    const totalCells =
        Math.ceil(
            (
                startWeekday +
                daysInMonth
            ) / 7
        ) * 7;

    /*
     * "Bugün" tüm uygulamada tek bir merkezi sisteme
     * (effectiveDateKey) göre belirlenir; takvim de
     * aynı anahtarı kullanmalı, aksi hâlde gün başlangıç
     * saati ayarlandığında takvim ile gün paneli farklı
     * günü "bugün" sayabilir.
     */
    const todayKey =
        effectiveDateKey();

    grid.innerHTML = "";

    for (
        let i = 0;
        i < totalCells;
        i++
    ) {

        let cellDate;
        let outside = false;

        if (
            i < startWeekday
        ) {

            cellDate =
                new Date(
                    year,
                    month - 1,
                    daysInPrevMonth -
                        (
                            startWeekday -
                            i -
                            1
                        )
                );

            outside = true;

        } else if (
            i >=
            startWeekday +
            daysInMonth
        ) {

            cellDate =
                new Date(
                    year,
                    month + 1,
                    i -
                        (
                            startWeekday +
                            daysInMonth
                        ) +
                        1
                );

            outside = true;

        } else {

            cellDate =
                new Date(
                    year,
                    month,
                    i -
                        startWeekday +
                        1
                );

        }

        const key =
            dateKey(cellDate);

        const isNov10 =
            cellDate.getMonth() === 10 &&
            cellDate.getDate() === 10;

        const events =
            getEventsForDate(
                cellDate
            );

        const dayEntry =
            getDayEntry(key);

        const hasDayData =
            dayEntry.notes.length > 0 ||
            dayEntry.homeworks.length > 0 ||
            dayEntry.projects.length > 0 ||
            dayEntry.dailyPlan.length > 0;

        const hasCompletedTask =
            tasks.some(
                task => isCompletedOn(task, key)
            );

        const cell =
            document.createElement(
                "div"
            );

        cell.className =
            "calendar-day" +
            (
                outside
                    ? " outside"
                    : ""
            ) +
            (
                key === todayKey
                    ? " is-today"
                    : ""
            ) +
            (
                key < todayKey
                    ? " is-past"
                    : ""
            ) +
            (
                key === selectedDayKey
                    ? " is-selected"
                    : ""
            ) +
            (
                /*
                 * 10 Kasım, görüntülenen yıldan bağımsız
                 * olarak takvimde her zaman siyah görünür
                 * (bkz. .calendar-day.is-nov10 — style.css).
                 * Bu, "bugün" veya "seçili gün" olup
                 * olmamasından etkilenmez; tema/palet
                 * sisteminden de bağımsızdır.
                 */
                isNov10
                    ? " is-nov10"
                    : ""
            );

        cell.dataset.date =
            key;

        if (isNov10) {

            cell.title =
                "10 Kasım — Atatürk'ü Anma Günü";

        }

        const dotsHtml =
            events
                .slice(0, 2)
                .map(
                    event =>
                        `<span class="dot ${event.type}"></span>`
                )
                .join("") +
            (
                hasDayData || hasCompletedTask
                    ? `<span class="dot task"></span>`
                    : ""
            );

        const labelsHtml =
            events
                .slice(0, 2)
                .map(
                    event =>
                        `
                            <span
                                class="calendar-day-event-label"
                            >
                                ${escapeHtml(event.title)}
                            </span>
                        `
                )
                .join("");

        cell.innerHTML = `
            <span
                class="calendar-day-number"
            >
                ${cellDate.getDate()}
            </span>

            <div
                class="calendar-day-dots"
            >
                ${dotsHtml}
            </div>

            <div
                class="calendar-day-events"
            >
                ${labelsHtml}
            </div>
        `;

        grid.appendChild(cell);

    }

    renderCalendarEvents();

}

/* =========================================================
   AY DEĞİŞTİR
   ========================================================= */

function changeMonth(delta) {

    calendarDate =
        new Date(
            calendarDate.getFullYear(),
            calendarDate.getMonth() +
                delta,
            1
        );

    renderCalendar();

}

/* =========================================================
   TAKVİM ETKİNLİKLERİ
   ========================================================= */

function renderCalendarEvents() {

    const container =
        $("#calendar-events-list");

    const titleEl =
        $("#calendar-events-title");

    if (!container) {
        return;
    }

    const year =
        calendarDate.getFullYear();

    const month =
        calendarDate.getMonth();

    const monthStart =
        new Date(
            year,
            month,
            1
        );

    const monthEnd =
        new Date(
            year,
            month + 1,
            0
        );

    const monthStartKey =
        dateKey(
            monthStart
        );

    const monthEndKey =
        dateKey(
            monthEnd
        );

    if (titleEl) {

        titleEl.textContent =
            calendarDate.toLocaleDateString(
                "tr-TR",
                {
                    month: "long"
                }
            );

    }

    const monthEvents =
        calendarEvents
            .filter(event => {

                if (!event.date) {
                    return false;
                }

                return (
                    event.date >=
                        monthStartKey &&
                    event.date <=
                        monthEndKey
                );

            })
            .sort(
                (a, b) =>
                    a.date.localeCompare(
                        b.date
                    )
            );

    container.innerHTML = "";

    if (
        monthEvents.length === 0
    ) {

        container.innerHTML = `
            <div class="calendar-empty">
                Bu ay için kayıtlı resmi tatil yok.
            </div>
        `;

        return;

    }

    monthEvents.forEach(
        event => {

            const anchorDate =
                parseDate(
                    event.date
                );

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "calendar-list-item";

            item.innerHTML = `
                <div
                    class="calendar-list-date"
                >
                    ${anchorDate.getDate()}
                    <br>
                    ${getShortMonth(anchorDate)}
                </div>

                <div
                    class="calendar-list-content"
                >
                    <strong>
                        ${escapeHtml(event.title)}
                    </strong>

                    <br>

                    <span class="${event.type}">
                        ${getEventTypeName(event.type)}
                    </span>
                </div>
            `;

            container.appendChild(
                item
            );

        }
    );

}

/* =========================================================
   TARİHE GÖRE ETKİNLİK
   ========================================================= */

function getEventsForDate(
    date
) {

    const key =
        dateKey(date);

    return calendarEvents.filter(
        event => {

            if (
                event.date
            ) {

                return (
                    event.date ===
                    key
                );

            }

            if (
                event.start &&
                event.end
            ) {

                return (
                    key >= event.start &&
                    key <= event.end
                );

            }

            return false;

        }
    );

}

/* =========================================================
   ETKİNLİK TİPİ
   ========================================================= */

function getEventTypeName(
    type
) {

    if (
        type === "holiday"
    ) {

        return "Tatil";

    }

    if (
        type === "school"
    ) {

        return "Okul";

    }

    if (
        type === "meb"
    ) {

        return "Takvim";

    }

    return "Etkinlik";

}

/* =========================================================
   SAAT
   ========================================================= */

function updateClock() {

    const clock =
        $("#current-time");

    const dateText =
        $("#current-date");

    const now =
        new Date();

    if (clock) {

        clock.textContent =
            now.toLocaleTimeString(
                "tr-TR",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                }
            );

    }

    if (dateText) {

        dateText.textContent =
            now.toLocaleDateString(
                "tr-TR",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long"
                }
            );

    }

    /*
     * Merkezi gün sistemine göre "bugün" değiştiyse
     * (gece yarısı ya da gün başlangıç saati geçildiyse),
     * uygulamanın tamamı yeni günü yansıtacak şekilde
     * yeniden çizilir. Kullanıcı o an "bugün" dışında bir
     * günü inceliyorsa seçimi değiştirilmez.
     */

    const currentDayKey =
        effectiveDateKey();

    if (
        lastKnownDayKey &&
        currentDayKey !== lastKnownDayKey
    ) {

        const wasOnToday =
            selectedDayKey === lastKnownDayKey;

        lastKnownDayKey = currentDayKey;

        if (wasOnToday) {
            selectedDayKey = currentDayKey;
        }

        renderAll();
        renderCalendar();
        updateNov10Flag();

    } else if (!lastKnownDayKey) {

        lastKnownDayKey = currentDayKey;

    }

}

