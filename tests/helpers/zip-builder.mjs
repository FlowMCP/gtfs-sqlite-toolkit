import yazl from 'yazl'


export const buildZipBuffer = ( { entries } ) => {
    return new Promise( ( resolve, reject ) => {
        const zipfile = new yazl.ZipFile()
        entries.forEach( ( [ filename, content ] ) => {
            const buf = Buffer.isBuffer( content ) ? content : Buffer.from( content, 'utf-8' )
            zipfile.addBuffer( buf, filename )
        } )
        zipfile.end()
        const chunks = []
        zipfile.outputStream.on( 'data', ( chunk ) => chunks.push( chunk ) )
        zipfile.outputStream.on( 'end', () => resolve( Buffer.concat( chunks ) ) )
        zipfile.outputStream.on( 'error', reject )
    } )
}
