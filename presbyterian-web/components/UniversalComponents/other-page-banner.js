export default function OtherBanner({title, desc}){

    return(
        
        <div className="relative overflow-hidden flex flex-col w-full min-h-full  bg-linear-to-br from-blue-950 via-blue-900 to-red-600 items-center justify-center">
            <div className="absolute top-[5%] left-[-5%] w-100 h-100 bg-white/5 rounded-full "></div>
            
            <div className="absolute bottom-[5%] right-[-5%] w-100 h-100  bg-white/5 rounded-full"></div>
            
            

            <div className="relative z-10 flex flex-col min-w-full items-center">
            <h1 className="text-3xl text-center font-bold"><strong>{title}</strong> </h1>
            <p className="text-xl text-center pt-2">{desc}</p>
            </div>

        </div>


    )

}