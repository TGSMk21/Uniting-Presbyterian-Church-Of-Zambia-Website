import DUMMY_DATA from "@/constants/DUMMY_DATA"
import { getActivities } from "@/Services/Projects & Activities/ActivitiesService"
import { dateFormat } from "@/Utilities/DateFormatter"


export default async function Activity(){
try{
const activities = await getActivities()

    return(

        <div className="flex flex-col my-10 min-w-full  ">
            <div className="flex flex-col mb-5 self-center"> 
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Current & Upcoming Church Activities</strong></h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            </div>
        <div className="container grid lg:grid-cols-3 md:grid-cols-2 gap-5 w-full min-w-full px-5">

            {activities.map((item) => {return (

            <div key={item._id} className="flex flex-col items-start rounded-lg py-3 px-3 border-2 border-l-4 border-l-red-600 bg-gray-50 w-full">

                <div className="flex flex-row w-full items-center mb-4">

                <div className="w-22 h-20 rounded-lg flex flex-col justify-center items-center bg-blue-900 backdrop-blur-md border border-white/20 mr-5">

                    <h1 className=" text-2xl text-white font-semibold" >{dateFormat(item.date).day}</h1>
                    <h2 className="text-lg text-white  ">{dateFormat(item.date).monthShort}</h2>

                </div>

                <h2 className="text-red-600  mt-1 font-semibold">{item.startTime} - {item.endTime}</h2>

                </div>

                <h1 className="text-blue-950 text-lg text-wrap mt-1 font-bold mb-4">{item.title}</h1>

                <p className="text-wrap text-left wrap-anywhere text-ellipsis text-gray-500 mb-2 ">{item.details}</p>

            </div>


            )})}
           




        </div>
        </div>
    )
    }catch(err){
        return(
            <div className="flex flex-col my-10 min-w-full">
            <div className="flex flex-col mb-5 self-center"> 
            <h1 className="text-3xl text-blue-900 my-3 font-bold "><strong>Cureent & Upcoming Church Activities</strong></h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            </div>
            <h1 className="w-full text-center py-5 rounded-2xl bg-gray-100 text-xl text-gray-600 font-semibold">No Upcoming or Ongoing Church Activities</h1>
            </div>
        )
    }
}