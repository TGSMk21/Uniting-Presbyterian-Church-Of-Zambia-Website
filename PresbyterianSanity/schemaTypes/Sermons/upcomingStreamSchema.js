

export default ({

    name: 'upcomingStream',
    type: 'document',
    title: 'Upcoming Stream',
    fields: [
        {
            name: 'title',
            type: 'string',
            title: 'Stream Title',
            validation: Rule =>  Rule.required().error('Title must be provided'),
        },
        {
            name: 'series',
            type: 'string',
            title: 'Stream Series',
            validation: Rule =>  Rule.required().error('Series name must be provided'),
        },
        {
            name: 'startTime',
            type: 'string',
            title: 'Start Time',
            validation: Rule =>  Rule.regex(
                /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i,{name: 'AM/PM format'}
            ).error('Please use the format: "12:00 PM"')
        },
        {
            name: 'endTime',
            type: 'string',
            title: 'End Time',
            validation: Rule =>  Rule.regex(
                /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM)$/i,{name: 'AM/PM format'}
            ).error('Please use the format: "12:00 PM"')
        },
        {
            name: 'date',
            type: 'date',
            title: 'Stream Date',
            options: {
                dateFormat: 'YYYY-MM-DD'
            },
            validation: Rule =>  Rule.required().error('Date must be provided'),
        }
    ]
})