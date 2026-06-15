import { client } from "../client"


export async function getActivities () {

    try {
    const query= `*[_type == "activity"]{_id,title, startTime, endTime, date,details,location}`

    return await client.fetch(query)

    }catch(err){
        console.error("Could not fetch activities", err)
    }
    
}