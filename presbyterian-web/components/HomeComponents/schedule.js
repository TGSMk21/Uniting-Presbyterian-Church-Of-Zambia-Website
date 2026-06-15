

export default function Schedule () {

    const schedules = [
        {id:'1' , title: 'Sunday Worship Service', time: '9:00 AM - 11:00 AM' },
        {id:'2' , title: 'Wednesday Bible Study ', time: '4:30 PM - 6:30 PM' },

    ]

    return(

        <div className="px-5 py-10 flex flex-col border rounded-2xl  mt-5 w-full max-w-6/7"> 
            
            <h1 className="text-2xl text-blue-900 font-bold mb-3 self-center max-w-fit"><strong className="font-stretch-50%">Weekly Service Schedule</strong></h1>
             <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            <div className="p-5 grid grid-flow-row w-full" >
                {schedules.map((item)=> {
                    return(
                <div key={item.id} className="flex flex-col rounded-2xl border-l-4 border-l-red-800 p-5 justify-start bg-gray-100 mb-3">
                    <h1 className="text-lg text-blue-900 font-bold">{item.title}</h1>
                    <h3 className="text-gray-700">{item.time}</h3>
                    <h3 className="text-gray-700">Main Church</h3>
                </div>)
                })}
            </div>
        </div>
    )

}