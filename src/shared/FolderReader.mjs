import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'


const RELEVANT_EXTENSIONS = new Set( [ '.txt', '.geojson' ] )


export class FolderReader {
    static readFolder( { folderPath } ) {
        const files = new Map()
        const stat = statSync( folderPath )
        if( !stat.isDirectory() ) {
            throw new Error( `Not a directory: ${folderPath}` )
        }
        const entries = readdirSync( folderPath )
        entries.forEach( ( entry ) => {
            const fullPath = join( folderPath, entry )
            const entryStat = statSync( fullPath )
            if( !entryStat.isFile() ) {
                return
            }
            const ext = FolderReader.#getExtension( { filename: entry } )
            if( RELEVANT_EXTENSIONS.has( ext ) ) {
                files.set( entry, readFileSync( fullPath ) )
            }
        } )
        return { files }
    }


    static hasRelevantFiles( { files } ) {
        return files.size > 0
    }


    static #getExtension( { filename } ) {
        const idx = filename.lastIndexOf( '.' )
        if( idx === -1 ) {
            return ''
        }
        return filename.substring( idx ).toLowerCase()
    }
}
