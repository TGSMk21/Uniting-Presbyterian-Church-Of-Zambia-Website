

export function mergeData(arr1,arr2){

   return arr1.map((arrV1) => {

    const arrV2 = arr2.find((item) => { item.id === arrV1.id})

    return {...arrV1,...arrV2}
})
}