import VidPlayerPage from "@/components/SermonsComponents/VideoPlayerComponents/player";


export default async function VidPlayer({params}) {

    const resolvedParams = await params;

    const id = resolvedParams.videoId
    const branch = resolvedParams.branch

    return <VidPlayerPage id={id} branch={branch}/>
}