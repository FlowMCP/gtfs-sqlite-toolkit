import { ScheduleConverter } from './converters/schedule/ScheduleConverter.mjs'


export class GtfsSqliteConverter {
    static async start( { input, inputType = 'auto', force = false, dbPath, gtfsSpec = 'schedule', sourceUrl = null } ) {
        if( gtfsSpec === 'schedule' ) {
            return await ScheduleConverter.run( { input, inputType, force, dbPath, sourceUrl } )
        }
        return {
            status: false,
            dbPath: null,
            report: null,
            capabilities: null,
            seal: null,
            messages: [ { code: 'GTFS-007', file: null, message: `Unsupported spec: ${gtfsSpec}` } ]
        }
    }
}
