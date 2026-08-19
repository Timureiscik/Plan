/* =========================================================
   18-utils.js
   Tarih yardımcıları, HTML escape.
   ========================================================= */

/* =========================================================
   TARİH YARDIMCILARI
   ========================================================= */

function dateKey(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}

function parseDate(value) {

    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            value
        )
    ) {

        return new Date(NaN);

    }

    const parts =
        value.split("-");

    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

}

function addDays(
    date,
    amount
) {

    const copy =
        new Date(date);

    copy.setDate(
        copy.getDate() +
        amount
    );

    return copy;

}

function getShortMonth(
    date
) {

    return date.toLocaleDateString(
        "tr-TR",
        {
            month: "short"
        }
    );

}

/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}