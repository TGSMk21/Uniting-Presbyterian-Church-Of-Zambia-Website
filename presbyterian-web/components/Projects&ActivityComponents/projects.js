import DUMMY_DATA from "@/constants/DUMMY_DATA"
import { getProjects } from "@/Services/Projects & Activities/ProjectService"


export default async function Projects(){

    try{

    const projects = await getProjects()

    return(
        <div className="flex flex-col mt-10 ">
            <div className="flex flex-col self-center mb-5"> 
            <h1 className="text-3xl text-blue-900 my-3 font-bold " ><strong>Current & Upcoming Projects</strong></h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            </div>

        <div className="container grid lg:grid-cols-3 md:grid-cols-2 gap-5 w-full min-w-full px-5  mb-5 max-w-full"> 


            {projects.map((item) => {return(

            <div  key= {item._id}className="flex flex-col  my-0  min-w-full min-h-full "> 

                <div className="flex flex-col items-start w-full  bg-blue-900 py-5 px-3 rounded-t-2xl "> 

                
                    <div className="flex flex-col  items-start mb-3">

                        <h1 className="text-2xl text-white font-semibold my-5">{item.title}</h1>

                        <h2 className=" rounded-2xl  backdrop-blur-md bg-white/30 mb-2 text-sm text-white px-2 py-1 font-semibold">{item.status}</h2>
                    

                    </div>

                </div>

                <div className="  flex flex-col border-2 justify-center items-center w-full rounded-b-2xl p-5">

                    
                    <div className="flex flex-col justify-center items-center">


                        <hr className="min-w-1/4 border-2 bg-red-600 border-red-600 self-start mb-5"/>

                        <p className="text-wrap text-left wrap-anywhere text-ellipsis text-gray-600 mb-5">{item.description}</p>

                    </div>

                    <div className="flex flex-row justify-start w-full mb-3">

                        <div className="flex flex-col w-full items-start rounded-lg py-1 px-3  border-l-4 border-l-red-600 mr-2 bg-gray-100 h-fit">

                            <h2 className="text-gray-400 mt-1">TIMELINE</h2>
                            <h1 className="text-blue-950 text-lg text-wrap mt-1 font-semibold">{item.startDate} - {item.endDate}</h1>

                        </div>

                        


                    </div>

                    <div className="flex flex-col self-start w-full mb-3">

                        <div className="flex flex-row place-content-between w-full mb-1">

                            <h1 className="text-gray-400 ">Project Progess</h1>
                            <h2 className="text-red-600 font-semibold">{item.progress}%</h2>



                        </div>

                        <div className="h-3 rounded-lg w-full bg-blue-50">

                            <div className="rounded-lg bg-linear-to-r from-blue-950 via-blue-800 to-blue-700 h-full" style={{width: `${item.progress}%`}} ></div>

                        </div>

                    </div>




                    
                </div>




            
            </div>
            )})}


            
        </div>
        </div>




    )
    }catch(err){
        return(
            <div className="flex flex-col my-10 min-w-full">
            <div className="flex flex-col mb-5 self-center"> 
            <h1 className="text-3xl text-blue-900 my-3 font-bold "><strong>Current & Upcoming Projects</strong></h1>
            <hr className="max-w-35 min-w-35 border-2 bg-red-600 border-red-600 mb-5 self-center"/>
            </div>
            <h1 className="w-full text-center py-5 rounded-2xl bg-gray-100 text-xl text-gray-600 font-semibold">No Upcoming or Ongoing Projects</h1>
            </div>
        )
    }
    
}