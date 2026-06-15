import { validation } from "sanity";

export default ({

    name: 'dailyVerse',
    type: 'document',
    title: 'Daily Verse',
    
    fields: [
        {
            name: 'verse',
            type: 'string',
            title: 'Verse',
            validation: Rule => Rule.required().error('Verse must be provided')
        },
        {
            name: 'scripture',
            type: 'text',
            title: 'Scripture',
             validation: Rule => Rule.required().error('Scripture must be provided')

        },
        {
            name: 'publishedAt',
            type: 'date',
            title: 'Published at',
            options: {
                dateFormat: 'YYYY-MM-DD'
            }

        }
    ]
})  