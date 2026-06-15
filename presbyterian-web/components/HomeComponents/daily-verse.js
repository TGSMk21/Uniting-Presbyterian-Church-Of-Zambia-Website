import { getDailyVerse } from "@/Services/Home/HomeService"

export const revalidate = 3600

export default async function DailyVerse(){

    const verse = await getDailyVerse()

    return(
        
        <div className="flex flex-col w-full min-h-full  bg-linear-to-br from-blue-950 via-blue-900 to-red-600 items-center justify-center">

            <h1 className="text-sm text-center mb-5 px-4 py-2 rounded-2xl font-extrabold bg-white/10">TODAY'S SCRIPTURE</h1>
            <div className=" justify-center items-center font-bold">
            <p className="text-xl text-center pt-2 mb-5 font-semibold">{verse.scripture}</p>
            </div> 
            <h2 className="text-center font-semibold text-lg italic">-{verse.verse}</h2>
             <hr className="min-w-35 max-w-35 border-2 bg-red-600 border-red-600 mt-3"/>

        </div>


    )

}