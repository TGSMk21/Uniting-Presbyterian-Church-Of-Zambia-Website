import Maps from "./map";


export default function FindUs () {

    return(

        <div className="flex flex-col mt-10 min-w-full max-w-full">
            <div className="flex flex-col items-center "> 
                <h1 className="text-3xl font-bold text-blue-900 my-3 "><strong>Join Us</strong></h1>
                <hr className="min-w-35 max-w-35 border-2 bg-red-600 border-red-600 mb-5"/>
            </div>

            <div className="container grid md:grid-cols-2 gap-3 my-5 mx-auto items-start">

                <Maps/>

                <div>
                    <div className="mb-5 flex flex-col rounded-2xl border-l-4 border-l-red-600 p-10 border-2">

                        <h1 className="text-xl text-blue-950 mb-5 font-semibold">📍Address</h1>
                        <p className="text-gray-600 mb-3">Freedom Compound</p>
                        <p className="text-gray-600">Chilanga Lusaka</p>

                        <a href="#" className="flex flex-col max-w-fit max-h-fit px-3 py-1 rounded-2xl mt-5 text-blue-950 border">Get Directions</a>
                    </div>
                    <div className="mb-5 flex flex-col rounded-2xl border-l-4 border-l-red-600 p-10 border-2">

                        <h1 className="text-xl text-blue-950 mb-5 font-semibold">🕐 Service Times</h1>

                        <div className="flex flex-col">
                            <div className="flex flex-row my-3 place-content-between">
                                <h2 className="text-blue-950 ">Sunday Morning</h2>
                                <p className="text-gray-600 ">9:00 AM</p>     
                            </div>
                            <hr/>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex flex-row my-3 place-content-between">
                                <h2 className="text-blue-950 ">Wednesday Bible Study</h2>
                                <p className="text-gray-600 ">6:30 PM</p>     
                            </div>
                            <hr/>
                        </div>
                        

                    </div>
                    <div className="mb-5 flex flex-col rounded-2xl border-l-4 border-l-red-600 p-10 border-2">

                        <h1 className="text-xl text-blue-950 mb-5 font-semibold">📞 Contact</h1>

                        <p className="text-blue-950 mb-1 text-lg">Rev.T.Mkandawire</p>
                        <p className="text-gray-600 flex flex-row">Phone:<p className="text-red-700 ml-1">+260 977681606</p></p>
                        <p className="text-gray-600 flex flex-row">Email: <p className="text-red-700 ml-1">exampl@example.com</p></p>

                    </div>
                </div>
            </div>

        </div>





       
    )
}