

export default ({

    name: 'archiveVid',
    type: 'document',
    title: 'Archive Video',
    fields:[
        {
            name: 'id',
            type: 'string',
            title: 'Video Id',
            validation: Rule =>  Rule.required().error('I.D must be provided'),
        },
        {
            name: 'series',
            type: 'string',
            title: 'Series',
            validation: Rule =>  Rule.required().error('Series must be provided'),
        },
        {
            name: 'refVerse',
            type: 'string',
            title: 'Reference Verse',
            validation: Rule =>  Rule.required().error('Verse must be provided'),
        },
        
    ]
})