import DUMMY_DATA from "@/constants/DUMMY_DATA"


export default function Vision () {

    const visionMain = 'To be a community where every person encounters the living God, grows in Christlikeness, and discovers their God-given purpose.'

    const visionEnd = "We believe that the local church is God's primary instrument for bringing transformation to communities and nations. Our vision drives everything we do—from Sunday services to community outreach."

    const vp = DUMMY_DATA.vp

    return(

        <div className="bg-blue-950 rounded-2xl p-10 ">

            <h1 className="font-bold text-2xl text-white mb-5 "><strong>Our Vision</strong></h1>

            <p>{visionMain}</p>

            {vp.map((item) => { return(
                <div key={item.id} className="my-5">
                    <p className="text-white" >- {item.point}</p>
                </div>
            )})}

            <p>{visionEnd}</p>
        </div>
    )
}