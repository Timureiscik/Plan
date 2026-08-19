/* =========================================================
   21-daily-summary.js
   Bugünün otomatik özeti — KURAL TABANLI (yapay zeka DEĞİL).

   Habitus tamamen istemci taraflı bir uygulama olduğu için
   burada gerçek bir dil modeli çağrılmıyor; bunun yerine
   mevcut verilerden (görevler, gün paneli, medya) sabit
   kurallarla okunabilir bir Türkçe özet cümlesi üretiliyor.
   Ayrı bir localStorage anahtarı GEREKTİRMEZ — her renderAll()
   çağrısında güncel veriden yeniden hesaplanır, bu yüzden
   gün içinde görev tamamladıkça özet de anında güncellenir.
   ========================================================= */

function generateDailySummaryText() {

    if (tasks.length === 0) {

        return (
            "Henüz görev eklemedin. İlk görevini ekleyerek " +
            "bugünün özetini görmeye başlayabilirsin."
        );

    }

    const { done, total } = getTodayCounts();

    const todayKey = effectiveDateKey();
    const dayEntry = getDayEntry(todayKey);

    const notesCount = dayEntry.notes.length;
    const homeworksTotal = dayEntry.homeworks.length;

    const homeworksDone =
        dayEntry.homeworks.filter(
            item => item.done
        ).length;

    const projectsCount = dayEntry.projects.length;

    const mediaToday =
        mediaMetaList.filter(
            item => item.dayKey === todayKey
        );

    const photosToday =
        mediaToday.filter(
            item => item.type === "photo"
        ).length;

    const audioToday =
        mediaToday.filter(
            item => item.type === "audio"
        ).length;

    let bestTask = null;

    tasks.forEach(task => {

        if (
            !bestTask ||
            getCurrentStreak(task) >
                getCurrentStreak(bestTask)
        ) {

            bestTask = task;

        }

    });

    const bestCurrentStreak =
        bestTask
            ? getCurrentStreak(bestTask)
            : 0;

    const parts = [];

    if (total === 0) {

        parts.push(
            "Bugün için henüz görev yok."
        );

    } else if (done === 0) {

        parts.push(
            `Bugün henüz görev tamamlamadın (0/${total}).`
        );

    } else if (done === total) {

        parts.push(
            `Bugün ${total} görevin tamamını bitirdin — tebrikler!`
        );

    } else {

        parts.push(
            `Bugün ${done}/${total} görevini tamamladın.`
        );

    }

    if (bestTask && bestCurrentStreak > 0) {

        parts.push(
            `"${bestTask.title}" görevinde ${bestCurrentStreak} ` +
            `günlük serini sürdürüyorsun.`
        );

    }

    const extras = [];

    if (notesCount > 0) {

        extras.push(`${notesCount} not`);

    }

    if (homeworksTotal > 0) {

        extras.push(
            `${homeworksDone}/${homeworksTotal} ödev`
        );

    }

    if (projectsCount > 0) {

        extras.push(`${projectsCount} proje`);

    }

    if (photosToday > 0) {

        extras.push(`${photosToday} fotoğraf`);

    }

    if (audioToday > 0) {

        extras.push(`${audioToday} ses kaydı`);

    }

    if (extras.length > 0) {

        parts.push(
            `Bugün ayrıca ${extras.join(", ")} ekledin.`
        );

    }

    return parts.join(" ");

}

function renderDailySummary() {

    const textEl = $("#daily-summary-text");

    if (!textEl) {
        return;
    }

    textEl.textContent = generateDailySummaryText();

}
