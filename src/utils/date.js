const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

module.exports = {
    getStartOfWeek(date, offset) {
        date = (date ? new Date(date) : new Date());
        offset = offset || 0; // 0 for Monday, -1 for Sunday, 2 for Tuesday, etc

        const day = date.getDay();
        let daysFromStart = date.getDate() - day;

        if (day === 0) {
            daysFromStart += (-6 + offset);
        } else {
            daysFromStart += (1 + offset);
        }

        return new Date(date.setDate(daysFromStart));
    },

    getNameOfDay(date) {
        return days[new Date(date).getDay()];
    },

    getNameOfMonth(date) {
        return months[new Date(date).getMonth()];
    },

    getDays(offset) {
        offset = offset || 0; // 0 for Monday, -1 for Sunday, 2 for Tuesday, etc

        let offsetDays = [];
        for (let i = 0; i < days.length; i++) {
            const index = (i + offset + 1) % days.length;
            offsetDays.push(days[index]);
        }

        return offsetDays;
    },

    addDaysToDate(date, days) {
        days = days || 0;
        let newDate = new Date(date);
        newDate.setDate(newDate.getDate() + days);

        return newDate;
    },

    addMonthsToDateAndGetStart(date, months) {
        date = new Date(date);

        const year = date.getFullYear();
        const month = date.getMonth();

        return new Date(year, month + months, 1);
    },

    getStartOfMonth(date) {
        return this.addMonthsToDateAndGetStart(date, 0);
    },

    getEndOfMonth(date) {
        return this.addDaysToDate(this.addMonthsToDateAndGetStart(date, 1), -1);
    },

    getDateTime(date) {
        date = new Date(date);

        let day = date.getDate();
        let month = date.getMonth() + 1;

        if (day < 10) { day = '0' + day; }
        if (month < 10) { month = '0' + month; }

        return date.getFullYear() + '-' + month + '-' + day;
    },

    getDateObject(date) {
        date = new Date(date);

        return {
            date,
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            dateTime: this.getDateTime(date),
            dayText: this.getNameOfDay(date),
            monthText: this.getNameOfMonth(date),
            monthShortText: this.getNameOfMonth(date).substr(0, 3),
            isWeekend: ((date.getDay() + 6) % 7) >= 5,
        };
    },
};