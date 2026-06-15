import { client } from "../client"


export async function getArchiveData() {

    try { 
        
    const query = `*[_type == "archiveVid"]{id, series, refVerse}`

    return await client.fetch(query)

    }catch(err){
        console.error("Could not fetch Archive video data", err)
    }
    
}