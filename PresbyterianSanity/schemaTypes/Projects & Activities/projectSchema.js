 

export default ({

    name: 'Project',
    type: 'document',
    title: 'Projects',
    fields: [

        {
            name: 'title',
            type: 'string',
            title: 'Project Name',
            validation: Rule =>  Rule.required().error('Title must be provided')
        },
        {
            name: 'status',
            type: 'string',
            title: 'Project Status',
            validation: Rule =>  Rule.required().error('Status must be provided'),
            options: {
                list: [
                    {title: 'ONGOING', value: 'ONGOING'},
                    {title: 'COMPLETED', value: 'COMPLETED'},
                    {title: 'PENDING', value: 'PENDING'},
                ],
                layout: 'dropdown'
            },
        },
        {
            name: 'description',
            type: 'text',
            title: 'Project Description',
            validation: Rule =>  Rule.required().error('Description must be provided')
        },
        {
            name: 'startDate',
            type: 'date',
            title: 'Start Date',
            validation: Rule =>  Rule.required().error('Start date must be provided')
        },
        {
            name: 'endDate',
            type: 'date',
            title: 'End Date',
        },
        {
            name: 'progress',
            type: 'number',
            title: 'Progress Made',
            validation: Rule =>  Rule.required().error('Progress must be provided')

        }
    ]
})