import { client } from "../client"


export async function getProjects(){

   try{ const query = `*[_type == "Project"]{_id,title, status, description, startDate, endDate, progress}`

    return await client.fetch(query)
    }catch(err){

        console.error("Could not fetch projects", err)
    }
}
 