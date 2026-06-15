

export function dateFormat(dateIn){

    const date = new Date(dateIn)

    const monthShort = new Intl.DateTimeFormat('en-US', {month: "short"}).format(date)

    const monthLong = new Intl.DateTimeFormat('en-US', {month: "long"}).format(date)

    const day  = new Intl.DateTimeFormat('en-US',{day: "2-digit"}).format(date)

    const fullDate = new Intl.DateTimeFormat('en-US', {day:"numeric", month: "long",year:"numeric"}).format(date)

    return {day: day , monthLong: monthLong, monthShort: monthShort,fullDate: fullDate}
}