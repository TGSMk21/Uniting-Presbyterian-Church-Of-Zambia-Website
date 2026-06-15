

export default ({

    name: 'dailyMessage',
    type: 'document',
    title: 'Daily Message',
    fields: [

        {
            name: 'title',
            type: 'string',
            title: 'Message Title',
            validation: Rule =>  Rule.required().error('Title must be provided')
        },
        {
            name: 'message',
            type: 'text',
            title: 'Message',
            validation: Rule =>  Rule.required().error('Message must be provided')
        },
        {
            name: 'referenceVerse',
            type: 'string',
            title: 'Reference Verse',
            validation: Rule =>  Rule.required().error('Verse must be provided')
        },
        {
            name: 'date',
            type: 'date',
            title: 'Date',
            validation: Rule =>  Rule.required().error('Date must be provided')
            
        },

    ]
})