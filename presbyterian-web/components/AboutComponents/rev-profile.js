import { Circle, CircleUser, UserRound } from "lucide-react";


export default function Profile (){


    return (
        <div className="flex flex-col max-h-52 bg-blue-950 rounded-2xl p-10 my-5 md:sticky md:top-40 self-start "> 

        <CircleUser color="white" size={50} className="mb-5"/>

        <h1 className="text-white font-bold text-2xl">Rev. Thomson Mkandawire</h1>

        </div>
    )
}