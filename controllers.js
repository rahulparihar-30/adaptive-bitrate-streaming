const fileName = (id,name)=>{
    const newFilename = `${id}_${name
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_.-]/g, "")}`;
    return newFilename
}

export default fileName;