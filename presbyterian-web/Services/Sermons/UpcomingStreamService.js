import { client } from "../client"


export async function getUpcomingStreams() {

    try { 
        
    const query = `*[_type == "upcomingStream"]{_id,title, series, startTime, endTime, date}`

    return await client.fetch(query)

    }catch(err){
        console.error("Could not fetch upcoming videos", err)
    }
    
}