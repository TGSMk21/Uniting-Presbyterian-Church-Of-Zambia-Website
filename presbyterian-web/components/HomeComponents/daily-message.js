import { getDailyMessage } from "@/Services/Home/HomeService"
import { dateFormat } from "@/Utilities/DateFormatter"

export const revalidate = 3600

export default async function DailyMessage(){

    const msg = await getDailyMessage()

    const date = dateFormat(msg.date)

   



    return(

        <div className="flex flex-col max-w-7/8 my-10  "> 

            <div className="flex max-sm:flex-col w-full  bg-linear-to-r from-blue-950 via-blue-900 to-red-600 max-sm:justify-center max-sm:items-center py-5 rounded-t-2xl place-content-between px-8"> 

                <div className="flex flex-col justify-center items-center mb-3">

                    

                    <h2 className=" rounded-2xl border-2 border-red-600 bg-red-600/30 mb-2 text-sm text-white px-2 py-1 font-extrabold">DAILY DEVOTION</h2>
                    <h1 className="text-2xl text-white my-0 font-bold">{msg.title}</h1>
                    <h3 className="text-white italic">- {msg.referenceVerse}</h3>

                    

                </div>


                <div className="w-28 h-28 rounded-lg flex flex-col justify-center items-center bg-white/10 backdrop-blur-md border border-white/20">

                    <h1 className=" text-2xl text-white font-semibold" >{date.day}</h1>
                    <h2 className="text-lg text-white  ">{date.monthLong}</h2>

                </div>
                
            </div>

            <div className="flex flex-cols border justify-center items-center py-10 rounded-b-2xl">

                
                <div className="flex flex-col justify-center items-center max-w-3/4">


                    <hr className="min-w-1/4 border-2 bg-red-600 border-red-600 self-start mb-5"/>

                    <p className="text-wrap text-left wrap-anywhere text-ellipsis text-black mb-10">{msg.message}</p>

                    <hr className="w-full border-2"/>

                    <h1 className="text-md  text-blue-900 self-start mt-5 italic ">-Reverend T.Mkandawire</h1>

                </div>

                
            </div>




        </div>

    )


}