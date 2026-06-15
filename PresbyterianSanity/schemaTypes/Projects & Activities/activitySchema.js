

export default ({
    name: 'activity',
    type: 'document',
    title: 'Activity',
    fields: [

        {    
            name: 'title',
            type: 'string',
            title: 'Activity Name',
            validation: Rule =>  Rule.required().error('Name must be provided')
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
            title: 'Activity Date',
            options: {
                dateFormat: 'YYYY-MM-DD'
            },
            validation: Rule =>  Rule.required().error('Date must be provided'),


        },
        {
            name: 'details',
            type: 'text',
            title: 'Details',
            validation: Rule =>  Rule.required().error('Description must be provided')
           
        },
        {
            name: 'location',
            type: 'string',
            title: 'Location',
            validation: Rule =>  Rule.required().error('Description must be provided')
        }
    ]
})